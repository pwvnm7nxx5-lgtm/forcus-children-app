const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const alignment = require("../reading-alignment.js");
const dictionary = require("../reading-dictionary.js");
const build = require("../../../scripts/build-kanji-furigana.js");

const DATA_DIR = path.join(__dirname, "..", "vendor", "jmdict-furigana");
const manifest = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "manifest.json"), "utf8"));
const corpus64 = JSON.parse(fs.readFileSync(path.join(__dirname, "reading-corpus-64.json"), "utf8"));

function loadEntries() {
  return manifest.shards.flatMap((shard) => JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, shard.file), "utf8"),
  ).entries);
}

function findEntry(surface, reading) {
  const target = dictionary.toHiragana(reading);
  return loadEntries().find((entry) => entry[0] === surface && entry[1] === target) || null;
}

function reconstruct(entry) {
  const surface = entry[2].map((piece) => piece[0]).join("");
  const reading = entry[2].map((piece) => dictionary.toHiragana(piece[1])).join("");
  return { surface, reading };
}

test("manifest reports a practical non-stopgap dictionary and pinned source metadata", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.source.version, build.RELEASE_VERSION);
  assert.equal(manifest.source.sha256, build.SOURCE_SHA256);
  assert.equal(manifest.scope.characters, 2136);
  assert.equal(manifest.hash.bucketCount, 32);
  assert.ok(manifest.entries > 100000);
  assert.equal(manifest.entries, manifest.shards.reduce((total, shard) => total + shard.entries, 0));
  assert.ok(manifest.totalShardBytes < 24 * 1024 * 1024);
});

test("mandatory phrases and representative school corpus have exact source entries", () => {
  const corpus = [
    ["grade1", "学校", "がっこう"],
    ["grade1", "手紙", "てがみ"],
    ["grade1", "雨", "あめ"],
    ["grade1", "池", "いけ"],
    ["grade2", "遠く", "とおく"],
    ["grade2", "通う", "かよう"],
    ["grade2", "長", "なが"],
    ["grade2", "長ぐつ", "ながぐつ"],
    ["grade3", "学級会", "がっきゅうかい"],
    ["grade3", "進行", "しんこう"],
    ["grade4", "観察", "かんさつ"],
    ["grade4", "結果", "けっか"],
    ["grade5", "自然", "しぜん"],
    ["grade5", "豊か", "ゆたか"],
    ["grade6", "国際", "こくさい"],
    ["grade6", "責任", "せきにん"],
    ["junior-high", "情報", "じょうほう"],
    ["junior-high", "整理", "せいり"],
    ["junior-high", "発表", "はっぴょう"],
  ];
  for (const [, surface, reading] of corpus) {
    const entry = findEntry(surface, reading);
    assert.ok(entry, `${surface} ${reading}`);
    assert.deepEqual(reconstruct(entry), { surface, reading });
  }

  for (const [surface, reading, expectedMode, expectedAnnotationReading] of [
    ["学級会", "がっきゅうかい", "split", "がっきゅうかい"],
    ["遠く", "とおく", "split", "とお"],
    ["通う", "かよう", "split", "かよ"],
    ["今日", "きょう", "group", "きょう"],
    ["大人", "おとな", "group", "おとな"],
    ["一日", "ついたち", "group", "ついたち"],
  ]) {
    const entry = findEntry(surface, reading);
    assert.ok(entry, `${surface} ${reading}`);
    const annotations = alignment.alignExactSurfaceReading(
      surface,
      reading,
      entry[2].map(([entrySurface, entryReading]) => ({ surface: entrySurface, reading: entryReading })),
    );
    assert.equal(annotations.length, 1);
    assert.equal(annotations[0].mode, expectedMode);
    assert.equal(annotations[0].reading, expectedAnnotationReading);
  }

  const conservativeOneDay = alignment.alignSurfaceReading("一日", "いちにち", {
    getExactWordReading: (surface, reading) => (
      findEntry(surface, reading)?.[2].map(([entrySurface, entryReading]) => ({
        surface: entrySurface,
        reading: entryReading,
      })) || null
    ),
    forceReview: true,
    reviewReason: "word-review",
  });
  assert.equal(conservativeOneDay[0].mode, "group");
  assert.equal(conservativeOneDay[0].needsReview, true);
});

