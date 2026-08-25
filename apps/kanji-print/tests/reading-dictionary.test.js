const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const dictionary = require("../reading-dictionary.js");
const build = require("../../../scripts/build-kanji-furigana.js");

function response(text, status = 200, bytes = Buffer.from(text, "utf8")) {
  const buffer = Buffer.from(bytes);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    arrayBuffer: async () => buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ),
  };
}

function shardDescriptor(file, text, overrides = {}) {
  const bytes = Buffer.from(text, "utf8");
  return {
    file,
    bytes: bytes.byteLength,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    ...overrides,
  };
}

function makeFixture(rows, bucketCount = 4) {
  const shardEntries = Array.from({ length: bucketCount }, () => []);
  rows.forEach((row) => shardEntries[dictionary.hashSurface(row[0], bucketCount)].push(row));
  const shardTexts = shardEntries.map((entries) => JSON.stringify({ schemaVersion: 1, entries }));
  return {
    manifest: {
      schemaVersion: 1,
      hash: { bucketCount },
      maxSurfaceLength: 8,
      shards: shardTexts.map((text, index) => shardDescriptor(`shard-${index}.json`, text)),
    },
    shardTexts,
  };
}

test("shard parser rejects conflicting surface and reading segmentation", () => {
  const parsed = dictionary.parseShard(JSON.stringify({
    schemaVersion: 1,
    entries: [
      ["異字", "いじ", [["異", "い"], ["字", "じ"]]],
      ["異字", "いじ", [["異字", "いじ"]]],
    ],
  }));
  assert.equal(parsed.entries.size, 0);
  assert.equal(parsed.conflicts.size, 1);
  assert.equal(parsed.bySurface.size, 0);
});

test("surface hashing is shared with the deterministic generator and candidates span token boundaries", () => {
  assert.equal(dictionary.hashSurface("学級会", 32), build.hashSurface("学級会", 32));
  assert.deepEqual(
    dictionary.collectSurfaceCandidates([
      { surface_form: "学級" },
      { surface_form: "会" },
      { surface_form: "の" },
      { surface_form: "進行" },
    ], { maxSpanTokens: 3, maxSurfaceChars: 8 }),
    ["の進", "の進行", "会", "会の", "会の進", "会の進行", "学", "学級", "学級会", "学級会の", "進", "進行"],
  );
  assert.deepEqual(
    dictionary.collectSurfaceCandidates([
      { surface_form: "学級会", pos: "名詞" },
      { surface_form: "の", pos: "助詞" },
      { surface_form: "進行", pos: "名詞" },
      { surface_form: "。", pos: "記号" },
    ], { maxSpanTokens: 4, maxSurfaceChars: 8 }),
    ["学", "学級", "学級会", "進", "進行"],
  );
});

test("runtime loads manifest once, caches required shards, and looks up generated pieces", async () => {
  const manifestUrl = "/kanji/manifest.json";
  const bucketCount = 4;
  const rows = [
    ["学級会", "がっきゅうかい", [["学", "がっ"], ["級", "きゅう"], ["会", "かい"]]],
    ["大人", "おとな", [["大人", "おとな"]]],
  ];
  const fixture = makeFixture(rows, bucketCount);
  const { manifest, shardTexts } = fixture;
  const requests = [];
  const fetchMock = async (url) => {
    requests.push(url);
    if (url === manifestUrl) {
      return response(JSON.stringify(manifest));
    }
    const match = String(url).match(/shard-(\d+)\.json$/u);
    assert.ok(match);
    return response(shardTexts[Number(match[1])]);
  };

  const runtime = dictionary.createRuntimeDictionary({ fetch: fetchMock, manifestUrl });
  const prepared = await runtime.prepareForTokens([
    { surface_form: "学級" },
    { surface_form: "会" },
    { surface_form: "大人" },
  ], { maxSpanTokens: 2, maxSurfaceChars: 8 });

  assert.ok(prepared.surfaces.includes("学級会"));
  assert.deepEqual(runtime.lookupExactWordReading("学級会", "ガッキュウカイ"), [
    { surface: "学", reading: "がっ" },
    { surface: "級", reading: "きゅう" },
    { surface: "会", reading: "かい" },
  ]);
  assert.deepEqual(runtime.lookupExactWordReading("大人", "おとな"), [
    { surface: "大人", reading: "おとな" },
  ]);
  assert.equal(runtime.lookupExactWordReading("未読", "みどく"), null);
  assert.equal(requests.filter((url) => url === manifestUrl).length, 1);
  assert.equal(runtime.getStats().shardRequests, new Set(prepared.requestedShards).size);
  await runtime.prepareForTokens([{ surface_form: "学級会" }]);
  assert.equal(runtime.getStats().shardRequests, new Set(prepared.requestedShards).size);
});

