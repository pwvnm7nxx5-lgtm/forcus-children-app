"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "apps", "kanji-print", "vendor", "jmdict-furigana");
const SCOPE_FILE = path.join(__dirname, "joyo-kanji.txt");
const RELEASE_VERSION = "2.3.1+2026-07-25";
const SOURCE_ASSET = "JmdictFurigana.json.tar.gz";
const SOURCE_URL = `https://github.com/Doublevil/JmdictFurigana/releases/download/${encodeURIComponent(RELEASE_VERSION)}/${SOURCE_ASSET}`;
const SOURCE_SHA256 = "fc02519134ba75389db1885127cd06b8beb3e4f1922c68c510b73f3b7175b01a";
const JOYO_SOURCE_URL = "https://www.bunka.go.jp/seisaku/kokugo_nihongo/kokugo_shisaku/joyokanjihyo_sakuin/index.html";
const JOYO_TABLE_BASE_URL = "https://www.bunka.go.jp/seisaku/kokugo_nihongo/kokugo_shisaku/joyokanjihyo_sakuin/";
const BUCKET_COUNT = 32;

// These are the Unicode/JIS spellings used by dictionary data for a few
// official Joyo characters whose current web table uses a different glyph.
const SCOPE_VARIANT_ALIASES = new Map([
  ["剥", "剝"],
  ["填", "塡"],
  ["頬", "頰"],
]);

const TABLE_SUFFIXES = [
  "a", "i", "u", "e", "o", "ka", "ki", "ku", "ke", "ko",
  "sa", "si", "su", "se", "so", "ta", "ti", "tu", "te", "to",
  "na", "ni", "nu", "ne", "no", "ha", "hi", "hu", "he", "ho",
  "ma", "mi", "mu", "me", "mo", "ya", "yu", "yo", "ra", "ri",
  "ru", "re", "ro", "wa",
];

function toHiragana(text) {
  return Array.from(String(text || ""), (char) => {
    const codePoint = char.codePointAt(0);
    return codePoint >= 0x30a1 && codePoint <= 0x30f6
      ? String.fromCodePoint(codePoint - 0x60)
      : char;
  }).join("");
}

function isCjk(char) {
  return /[\u3400-\u9fff\uf900-\ufaff]/u.test(char || "");
}

function hasKanji(text) {
  return Array.from(text).some(isCjk);
}

function isAllowedSurface(text, scope) {
  return Array.from(text).every((char) => {
    if (!isCjk(char)) {
      return true;
    }
    return scope.has(char) || scope.has(SCOPE_VARIANT_ALIASES.get(char) || "") || char === "々";
  });
}

function hashSurface(surface, bucketCount = BUCKET_COUNT) {
  let hash = 0x811c9dc5;
  for (const char of String(surface || "")) {
    const codePoint = char.codePointAt(0);
    hash ^= codePoint & 0xff;
    hash = Math.imul(hash, 0x01000193);
    if (codePoint > 0xff) {
      hash ^= (codePoint >>> 8) & 0xff;
      hash = Math.imul(hash, 0x01000193);
    }
    if (codePoint > 0xffff) {
      hash ^= (codePoint >>> 16) & 0xff;
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return (hash >>> 0) % bucketCount;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function parseTar(buffer) {
  const files = new Map();
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) {
      break;
    }
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/u, "");
    const sizeText = header.subarray(124, 136).toString("ascii").replace(/\0.*$/u, "").trim();
    const size = sizeText ? Number.parseInt(sizeText, 8) : 0;
    if (!name || !Number.isSafeInteger(size) || size < 0) {
      throw new Error("Invalid tar header in JmdictFurigana release asset");
    }
    const start = offset + 512;
    files.set(name, buffer.subarray(start, start + size));
    offset = start + Math.ceil(size / 512) * 512;
  }
  return files;
}

function parseReleaseAsset(buffer) {
  const tar = parseTar(zlib.gunzipSync(buffer));
  const jsonBuffer = tar.get("JmdictFurigana.json")
    || [...tar.entries()].find(([name]) => name.endsWith("/JmdictFurigana.json"))?.[1];
  if (!jsonBuffer) {
    throw new Error("JmdictFurigana.json was not found in the release tarball");
  }
  const entries = JSON.parse(jsonBuffer.toString("utf8").replace(/^\ufeff/u, ""));
  if (!Array.isArray(entries)) {
    throw new Error("JmdictFurigana JSON is not an array");
  }
  return entries;
}

