(function attachReadingLookup(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.KANJI_READING_LOOKUP = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function toHiragana(text) {
    return Array.from(String(text || ""), (char) => {
      const codePoint = char.codePointAt(0);
      return codePoint >= 0x30a1 && codePoint <= 0x30f6
        ? String.fromCodePoint(codePoint - 0x60)
        : char;
    }).join("");
  }

  function createExactLookup(options = {}) {
    const corrections = options.corrections;
    const overrides = options.overrides;
    const generated = options.generated;
    const isReviewSurface = typeof options.isReviewSurface === "function"
      ? options.isReviewSurface
      : () => false;

    function lookup(surface, reading) {
      const normalizedReading = toHiragana(reading);
      const learned = corrections?.lookup(surface, normalizedReading);
      if (learned) {
        return {
          ...learned,
          pieces: learned.pieces.length
            ? learned.pieces
            : [{ surface: learned.surface, reading: learned.reading }],
          source: "learned",
          forceReview: learned.needsReview,
        };
      }

      const overridePieces = overrides?.lookupExactWordReading(surface, normalizedReading);
      if (overridePieces) {
        return {
          surface: String(surface || ""),
          reading: normalizedReading,
          pieces: overridePieces,
          source: "override",
          forceReview: Boolean(isReviewSurface(surface)),
        };
      }

      const generatedPieces = generated?.lookupExactWordReading(surface, normalizedReading);
      if (generatedPieces) {
        const generatedEntries = typeof generated?.lookupSurfaceEntries === "function"
          ? generated.lookupSurfaceEntries(surface)
          : [];
        return {
          surface: String(surface || ""),
          reading: normalizedReading,
          pieces: generatedPieces,
          source: "generated",
          forceReview: Boolean(isReviewSurface(surface)) || generatedEntries.length > 1,
        };
      }
      return null;
    }

    return { lookup };
  }

  return { createExactLookup, toHiragana };
});