test("exact surface matching prefers a unique compound and rejects ambiguous readings", async () => {
  const manifestUrl = "/kanji/manifest.json";
  const bucketCount = 4;
  const rows = [
    ["長", "なが", [["長", "なが"]]],
    ["長ぐつ", "ながぐつ", [["長", "なが"], ["ぐつ", "ぐつ"]]],
    ["今日", "きょう", [["今日", "きょう"]]],
    ["今日", "こんにち", [["今日", "こんにち"]]],
  ];
  const fixture = makeFixture(rows, bucketCount);
  const { manifest, shardTexts } = fixture;
  const fetchMock = async (url) => {
    if (url === manifestUrl) return response(JSON.stringify(manifest));
    const index = Number(String(url).match(/shard-(\d+)\.json$/u)[1]);
    return response(shardTexts[index]);
  };
  const runtime = dictionary.createRuntimeDictionary({ fetch: fetchMock, manifestUrl });
  await runtime.prepareForTokens([
    { surface_form: "長", pos: "接頭詞" },
    { surface_form: "ぐつをはく", pos: "名詞" },
    { surface_form: "今日", pos: "名詞" },
  ]);

  assert.deepEqual(runtime.findExactSurfaceMatches("長ぐつをはく", {
    tokenSpans: [
      { start: 0, end: 1, pos: "接頭詞" },
      { start: 1, end: 6, pos: "名詞" },
    ],
  }).map((match) => [match.surface, match.reading, match.start, match.end]), [
    ["長ぐつ", "ながぐつ", 0, 3],
  ]);
  assert.deepEqual(runtime.findExactSurfaceMatches("今日", {
    tokenSpans: [{ start: 0, end: 2, pos: "名詞" }],
  }), []);
  assert.deepEqual(runtime.findExactSurfaceMatches("安全", {
    tokenSpans: [{ start: 0, end: 2, pos: "名詞" }],
  }), []);
});

test("manifest HTTP failure disables exact enrichment without throwing", async () => {
  const manifestUrl = "/kanji/manifest.json";
  const runtime = dictionary.createRuntimeDictionary({
    fetch: async (url) => {
      assert.equal(url, manifestUrl);
      return response("service unavailable", 503);
    },
    manifestUrl,
  });

  const prepared = await runtime.prepareForTokens([{ surface_form: "学級会" }]);

  assert.equal(prepared.available, false);
  assert.match(prepared.error.message, /503/u);
  assert.deepEqual(runtime.findExactSurfaceMatches("学級会"), []);
  assert.equal(runtime.lookupExactWordReading("学級会", "がっきゅうかい"), null);
  assert.equal(runtime.getStats().disabled, true);
});

test("shard byte-size mismatch disables exact enrichment before parsing", async () => {
  const manifestUrl = "/kanji/manifest.json";
  const shardText = JSON.stringify({
    schemaVersion: 1,
    entries: [["学校", "がっこう", [["学", "がっ"], ["校", "こう"]]]],
  });
  const manifest = {
    schemaVersion: 1,
    hash: { bucketCount: 1 },
    shards: [shardDescriptor("shard-00.json", shardText, { bytes: Buffer.byteLength(shardText) + 1 })],
  };
  const runtime = dictionary.createRuntimeDictionary({
    fetch: async (url) => url === manifestUrl
      ? response(JSON.stringify(manifest))
      : response(shardText),
    manifestUrl,
  });

  const prepared = await runtime.prepareForTokens([{ surface_form: "学校" }]);

  assert.equal(prepared.available, false);
  assert.match(prepared.error.message, /byte size/u);
  assert.deepEqual(runtime.lookupSurfaceEntries("学校"), []);
});

test("shard SHA-256 mismatch disables exact enrichment before parsing", async () => {
  const manifestUrl = "/kanji/manifest.json";
  const shardText = JSON.stringify({
    schemaVersion: 1,
    entries: [["学校", "がっこう", [["学", "がっ"], ["校", "こう"]]]],
  });
  const manifest = {
    schemaVersion: 1,
    hash: { bucketCount: 1 },
    shards: [shardDescriptor("shard-00.json", shardText, { sha256: "0".repeat(64) })],
  };
  const runtime = dictionary.createRuntimeDictionary({
    fetch: async (url) => url === manifestUrl
      ? response(JSON.stringify(manifest))
      : response(shardText),
    manifestUrl,
  });

  const prepared = await runtime.prepareForTokens([{ surface_form: "学校" }]);

  assert.equal(prepared.available, false);
  assert.match(prepared.error.message, /SHA-256/u);
  assert.deepEqual(runtime.findExactSurfaceMatches("学校"), []);
});

test("Windows CRLF checkout validates against the canonical LF shard", async () => {
  const manifestUrl = "/kanji/manifest.json";
  const shardText = `${JSON.stringify({
    schemaVersion: 1,
    entries: [["学校", "がっこう", [["学", "がっ"], ["校", "こう"]]]],
  }, null, 2)}\n`;
  const manifest = {
    schemaVersion: 1,
    hash: { bucketCount: 1 },
    shards: [shardDescriptor("shard-00.json", shardText)],
  };
  const checkedOutText = shardText.replace(/\n/gu, "\r\n");
  const runtime = dictionary.createRuntimeDictionary({
    fetch: async (url) => url === manifestUrl
      ? response(JSON.stringify(manifest))
      : response(checkedOutText),
    manifestUrl,
  });

  const prepared = await runtime.prepareForTokens([{ surface_form: "学校" }]);

  assert.equal(prepared.available, true);
  assert.deepEqual(runtime.lookupExactWordReading("学校", "がっこう"), [
    { surface: "学", reading: "がっ" },
    { surface: "校", reading: "こう" },
  ]);
});
