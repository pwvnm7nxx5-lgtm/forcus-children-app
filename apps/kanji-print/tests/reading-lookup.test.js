const assert = require("node:assert/strict");
const test = require("node:test");

const lookup = require("../reading-lookup.js");

function pieces(surface, reading) {
  return [{ surface, reading }];
}

test("exact lookup precedence is learned, app override, then generated data", () => {
  const calls = [];
  const exact = lookup.createExactLookup({
    corrections: {
      lookup: () => {
        calls.push("learned");
        return { surface: "語", sourceReading: "ご", reading: "ことば", mode: "group", pieces: [], needsReview: false };
      },
    },
    overrides: {
      lookupExactWordReading: () => {
        calls.push("override");
        return pieces("語", "ご");
      },
    },
    generated: {
      lookupExactWordReading: () => {
        calls.push("generated");
        return pieces("語", "かた");
      },
    },
  });
  const learned = exact.lookup("語", "ご");
  assert.equal(learned.source, "learned");
  assert.deepEqual(calls, ["learned"]);

  const overrideOnly = lookup.createExactLookup({
    corrections: { lookup: () => null },
    overrides: { lookupExactWordReading: () => pieces("語", "ご") },
    generated: { lookupExactWordReading: () => pieces("語", "かた") },
  });
  assert.equal(overrideOnly.lookup("語", "ご").source, "override");

  const generatedOnly = lookup.createExactLookup({
    corrections: { lookup: () => null },
    overrides: { lookupExactWordReading: () => null },
    generated: { lookupExactWordReading: () => pieces("語", "かた") },
  });
  assert.equal(generatedOnly.lookup("語", "カタ").source, "generated");
});

test("review surfaces retain review state even when generated data is exact", () => {
  const exact = lookup.createExactLookup({
    generated: { lookupExactWordReading: () => pieces("今日", "きょう") },
    isReviewSurface: (surface) => surface === "今日",
  });
  assert.equal(exact.lookup("今日", "きょう").forceReview, true);
});

test("multiple generated readings stay reviewable even when Kuromoji supplies one", () => {
  const exact = lookup.createExactLookup({
    generated: {
      lookupExactWordReading: () => pieces("風", "ふう"),
      lookupSurfaceEntries: () => [
        { surface: "風", reading: "かぜ" },
        { surface: "風", reading: "ふう" },
      ],
    },
  });
  assert.equal(exact.lookup("風", "ふう").forceReview, true);
});
