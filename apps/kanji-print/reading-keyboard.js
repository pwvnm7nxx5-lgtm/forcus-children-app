(function attachReadingKeyboard(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.KANJI_READING_KEYBOARD = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function getReadingFocusSequence(annotations) {
    return (Array.isArray(annotations) ? annotations : []).flatMap((annotation) => {
      const pieces = Array.isArray(annotation.pieces) ? annotation.pieces : [];
      if (annotation.mode === "split" && pieces.length) {
        return pieces.map((_, pieceIndex) => ({
          annotationId: annotation.id,
          role: "piece",
          pieceIndex,
        }));
      }
      return [{ annotationId: annotation.id, role: "word", pieceIndex: -1 }];
    });
  }

  function getSourceIndices(entry) {
    const stored = Array.isArray(entry?.sourceIndices)
      ? entry.sourceIndices.map(Number).filter(Number.isFinite)
      : [];
    if (stored.length) {
      return stored;
    }
    const start = Number(entry?.sourceStart);
    const end = Number(entry?.sourceEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return [];
    }
    return Array.from({ length: end - start }, (_, index) => start + index);
  }

  function getReadingFocusForSourceIndex(annotations, sourceIndex) {
    const targetIndex = Number(sourceIndex);
    if (!Number.isFinite(targetIndex)) {
      return null;
    }

    const annotation = (Array.isArray(annotations) ? annotations : []).find((entry) => (
      getSourceIndices(entry).includes(targetIndex)
    ));
    if (!annotation) {
      return null;
    }

    if (annotation.mode === "split") {
      const pieces = Array.isArray(annotation.pieces) ? annotation.pieces : [];
      const pieceIndex = pieces.findIndex((piece) => getSourceIndices(piece).includes(targetIndex));
      if (pieceIndex >= 0) {
        return { annotationId: annotation.id, role: "piece", pieceIndex };
      }
    }

    return { annotationId: annotation.id, role: "word", pieceIndex: -1 };
  }

  function getAnnotationSequence(annotationId, sequence) {
    return sequence.filter((entry) => entry.annotationId === annotationId);
  }

  function getAdjacentWordFocus(annotations, annotationIndex, direction) {
    const targetIndex = annotationIndex + direction;
    if (targetIndex < 0 || targetIndex >= annotations.length) {
      return null;
    }
    return {
      annotationId: annotations[targetIndex].id,
      role: "word",
      pieceIndex: -1,
    };
  }

  function getPreviousReadingFocus(annotations, annotationIndex, sequence) {
    for (let index = annotationIndex - 1; index >= 0; index -= 1) {
      const entries = getAnnotationSequence(annotations[index].id, sequence);
      if (entries.length) {
        return entries[entries.length - 1];
      }
      return {
        annotationId: annotations[index].id,
        role: "word",
        pieceIndex: -1,
      };
    }
    return null;
  }

  function getAdjacentReadingFocus(annotations, descriptor, direction) {
    const sequence = getReadingFocusSequence(annotations);
    const currentIndex = sequence.findIndex((entry) => (
      entry.annotationId === descriptor.annotationId
      && entry.role === descriptor.role
      && entry.pieceIndex === descriptor.pieceIndex
    ));
    const annotationIndex = annotations.findIndex((annotation) => annotation.id === descriptor.annotationId);
    if (annotationIndex < 0) {
      return null;
    }

    const currentAnnotation = annotations[annotationIndex];
    const currentEntries = getAnnotationSequence(descriptor.annotationId, sequence);
    if (descriptor.role === "word") {
      if (currentAnnotation.mode === "split" && currentEntries.length && direction > 0) {
        return currentEntries[0];
      }
      if (direction < 0) {
        return getPreviousReadingFocus(annotations, annotationIndex, sequence);
      }
      return getAdjacentWordFocus(annotations, annotationIndex, direction);
    }

    const adjacentPiece = currentIndex >= 0 ? sequence[currentIndex + direction] : null;
    if (adjacentPiece && adjacentPiece.annotationId === descriptor.annotationId) {
      return adjacentPiece;
    }
    if (direction < 0) {
      return getPreviousReadingFocus(annotations, annotationIndex, sequence);
    }
    return getAdjacentWordFocus(annotations, annotationIndex, direction);
  }

  function getModeKeyAction(key, shiftKey = false) {
    if (key === "ArrowLeft") {
      return { type: "move", direction: -1 };
    }
    if (key === "ArrowRight") {
      return { type: "move", direction: 1 };
    }
    if (key === "Escape") {
      return { type: "return" };
    }
    if (key === "Enter" || key === " " || key === "Spacebar") {
      return { type: "activate" };
    }
    if (key === "Tab") {
      return { type: "reading", direction: shiftKey ? -1 : 1 };
    }
    return null;
  }

  function getModeButtonIndex(currentIndex, direction, buttonCount) {
    if (!buttonCount) {
      return -1;
    }
    return (currentIndex + direction + buttonCount) % buttonCount;
  }

  return {
    getAdjacentReadingFocus,
    getModeButtonIndex,
    getModeKeyAction,
    getReadingFocusForSourceIndex,
    getReadingFocusSequence,
  };
});
