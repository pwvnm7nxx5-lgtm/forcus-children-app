(function attachReadingInputState(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.KANJI_READING_INPUT_STATE = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function applyReadingInputValue(annotation, descriptor, value, normalize = String) {
    if (!annotation || !descriptor) {
      return false;
    }
    const normalized = normalize(String(value ?? ""));

    if (descriptor.role === "piece") {
      const piece = annotation.pieces?.[descriptor.pieceIndex];
      if (!piece || piece.reading === normalized) {
        return false;
      }
      piece.reading = normalized;
      annotation.manual = true;
      return true;
    }

    if (annotation.reading === normalized) {
      return false;
    }
    annotation.reading = normalized;
    annotation.manual = true;
    return true;
  }

  return {
    applyReadingInputValue,
  };
});
