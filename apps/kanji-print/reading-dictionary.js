(function attachReadingDictionary(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.KANJI_READING_DICTIONARY = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, (root) => {
  const DEFAULT_MANIFEST_URL = "vendor/jmdict-furigana/manifest.json";
  const DEFAULT_MAX_SPAN_TOKENS = 4;
  const DEFAULT_MAX_SURFACE_CHARS = 18;
  const NON_WORD_POS = new Set(["助詞", "助動詞", "記号", "フィラー", "接続詞"]);

  function toHiragana(text) {
    return Array.from(String(text || ""), (char) => {
      const codePoint = char.codePointAt(0);
      return codePoint >= 0x30a1 && codePoint <= 0x30f6
        ? String.fromCodePoint(codePoint - 0x60)
        : char;
    }).join("");
  }

  function isKanji(char) {
    return /[\u3400-\u9fff\uf900-\ufaff]/u.test(char || "") || char === "々";
  }

  function hasKanji(text) {
    return Array.from(String(text || "")).some(isKanji);
  }

  function hashSurface(surface, bucketCount = 32) {
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

  function makeEntryKey(surface, reading) {
    return `${String(surface || "")}\u0000${toHiragana(reading)}`;
  }

  const SHA256_CONSTANTS = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  function encodeUtf8(text) {
    const Encoder = root?.TextEncoder || (typeof TextEncoder === "function" ? TextEncoder : null);
    if (!Encoder) {
      throw new Error("TextEncoder is required for reading dictionary validation");
    }
    return new Encoder().encode(String(text));
  }

  function decodeUtf8(bytes) {
    const Decoder = root?.TextDecoder || (typeof TextDecoder === "function" ? TextDecoder : null);
    if (!Decoder) {
      throw new Error("TextDecoder is required for reading dictionary validation");
    }
    return new Decoder().decode(bytes);
  }

  async function readResponsePayload(response) {
    if (typeof response?.arrayBuffer === "function") {
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      return { bytes, text: decodeUtf8(bytes) };
    }
    if (typeof response?.text === "function") {
      const text = await response.text();
      return { bytes: encodeUtf8(text), text };
    }
    throw new Error("A text or arrayBuffer response body is required for the reading dictionary");
  }

  function rotateRight(value, bits) {
    return (value >>> bits) | (value << (32 - bits));
  }

  // Keep validation working when file:// or an older browser does not expose SubtleCrypto.
  function sha256Pure(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const bitLength = bytes.length * 8;
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
    view.setUint32(paddedLength - 4, bitLength >>> 0);

    const hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    const words = new Uint32Array(64);
    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let index = 0; index < 16; index += 1) {
        words[index] = view.getUint32(offset + index * 4);
      }
      for (let index = 16; index < 64; index += 1) {
        const left = words[index - 15];
        const right = words[index - 2];
        const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
        const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
        words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
      }

      let [a, b, c, d, e, f, g, h] = hash;
      for (let index = 0; index < 64; index += 1) {
        const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choice = (e & f) ^ (~e & g);
        const temp1 = (h + sigma1 + choice + SHA256_CONSTANTS[index] + words[index]) >>> 0;
        const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (sigma0 + majority) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }
      hash[0] = (hash[0] + a) >>> 0;
      hash[1] = (hash[1] + b) >>> 0;
      hash[2] = (hash[2] + c) >>> 0;
      hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0;
      hash[5] = (hash[5] + f) >>> 0;
      hash[6] = (hash[6] + g) >>> 0;
      hash[7] = (hash[7] + h) >>> 0;
    }
    return hash.map((value) => value.toString(16).padStart(8, "0")).join("");
  }

  async function sha256Hex(input, cryptoImpl = root?.crypto) {
    const bytes = typeof input === "string" ? encodeUtf8(input) : input;
    if (cryptoImpl?.subtle?.digest) {
      try {
        const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
      } catch {
        // Some file:// contexts expose crypto but reject SubtleCrypto operations.
      }
    }
    return sha256Pure(bytes);
  }

  function normalizeSegments(rawSegments) {
    if (!Array.isArray(rawSegments) || !rawSegments.length) {
      return null;
    }
    const segments = rawSegments.map((segment) => {
      const surface = Array.isArray(segment)
        ? String(segment[0] || "")
        : String(segment?.surface || "");
      const reading = toHiragana(Array.isArray(segment) ? segment[1] : segment?.reading);
      return surface && reading ? [surface, reading] : null;
    });
    return segments.every(Boolean) ? segments : null;
  }

  function parseManifest(text) {
    const manifest = typeof text === "string" ? JSON.parse(text.replace(/^\ufeff/u, "")) : text;
    if (!manifest || manifest.schemaVersion !== 1 || !manifest.hash || !Array.isArray(manifest.shards)) {
      throw new Error("Invalid JmdictFurigana manifest");
    }
    const bucketCount = Number(manifest.hash.bucketCount);
    if (!Number.isInteger(bucketCount) || bucketCount < 1 || manifest.shards.length !== bucketCount) {
      throw new Error("Invalid JmdictFurigana shard manifest");
    }
    if (manifest.shards.some((descriptor) => (
      !descriptor
      || typeof descriptor.file !== "string"
      || !Number.isInteger(Number(descriptor.bytes))
      || Number(descriptor.bytes) < 0
      || !/^[a-f0-9]{64}$/iu.test(String(descriptor.sha256 || ""))
    ))) {
      throw new Error("Invalid JmdictFurigana shard descriptor");
    }
    return manifest;
  }

  function parseShard(text) {
    const payload = typeof text === "string" ? JSON.parse(text.replace(/^\ufeff/u, "")) : text;
    if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.entries)) {
      throw new Error("Invalid JmdictFurigana shard");
    }
    const entries = new Map();
    const conflicts = new Set();
    for (const row of payload.entries) {
      if (!Array.isArray(row) || row.length !== 3) {
        continue;
      }
      const surface = String(row[0] || "");
      const reading = toHiragana(row[1]);
      const segments = normalizeSegments(row[2]);
      if (!surface || !reading || !segments) {
        continue;
      }
      const key = makeEntryKey(surface, reading);
      const value = { surface, reading, segments };
      const serialized = JSON.stringify(value.segments);
      const previous = entries.get(key);
      if (conflicts.has(key)) {
        continue;
      }
      if (previous && JSON.stringify(previous.segments) !== serialized) {
        entries.delete(key);
        conflicts.add(key);
      } else if (!previous) {
        entries.set(key, value);
      }
    }
    const bySurface = new Map();
    for (const entry of entries.values()) {
      const surfaceEntries = bySurface.get(entry.surface) || [];
      surfaceEntries.push(entry);
      bySurface.set(entry.surface, surfaceEntries);
    }
    return { entries, bySurface, conflicts };
  }

  function tokenSurface(token) {
    return String(typeof token === "string" ? token : token?.surface_form || token?.surface || "");
  }

  function isMergeableToken(token) {
    const surface = tokenSurface(token);
    if (!surface || /[\s。、，．,.！？!?「」『』（）()［］【】〈〉《》・…]/u.test(surface)) {
      return false;
    }
    const pos = String(typeof token === "object" ? token?.pos || "" : "");
    return !NON_WORD_POS.has(pos);
  }

  function collectSurfaceCandidates(tokens, options = {}) {
    const tokenList = (Array.isArray(tokens) ? tokens : [])
      .map((token) => ({ token, surface: tokenSurface(token) }))
      .filter((entry) => entry.surface);
    const maxSpanTokens = Math.max(1, Number(options.maxSpanTokens) || DEFAULT_MAX_SPAN_TOKENS);
    const maxSurfaceChars = Math.max(1, Number(options.maxSurfaceChars) || DEFAULT_MAX_SURFACE_CHARS);
    const surfaces = new Set();

    for (let start = 0; start < tokenList.length; start += 1) {
      let surface = "";
      for (let end = start; end < tokenList.length && end < start + maxSpanTokens; end += 1) {
        surface += tokenList[end].surface;
        const length = Array.from(surface).length;
        if (length > maxSurfaceChars && end > start) {
          break;
        }
        const spanTokens = tokenList.slice(start, end + 1).map((entry) => entry.token);
        if (hasKanji(surface) && (end === start || spanTokens.every(isMergeableToken))) {
          surfaces.add(surface);
          const surfaceChars = Array.from(surface);
          for (let prefixLength = 1; prefixLength <= surfaceChars.length && prefixLength <= maxSurfaceChars; prefixLength += 1) {
            const prefix = surfaceChars.slice(0, prefixLength).join("");
            if (hasKanji(prefix) && !/[\s。、，．,.！？!?「」『』（）()［］【】〈〉《》・…]/u.test(prefix)) {
              surfaces.add(prefix);
            }
          }
        }
      }
    }
    return [...surfaces].sort();
  }

  function resolveRelativeUrl(baseUrl, file) {
    if (/^[a-z][a-z\d+.-]*:/iu.test(file)) {
      return file;
    }
    const slash = String(baseUrl).lastIndexOf("/");
    return `${String(baseUrl).slice(0, slash + 1)}${file}`;
  }

  function clonePieces(entry) {
    return entry ? entry.segments.map(([surface, reading]) => ({ surface, reading })) : null;
  }

  function cloneEntry(entry) {
    return entry
      ? {
        surface: entry.surface,
        reading: entry.reading,
        segments: entry.segments.map(([surface, reading]) => [surface, reading]),
      }
      : null;
  }

  function createRuntimeDictionary(options = {}) {
    const fetchImpl = options.fetch || root?.fetch?.bind(root);
    const cryptoImpl = options.crypto === undefined ? root?.crypto : options.crypto;
    const manifestUrl = options.manifestUrl || DEFAULT_MANIFEST_URL;
    const shardCache = new Map();
    const loadedShards = new Map();
    const loadedSurfaceEntries = new Map();
    const surfaceLookupCache = new Map();
    let manifestPromise = null;
    let manifest = null;
    let manifestRequests = 0;
    let shardRequests = 0;
    let bytesLoaded = 0;
    let disabled = false;
    let failure = null;

    if (typeof fetchImpl !== "function") {
      throw new Error("A fetch implementation is required for the reading dictionary");
    }

    function disable(error) {
      disabled = true;
      failure = failure || (error instanceof Error ? error : new Error(String(error)));
      manifestPromise = null;
      shardCache.clear();
      loadedShards.clear();
      loadedSurfaceEntries.clear();
      surfaceLookupCache.clear();
    }

    async function loadManifest() {
      if (disabled) {
        throw failure;
      }
      if (!manifestPromise) {
        manifestRequests += 1;
        manifestPromise = fetchImpl(manifestUrl).then(async (response) => {
          if (!response?.ok) {
            throw new Error(`読み仮名辞書の manifest を読み込めませんでした (${response?.status || "network"})`);
          }
          const payload = await readResponsePayload(response);
          bytesLoaded += payload.bytes.byteLength;
          manifest = parseManifest(payload.text);
          return manifest;
        }).catch((error) => {
          manifestPromise = null;
          disable(error);
          throw error;
        });
      }
      return manifestPromise;
    }

    async function loadShard(index) {
      if (disabled) {
        throw failure;
      }
      if (shardCache.has(index)) {
        return shardCache.get(index);
      }
      const promise = loadManifest().then(async (loadedManifest) => {
        const descriptor = loadedManifest.shards[index];
        if (!descriptor?.file) {
          throw new Error(`読み仮名辞書の shard ${index} が見つかりません`);
        }
        shardRequests += 1;
        const response = await fetchImpl(resolveRelativeUrl(manifestUrl, descriptor.file));
        if (!response?.ok) {
          throw new Error(`読み仮名辞書の shard ${index} を読み込めませんでした (${response?.status || "network"})`);
        }
        const payload = await readResponsePayload(response);
        const { bytes, text } = payload;
        const expectedBytes = Number(descriptor.bytes);
        if (bytes.byteLength !== expectedBytes) {
          throw new Error(`読み仮名辞書の shard ${index} の byte size が一致しません`);
        }
        const actualSha256 = await sha256Hex(bytes, cryptoImpl);
        if (actualSha256.toLowerCase() !== String(descriptor.sha256).toLowerCase()) {
          throw new Error(`読み仮名辞書の shard ${index} の SHA-256 が一致しません`);
        }
        if (disabled) {
          throw failure;
        }
        bytesLoaded += bytes.byteLength;
        const parsed = parseShard(text);
        loadedShards.set(index, parsed.entries);
        for (const [surface, entries] of parsed.bySurface) {
          const existing = loadedSurfaceEntries.get(surface) || [];
          loadedSurfaceEntries.set(surface, existing.concat(entries));
          surfaceLookupCache.delete(surface);
        }
        return parsed.entries;
      }).catch((error) => {
        shardCache.delete(index);
        disable(error);
        throw error;
      });
      shardCache.set(index, promise);
      return promise;
    }

    function lookupSurfaceEntries(surface) {
      if (disabled) {
        return [];
      }
      const normalizedSurface = String(surface || "");
      if (surfaceLookupCache.has(normalizedSurface)) {
        return surfaceLookupCache.get(normalizedSurface).map(cloneEntry);
      }
      const entries = loadedSurfaceEntries.get(normalizedSurface) || [];
      surfaceLookupCache.set(normalizedSurface, entries);
      return entries.map(cloneEntry);
    }

    function findExactSurfaceMatches(text, matchOptions = {}) {
      if (disabled) {
        return [];
      }
      const chars = Array.from(String(text || ""));
      const maxSurfaceChars = Math.max(
        1,
        Number(matchOptions.maxSurfaceChars) || manifest?.maxSurfaceLength || DEFAULT_MAX_SURFACE_CHARS,
      );
      const tokenSpans = Array.isArray(matchOptions.tokenSpans) ? matchOptions.tokenSpans : [];
      const matches = [];
      let occupiedUntil = -1;

      function crossesBoundary(start, end) {
        return tokenSpans.some((token) => {
          const tokenStart = Number(token?.start);
          const tokenEnd = Number(token?.end);
          const pos = String(token?.pos || "");
          return Number.isFinite(tokenStart)
            && Number.isFinite(tokenEnd)
            && tokenStart < end
            && tokenEnd > start
            && NON_WORD_POS.has(pos);
        });
      }

      function startsInsideToken(start) {
        return tokenSpans.some((token) => {
          const tokenStart = Number(token?.start);
          const tokenEnd = Number(token?.end);
          const pos = String(token?.pos || "");
          return Number.isFinite(tokenStart)
            && Number.isFinite(tokenEnd)
            && tokenStart < start
            && tokenEnd > start
            && !NON_WORD_POS.has(pos);
        });
      }

      for (let start = 0; start < chars.length; start += 1) {
        if (start < occupiedUntil || !hasKanji(chars[start]) || startsInsideToken(start)) {
          continue;
        }
        const maxLength = Math.min(maxSurfaceChars, chars.length - start);
        let selected = null;
        for (let length = maxLength; length >= 1; length -= 1) {
          const surface = chars.slice(start, start + length).join("");
          if (/[\s。、，．,.！？!?「」『』（）()［］【】〈〉《》・…]/u.test(surface)) {
            continue;
          }
          const entries = lookupSurfaceEntries(surface);
          if (!entries.length || crossesBoundary(start, start + length)) {
            continue;
          }
          if (entries.length === 1) {
            selected = {
              start,
              end: start + length,
              surface,
              reading: entries[0].reading,
              segments: entries[0].segments,
            };
          }
          break;
        }
        if (selected) {
          matches.push(selected);
          occupiedUntil = selected.end;
        }
      }
      return matches;
    }

    async function prepareForTokens(tokens, prepareOptions = {}) {
      let surfaces = [];
      let indices = [];
      if (disabled) {
        return {
          available: false,
          surfaces,
          requestedShards: indices,
          loadedShards: [],
          error: failure,
        };
      }
      try {
        const loadedManifest = await loadManifest();
        surfaces = collectSurfaceCandidates(tokens, {
          maxSpanTokens: prepareOptions.maxSpanTokens,
          maxSurfaceChars: prepareOptions.maxSurfaceChars || loadedManifest.maxSurfaceLength,
        });
        indices = [...new Set(surfaces.map((surface) => hashSurface(surface, loadedManifest.hash.bucketCount)))];
        await Promise.all(indices.map(loadShard));
        return {
          available: true,
          surfaces,
          requestedShards: indices,
          loadedShards: indices.filter((index) => loadedShards.has(index)),
        };
      } catch (error) {
        disable(error);
        return {
          available: false,
          surfaces,
          requestedShards: indices,
          loadedShards: indices.filter((index) => loadedShards.has(index)),
          error,
        };
      }
    }

    function lookupExactWordReading(surface, reading) {
      if (disabled || !manifest) {
        return null;
      }
      const entries = loadedShards.get(hashSurface(surface, manifest.hash.bucketCount));
      const entry = entries?.get(makeEntryKey(surface, reading));
      return clonePieces(entry);
    }

    function getStats() {
      return {
        manifestRequests,
        shardRequests,
        requests: manifestRequests + shardRequests,
        loadedShardCount: loadedShards.size,
        bytesLoaded,
        disabled,
        error: failure?.message || "",
      };
    }

    return {
      collectSurfaceCandidates,
      getManifest: () => manifest,
      getStats,
      hashSurface,
      lookupExactWordReading,
      lookupSurfaceEntries,
      findExactSurfaceMatches,
      loadManifest,
      parseShard,
      prepareForTokens,
    };
  }

  return {
    collectSurfaceCandidates,
    createRuntimeDictionary,
    hashSurface,
    makeEntryKey,
    parseManifest,
    parseShard,
    sha256Hex,
    toHiragana,
  };
});