test("sentence corpus covers elementary grades 1-6 and junior-high compounds", () => {
  const sentences = [
    ["grade1", "学校で手紙を書く。", "がっこうでてがみをかく。", [["学校", "がっこう"], ["手紙", "てがみ"]]],
    ["grade2", "遠くまで通う。", "とおくまでかよう。", [["遠く", "とおく"], ["通う", "かよう"]]],
    ["grade3", "学級会の進行を発表する。", "がっきゅうかいのしんこうをはっぴょうする。", [["学級会", "がっきゅうかい"], ["進行", "しんこう"], ["発表", "はっぴょう"]]],
    ["grade4", "観察の結果を記録する。", "かんさつのけっかをきろくする。", [["観察", "かんさつ"], ["結果", "けっか"]]],
    ["grade5", "自然を大切にする。", "しぜんをたいせつにする。", [["自然", "しぜん"]]],
    ["grade6", "国際交流の責任を考える。", "こくさいこうりゅうのせきにんをかんがえる。", [["国際", "こくさい"], ["責任", "せきにん"]]],
    ["junior-high", "情報を整理して説明する。", "じょうほうをせいりしてせつめいする。", [["情報", "じょうほう"], ["整理", "せいり"]]],
  ];
  for (const [grade, sentence, reading, words] of sentences) {
    assert.ok(sentence.length > 0 && reading.length > 0, grade);
    assert.notEqual(sentence, reading, grade);
    for (const [surface, wordReading] of words) {
      assert.ok(sentence.includes(surface), `${grade}: ${surface} missing from sentence`);
      assert.ok(reading.includes(wordReading), `${grade}: ${wordReading} missing from reading`);
      assert.ok(findEntry(surface, wordReading), `${grade}: ${surface} ${wordReading}`);
    }
  }
});

test("checked-in 64-sentence audit fixture spans school grades and review cases", () => {
  assert.equal(corpus64.length, 64);
  assert.deepEqual(new Set(corpus64.map((entry) => entry.grade)), new Set([
    "grade1",
    "grade2",
    "grade3",
    "grade4",
    "grade5",
    "grade6",
    "junior-high",
  ]));
  const reviewChecks = corpus64.flatMap((entry) => entry.checks.filter((check) => check.review));
  assert.deepEqual(reviewChecks.map((check) => check.surface), [
    "先生",
    "山",
    "川",
    "魚",
    "町",
    "風",
    "自然",
    "文章",
    "買",
    "変化",
    "十分",
    "自然",
    "今日",
    "大人",
    "一日",
    "目標",
    "安全",
    "水",
  ]);
  for (const [index, sentence] of corpus64.entries()) {
    assert.ok(sentence.sentence.length > 0, `sentence ${index + 1}`);
    for (const check of sentence.checks) {
      const source = check.source || check.surface;
      const sourceReading = check.sourceReading || check.reading;
      const entry = findEntry(source, sourceReading);
      assert.ok(entry, `sentence ${index + 1}: ${source} ${sourceReading}`);
      assert.deepEqual(reconstruct(entry), { surface: source, reading: sourceReading });
    }
  }
});

test("dictionary evidence corrects truncated single-kanji readings and kana compounds", () => {
  for (const [surface, reading] of [["雨", "あめ"], ["長", "なが"], ["池", "いけ"]]) {
    const entry = findEntry(surface, reading);
    assert.ok(entry, `${surface} ${reading}`);
    assert.deepEqual(reconstruct(entry), { surface, reading });
  }

  const longBoots = findEntry("長ぐつ", "ながぐつ");
  assert.ok(longBoots);
  assert.deepEqual(reconstruct(longBoots), { surface: "長ぐつ", reading: "ながぐつ" });
  const annotations = alignment.alignExactSurfaceReading(
    "長ぐつ",
    "ながぐつ",
    longBoots[2].map(([surface, reading]) => ({ surface, reading })),
  );
  assert.deepEqual(annotations.map((annotation) => [annotation.surface, annotation.reading]), [["長", "なが"]]);
  assert.equal(annotations[0].needsReview, false);
});

test("independent batch audit reconstructs a broad sample of generated entries", () => {
  const entries = loadEntries();
  const sampleCount = Math.min(2000, entries.length);
  const step = Math.max(1, Math.floor(entries.length / sampleCount));
  let audited = 0;
  for (let index = 0; index < entries.length && audited < sampleCount; index += step) {
    const entry = entries[index];
    assert.equal(reconstruct(entry).surface, entry[0]);
    assert.equal(reconstruct(entry).reading, dictionary.toHiragana(entry[1]));
    audited += 1;
  }
  assert.equal(audited, sampleCount);
});

test("synthetic source filtering omits ambiguous segmentations and preserves literal kana", () => {
  const scope = new Set(["学", "級", "遠"]);
  const filtered = build.filterEntries([
    {
      text: "遠く",
      reading: "トオク",
      furigana: [{ ruby: "遠", rt: "トオ" }, { ruby: "く" }],
    },
    {
      text: "学級",
      reading: "がっきゅう",
      furigana: [{ ruby: "学", rt: "がっ" }, { ruby: "級", rt: "きゅう" }],
    },
    {
      text: "学級",
      reading: "がっきゅう",
      furigana: [{ ruby: "学級", rt: "がっきゅう" }],
    },
  ], scope);
  assert.equal(filtered.entries.length, 1);
  assert.equal(filtered.entries[0].surface, "遠く");
  assert.equal(filtered.conflictCount, 1);
  assert.equal(filtered.skipped.conflictingSurfaceReadings, 1);
  assert.deepEqual(filtered.entries[0].segments, [["遠", "とお"], ["く", "く"]]);
});