function parseSourceEntry(entry) {
  const surface = String(entry?.text || "");
  const reading = toHiragana(entry?.reading || "");
  if (!surface || !reading || !Array.isArray(entry?.furigana)) {
    return { reason: "missing-fields" };
  }

  const segments = entry.furigana.map((segment) => {
    const segmentSurface = String(segment?.ruby || "");
    const segmentReading = toHiragana(segment?.rt ?? segmentSurface);
    return [segmentSurface, segmentReading];
  });
  if (segments.some(([segmentSurface, segmentReading]) => !segmentSurface || !segmentReading)) {
    return { reason: "empty-segment" };
  }
  if (segments.map(([segmentSurface]) => segmentSurface).join("") !== surface) {
    return { reason: "surface-reconstruction-mismatch" };
  }
  if (segments.map(([, segmentReading]) => segmentReading).join("") !== reading) {
    return { reason: "reading-reconstruction-mismatch" };
  }
  return { surface, reading, segments };
}

function loadScope(scopeFile = SCOPE_FILE) {
  const text = fs.readFileSync(scopeFile, "utf8");
  const chars = Array.from(text
    .split(/\r?\n/u)
    .filter((line) => !line.trim().startsWith("#"))
    .join("")
    .replace(/\s+/gu, ""));
  const scope = new Set(chars);
  if (scope.size !== 2136) {
    throw new Error(`Expected 2136 official Joyo characters, found ${scope.size}`);
  }
  return scope;
}

