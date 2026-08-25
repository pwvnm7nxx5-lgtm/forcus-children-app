const assert = require("node:assert/strict");
const test = require("node:test");

const corrections = require("../reading-corrections.js");
const lookupApi = require("../reading-lookup.js");

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    raw: () => values,
  };
}

function annotation(overrides = {}) {
  return {
    surface: "学級会",
    correctionReading: "がっきゅうかい",
    reading: "がっこうかい",
    mode: "split",
    pieces: [
      { surface: "学", reading: "がっ" },
      { surface: "級", reading: "こう" },
      { surface: "会", reading: "かい" },
    ],
    needsReview: false,
    ...overrides,
  };
}

test("corrections persist by original surface and reading and reapply after reload", () => {
  const storage = makeStorage();
  const first = corrections.createStore({ storage, now: () => 10 });
  first.record(annotation());

  const second = corrections.createStore({ storage, now: () => 20 });
  const learned = second.lookup("学級会", "ガッキュウカイ");
  assert.equal(learned.reading, "がっこうかい");
  assert.deepEqual(learned.pieces.map((piece) => piece.reading), ["がっ", "こう", "かい"]);
  assert.equal(JSON.parse(storage.raw().get(corrections.DEFAULT_STORAGE_KEY)).version, 1);
});

test("corrupt or wrong-version storage is ignored safely", () => {
  const corrupt = makeStorage({ [corrections.DEFAULT_STORAGE_KEY]: "{not-json" });
  assert.equal(corrections.createStore({ storage: corrupt }).size(), 0);
  const wrongVersion = makeStorage({
    [corrections.DEFAULT_STORAGE_KEY]: JSON.stringify({ version: 99, entries: {} }),
  });
  assert.equal(corrections.createStore({ storage: wrongVersion }).size(), 0);
});

test("correction memory evicts the least recently used entry at the configured bound", () => {
  const store = corrections.createStore({ storage: makeStorage(), maxEntries: 2 });
  store.record(annotation({ surface: "一", correctionReading: "いち", reading: "ひと", pieces: [{ surface: "一", reading: "ひと" }] }));
  store.record(annotation({ surface: "二", correctionReading: "に", reading: "ふた", pieces: [{ surface: "二", reading: "ふた" }] }));
  assert.equal(store.lookup("一", "いち").reading, "ひと");
  store.record(annotation({ surface: "三", correctionReading: "さん", reading: "みっ", pieces: [{ surface: "三", reading: "みっ" }] }));
  assert.equal(store.lookup("二", "に"), null);
  assert.equal(store.size(), 2);
  assert.equal(store.lookup("一", "いち").reading, "ひと");
  assert.equal(store.lookup("三", "さん").reading, "みっ");
});

test("lookup persists its LRU touch so reload and insertion evict the true oldest entry", () => {
  const storage = makeStorage();
  let current = 0;
  const first = corrections.createStore({ storage, maxEntries: 2, now: () => current });
  current = 10;
  first.record(annotation({ surface: "一", correctionReading: "いち", reading: "ひと", pieces: [{ surface: "一", reading: "ひと" }] }));
  current = 20;
  first.record(annotation({ surface: "二", correctionReading: "に", reading: "ふた", pieces: [{ surface: "二", reading: "ふた" }] }));
  current = 30;
  assert.equal(first.lookup("一", "いち").reading, "ひと");

  const reloaded = corrections.createStore({ storage, maxEntries: 2, now: () => current });
  current = 40;
  reloaded.record(annotation({ surface: "三", correctionReading: "さん", reading: "みっ", pieces: [{ surface: "三", reading: "みっ" }] }));

  assert.equal(reloaded.lookup("一", "いち").reading, "ひと");
  assert.equal(reloaded.lookup("二", "に"), null);
  assert.equal(reloaded.lookup("三", "さん").reading, "みっ");
});

test("invalid split corrections are discarded and generated lookup remains available", () => {
  const invalidEntries = {};
  const addInvalid = (entry) => {
    invalidEntries[corrections.makeCorrectionKey(entry.surface, entry.sourceReading)] = entry;
  };
  addInvalid({
    surface: "学校",
    sourceReading: "がっこう",
    reading: "がっこう",
    mode: "split",
    pieces: [{ surface: "学", reading: "がっ" }, { surface: "校", reading: "" }],
  });
  addInvalid({
    surface: "学級会",
    sourceReading: "がっきゅうかい",
    reading: "がっきゅうかい",
    mode: "split",
    pieces: [{ surface: "学", reading: "がっ" }, { surface: "会", reading: "かい" }],
  });
  addInvalid({
    surface: "大人",
    sourceReading: "おとな",
    reading: "おとな",
    mode: "split",
    pieces: [{ surface: "大", reading: "おと" }, { surface: "人", reading: "ひと" }],
  });
  const storage = makeStorage({
    [corrections.DEFAULT_STORAGE_KEY]: JSON.stringify({ version: 1, entries: invalidEntries }),
  });
  const store = corrections.createStore({ storage });

  assert.equal(store.size(), 0);
  assert.equal(store.record(annotation({
    surface: "学級会",
    correctionReading: "がっきゅうかい",
    reading: "がっきゅうかい",
    mode: "split",
    pieces: [{ surface: "学", reading: "がっ" }, { surface: "会", reading: "かい" }],
  })), null);

  const exact = lookupApi.createExactLookup({
    corrections: store,
    generated: {
      lookupExactWordReading: () => [{ surface: "学校", reading: "がっこう" }],
    },
  });
  assert.equal(exact.lookup("学校", "がっこう").source, "generated");
});

test("group corrections keep an indivisible segment without inventing pieces", () => {
  const store = corrections.createStore({ storage: makeStorage() });
  store.record(annotation({
    surface: "大人",
    correctionReading: "おとな",
    reading: "おとな",
    mode: "group",
    pieces: [],
  }));
  const learned = store.lookup("大人", "おとな");
  assert.equal(learned.mode, "group");
  assert.deepEqual(learned.pieces, []);
});
