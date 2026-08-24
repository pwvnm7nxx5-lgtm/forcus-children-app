(function attachReadingWordMap(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.KANJI_READING_WORD_MAP = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function toHiragana(text) {
    return Array.from(text || "", (char) => {
      const codePoint = char.codePointAt(0);
      return codePoint >= 0x30a1 && codePoint <= 0x30f6
        ? String.fromCodePoint(codePoint - 0x60)
        : char;
    }).join("");
  }

  // Keep this list small and exact. New entries can be added without replacing the generic fallback.
  const exactWordEntries = [
    {
      surface: "学級",
      reading: "がっきゅう",
      pieces: [{ surface: "学", reading: "がっ" }, { surface: "級", reading: "きゅう" }],
    },
    {
      surface: "学級会",
      reading: "がっきゅうかい",
      pieces: [
        { surface: "学", reading: "がっ" },
        { surface: "級", reading: "きゅう" },
        { surface: "会", reading: "かい" },
      ],
    },
    {
      surface: "学校",
      reading: "がっこう",
      pieces: [{ surface: "学", reading: "がっ" }, { surface: "校", reading: "こう" }],
    },
    {
      surface: "進行",
      reading: "しんこう",
      pieces: [{ surface: "進", reading: "しん" }, { surface: "行", reading: "こう" }],
    },
  ];

  const reviewWordSurfaces = new Set(["今日", "大人", "一日"]);

  const exactWordReadings = new Map(
    exactWordEntries.map((entry) => [
      `${entry.surface}\u0000${toHiragana(entry.reading)}`,
      entry.pieces.map((piece) => ({
        surface: piece.surface,
        reading: toHiragana(piece.reading),
      })),
    ]),
  );

  function lookupExactWordReading(surface, reading) {
    const pieces = exactWordReadings.get(`${String(surface || "")}\u0000${toHiragana(reading)}`);
    return pieces ? pieces.map((piece) => ({ ...piece })) : null;
  }

  function isReviewWordSurface(surface) {
    return reviewWordSurfaces.has(String(surface || ""));
  }

  return {
    exactWordEntries,
    isReviewWordSurface,
    lookupExactWordReading,
    toHiragana,
  };
});