function serializeSegments(segments) {
  return JSON.stringify(segments);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function filterEntries(sourceEntries, scope) {
  const candidates = new Map();
  const skipped = Object.create(null);
  const increment = (reason) => {
    skipped[reason] = (skipped[reason] || 0) + 1;
  };

  for (const sourceEntry of sourceEntries) {
    const parsed = parseSourceEntry(sourceEntry);
    if (parsed.reason) {
      increment(parsed.reason);
      continue;
    }
    if (!hasKanji(parsed.surface)) {
      increment("no-kanji");
      continue;
    }
    if (!isAllowedSurface(parsed.surface, scope)) {
      increment("outside-joyo-scope");
      continue;
    }

    const key = `${parsed.surface}\u0000${parsed.reading}`;
    const serialized = serializeSegments(parsed.segments);
    const previous = candidates.get(key);
    if (!previous) {
      candidates.set(key, { serialized, value: parsed });
    } else if (previous.serialized !== serialized) {
      candidates.set(key, { conflict: true });
    }
  }

  const conflicts = [...candidates.values()].filter((value) => value.conflict).length;
  const entries = [...candidates.entries()]
    .filter(([, value]) => !value.conflict)
    .map(([, value]) => value.value)
    .sort((left, right) => compareText(left.surface, right.surface) || compareText(left.reading, right.reading));
  skipped.conflictingSurfaceReadings = conflicts;
  return {
    entries,
    skipped,
    sourceEntryCount: sourceEntries.length,
    candidateKeyCount: candidates.size,
    conflictCount: conflicts,
  };
}

function shardRows(entries) {
  const shards = Array.from({ length: BUCKET_COUNT }, () => []);
  for (const entry of entries) {
    shards[hashSurface(entry.surface)].push([
      entry.surface,
      entry.reading,
      entry.segments,
    ]);
  }
  return shards;
}

function makeShardText(entries) {
  return `${JSON.stringify({ schemaVersion: 1, entries })}\n`;
}

async function fetchBuffer(url) {
  const response = await fetch(url, { headers: { "user-agent": "kanji-print-furigana-build" } });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function updateJoyoList(outputFile = SCOPE_FILE) {
  const found = [];
  for (let index = 0; index < TABLE_SUFFIXES.length; index += 1) {
    const url = `${JOYO_TABLE_BASE_URL}table_${String(index + 1).padStart(2, "0")}_${TABLE_SUFFIXES[index]}.html`;
    const response = await fetch(url, { headers: { "user-agent": "kanji-print-furigana-scope-build" } });
    if (!response.ok) {
      if (response.status === 404) {
        continue;
      }
      throw new Error(`Official Joyo table download failed (${response.status}): ${url}`);
    }
    const html = await response.text();
    const matches = html.matchAll(/image\/\d{4}-1\.jpg" alt="([^"]+)"/gu);
    for (const match of matches) {
      found.push(match[1]);
    }
  }
  const chars = [...new Set(found.join(""))];
  if (chars.length !== 2136) {
    throw new Error(`Expected 2136 official Joyo characters, found ${chars.length}`);
  }
  const content = [
    "# Derived from the Agency for Cultural Affairs Joyo Kanji index.",
    `# Source: ${JOYO_SOURCE_URL}`,
    "# The list is checked in so normal builds do not make 44 scope requests.",
    `# Character count: ${chars.length}`,
    chars.join(""),
    "",
  ].join("\n");
  fs.writeFileSync(outputFile, content, "utf8");
  return chars;
}

function cleanGeneratedDirectory() {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function writeGeneratedData(filtered) {
  cleanGeneratedDirectory();
  const shards = shardRows(filtered.entries);
  const shardMetadata = [];
  let totalShardBytes = 0;
  shards.forEach((entries, index) => {
    const file = `shard-${String(index).padStart(2, "0")}.json`;
    const buffer = Buffer.from(makeShardText(entries), "utf8");
    fs.writeFileSync(path.join(DATA_DIR, file), buffer);
    const metadata = {
      file,
      entries: entries.length,
      bytes: buffer.byteLength,
      sha256: sha256(buffer),
    };
    shardMetadata.push(metadata);
    totalShardBytes += buffer.byteLength;
  });

  const maxSurfaceLength = filtered.entries.reduce(
    (maximum, entry) => Math.max(maximum, Array.from(entry.surface).length),
    0,
  );
  const manifest = {
    schemaVersion: 1,
    source: {
      project: "JmdictFurigana",
      version: RELEASE_VERSION,
      asset: SOURCE_ASSET,
      url: SOURCE_URL,
      sha256: SOURCE_SHA256,
      license: "Creative Commons Attribution-ShareAlike (same license as JMdict)",
      attribution: "JmdictFurigana by Doublevil; source dictionary JMdict by the Electronic Dictionary Research and Development Group.",
      excludes: ["JmnedictFurigana.json", "JmnedictFurigana.txt"],
    },
    scope: {
      name: "Official Joyo Kanji (elementary school plus remaining common-use kanji)",
      characters: 2136,
      source: JOYO_SOURCE_URL,
      checkedInFile: "scripts/joyo-kanji.txt",
      variantAliases: Object.fromEntries(SCOPE_VARIANT_ALIASES),
    },
    hash: {
      algorithm: "FNV-1a over Unicode code points, modulo bucketCount",
      bucketCount: BUCKET_COUNT,
    },
    entries: filtered.entries.length,
    sourceEntryCount: filtered.sourceEntryCount,
    candidateKeyCount: filtered.candidateKeyCount,
    conflictCount: filtered.conflictCount,
    skipped: filtered.skipped,
    maxSurfaceLength,
    totalShardBytes,
    shards: shardMetadata,
  };
  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(DATA_DIR, "manifest.json"), manifestBuffer);
  return { manifest, manifestBytes: manifestBuffer.byteLength };
}

async function getSourceEntries(options = {}) {
  if (options.sourceFile) {
    const buffer = fs.readFileSync(path.resolve(options.sourceFile));
    if (options.sourceFile.endsWith(".json")) {
      const entries = JSON.parse(buffer.toString("utf8"));
      return { entries, sha256: sha256(buffer), sourceFile: options.sourceFile };
    }
    return { entries: parseReleaseAsset(buffer), sha256: sha256(buffer), sourceFile: options.sourceFile };
  }
  const buffer = await fetchBuffer(SOURCE_URL);
  const actualSha256 = sha256(buffer);
  if (actualSha256 !== SOURCE_SHA256) {
    throw new Error(`Pinned source SHA-256 mismatch: expected ${SOURCE_SHA256}, got ${actualSha256}`);
  }
  return { entries: parseReleaseAsset(buffer), sha256: actualSha256, sourceFile: SOURCE_URL };
}

async function build(options = {}) {
  if (options.updateJoyoList) {
    await updateJoyoList();
  }
  const scope = loadScope(options.scopeFile || SCOPE_FILE);
  const source = await getSourceEntries(options);
  const filtered = filterEntries(source.entries, scope);
  const generated = writeGeneratedData(filtered);
  const manifest = {
    ...generated.manifest,
    source: {
      ...generated.manifest.source,
      downloadedSha256: source.sha256,
    },
  };
  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(DATA_DIR, "manifest.json"), manifestBuffer);
  return {
    ...generated,
    manifest,
    manifestBytes: manifestBuffer.byteLength,
    totalBytes: generated.manifest.totalShardBytes + manifestBuffer.byteLength,
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = {
    updateJoyoList: argv.includes("--update-joyo-list"),
    sourceFile: argv[argv.indexOf("--source-file") + 1] || "",
  };
  if (options.sourceFile === "--update-joyo-list" || options.sourceFile.startsWith("--")) {
    options.sourceFile = "";
  }
  const result = await build(options);
  console.log(JSON.stringify({
    sourceVersion: RELEASE_VERSION,
    sourceSha256: result.manifest.source.downloadedSha256,
    entries: result.manifest.entries,
    conflictCount: result.manifest.conflictCount,
    skipped: result.manifest.skipped,
    totalBytes: result.totalBytes,
    totalShardBytes: result.manifest.totalShardBytes,
    manifestBytes: result.manifestBytes,
    bucketCount: BUCKET_COUNT,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  BUCKET_COUNT,
  RELEASE_VERSION,
  SOURCE_SHA256,
  filterEntries,
  hashSurface,
  loadScope,
  normalizeSourceEntry: parseSourceEntry,
  parseReleaseAsset,
  updateJoyoList,
};
