(function attachReadingAlignment(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.KANJI_READING_ALIGNMENT = api;
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

  function isKanji(char) {
    return /[\u3400-\u9fff々]/u.test(char || "");
  }

  function isKana(char) {
    const codePoint = String(char || "").codePointAt(0);
    return (
      (codePoint >= 0x3041 && codePoint <= 0x3096)
      || (codePoint >= 0x30a1 && codePoint <= 0x30fa)
      || codePoint === 0x30fc
    );
  }

  function getSurfaceParts(chars, isKanjiFn) {
    if (!chars.length) {
      return [];
    }

    const parts = [];
    let start = 0;
    let kind = isKanjiFn(chars[0]) ? "kanji" : isKana(chars[0]) ? "kana" : "other";
    for (let index = 1; index <= chars.length; index += 1) {
      const nextKind = index < chars.length
        ? (isKanjiFn(chars[index]) ? "kanji" : isKana(chars[index]) ? "kana" : "other")
        : null;
      if (nextKind === kind) {
        continue;
      }
      parts.push({
        kind,
        start,
        end: index,
        surface: chars.slice(start, index).join(""),
      });
      start = index;
      kind = nextKind;
    }
    return parts;
  }

  function normalizeSourceIndices(chars, sourceIndices) {
    return chars.map((_, index) => {
      const value = Number(sourceIndices?.[index]);
      return Number.isFinite(value) ? value : index;
    });
  }

  function getSourceRange(sourceIndices, start, end) {
    const sourceStart = sourceIndices[start];
    const sourceEnd = sourceIndices[end - 1] + 1;
    return { sourceStart, sourceEnd };
  }

  function getUnitInputIndex(entry, index) {
    const value = Number(entry?.inputIndex ?? entry?.sourceIndex);
    return Number.isFinite(value) ? value : index;
  }

  function findTokenStart(units, cursor, surface) {
    const tokenChars = Array.from(surface || "");
    if (!tokenChars.length) {
      return -1;
    }
    for (let start = Math.max(0, cursor); start <= units.length - tokenChars.length; start += 1) {
      if (units.slice(start, start + tokenChars.length).map((entry) => entry.char).join("") === surface) {
        return start;
      }
    }
    return -1;
  }

  function getOccurrences(text, pattern) {
    const occurrences = [];
    if (!pattern) {
      return occurrences;
    }
    let cursor = 0;
    while (cursor <= text.length) {
      const start = text.indexOf(pattern, cursor);
      if (start < 0) {
        break;
      }
      occurrences.push({ start, end: start + pattern.length });
      cursor = start + 1;
    }
    return occurrences;
  }

  function findAnchorAlignment(anchorRuns, reading) {
    const anchors = anchorRuns.map((run) => toHiragana(run.surface));
    if (!anchors.length) {
      return { matches: [], ambiguous: false, failed: false };
    }

    const occurrences = anchors.map((anchor) => getOccurrences(reading, anchor));
    const paths = [];
    function visit(anchorIndex, cursor, path) {
      if (paths.length >= 2) {
        return;
      }
      if (anchorIndex === occurrences.length) {
        paths.push(path);
        return;
      }
      for (const occurrence of occurrences[anchorIndex]) {
        if (occurrence.start < cursor) {
          continue;
        }
        visit(anchorIndex + 1, occurrence.end, [...path, occurrence]);
      }
    }
    visit(0, 0, []);

    const duplicateSurfaceAnchors = new Set(anchors).size !== anchors.length;
    const ambiguous = paths.length > 1
      || duplicateSurfaceAnchors
      || occurrences.some((items) => items.length > 1);
    return {
      matches: paths[0] || null,
      ambiguous,
      failed: paths.length === 0,
    };
  }

  function getReadingCandidates(char, getCandidates) {
    const candidates = typeof getCandidates === "function" ? getCandidates(char) : [];
    return [...new Set((candidates || []).map((candidate) => toHiragana(String(candidate))).filter(Boolean))]
      .sort((left, right) => right.length - left.length);
  }

  function splitReadingByCandidates(surface, reading, getCandidates) {
    const chars = Array.from(surface || "");
    const target = toHiragana(reading);
    if (!chars.length || !target) {
      return null;
    }

    const paths = [];
    function visit(charIndex, readingIndex, path) {
      if (paths.length >= 2) {
        return;
      }
      if (charIndex === chars.length) {
        if (readingIndex === target.length) {
          paths.push(path);
        }
        return;
      }

      const candidates = getReadingCandidates(chars[charIndex], getCandidates);
      if (chars.length === 1) {
        candidates.unshift(target);
      }
      for (const candidate of [...new Set(candidates)]) {
        if (!target.startsWith(candidate, readingIndex)) {
          continue;
        }
        visit(
          charIndex + 1,
          readingIndex + candidate.length,
          [...path, { surface: chars[charIndex], reading: candidate }],
        );
      }
    }
    visit(0, 0, []);
    return paths.length === 1 ? paths[0] : null;
  }

  function createAnnotation(run, reading, sourceIndices, getCandidates, needsReview, reviewReason) {
    const normalizedReading = toHiragana(reading);
    const range = getSourceRange(sourceIndices, run.start, run.end);
    const splitPieces = !needsReview && normalizedReading
      ? splitReadingByCandidates(run.surface, normalizedReading, getCandidates)
      : null;
    const resolvedReview = Boolean(needsReview || !normalizedReading || !splitPieces);
    const pieces = splitPieces
      ? splitPieces.map((piece, index) => {
        const pieceRange = getSourceRange(sourceIndices, run.start + index, run.start + index + 1);
        return { ...piece, ...pieceRange };
      })
      : [];

    return {
      id: "reading-" + range.sourceStart + "-" + range.sourceEnd,
      surface: run.surface,
      reading: normalizedReading,
      mode: splitPieces ? "split" : "group",
      pieces,
      sourceIndices: sourceIndices.slice(run.start, run.end),
      sourceStart: range.sourceStart,
      sourceEnd: range.sourceEnd,
      needsReview: resolvedReview,
      manual: false,
      reviewReason: resolvedReview ? (reviewReason || "reading-split-unavailable") : "",
    };
  }

  function createFallbackAnnotations(units, start, end, reason, isKanjiFn) {
    const annotations = [];
    let runStart = -1;
    for (let index = start; index <= end; index += 1) {
      const isRunKanji = index < end && isKanjiFn(units[index]?.char || "");
      if (isRunKanji && runStart < 0) {
        runStart = index;
      }
      if ((!isRunKanji || index === end) && runStart >= 0) {
        const entries = units.slice(runStart, index);
        const sourceIndices = entries.map((entry, offset) => getUnitInputIndex(entry, runStart + offset));
        const surface = entries.map((entry) => entry.char).join("");
        annotations.push(createAnnotation(
          { start: 0, end: entries.length, surface },
          "",
          sourceIndices,
          null,
          true,
          reason,
        ));
        runStart = -1;
      }
    }
    return annotations;
  }

  function findNextTokenStart(units, tokens, fromTokenIndex, cursor) {
    for (let index = fromTokenIndex; index < tokens.length; index += 1) {
      const surface = String(tokens[index]?.surface_form || "");
      if (!surface) {
        continue;
      }
      const start = findTokenStart(units, cursor, surface);
      if (start >= 0) {
        return start;
      }
    }
    return -1;
  }

  function pushFallbackItem(items, units, start, end, reason, isKanjiFn) {
    if (end <= start) {
      return;
    }
    const annotations = createFallbackAnnotations(units, start, end, reason, isKanjiFn);
    if (annotations.length) {
      items.push({ type: "fallback", start, end, annotations, reason });
    }
  }

  function alignTokenPositions(units, tokens, options = {}) {
    const entries = Array.isArray(units) ? units : [];
    const tokenList = Array.isArray(tokens) ? tokens : [];
    const isKanjiFn = options.isKanji || isKanji;
    const items = [];
    let cursor = 0;

    for (let tokenIndex = 0; tokenIndex < tokenList.length; tokenIndex += 1) {
      const token = tokenList[tokenIndex] || {};
      const surface = String(token.surface_form || "");
      if (!surface) {
        continue;
      }

      const tokenStart = findTokenStart(entries, cursor, surface);
      if (tokenStart < 0) {
        const nextTokenStart = findNextTokenStart(entries, tokenList, tokenIndex + 1, cursor);
        const fallbackEnd = nextTokenStart >= 0 ? nextTokenStart : entries.length;
        pushFallbackItem(items, entries, cursor, fallbackEnd, "token-position-mismatch", isKanjiFn);
        cursor = Math.max(cursor, fallbackEnd);
        continue;
      }

      if (tokenStart > cursor) {
        pushFallbackItem(items, entries, cursor, tokenStart, "token-gap", isKanjiFn);
      }
      const tokenEnd = tokenStart + Array.from(surface).length;
      items.push({ type: "token", token, surface, start: tokenStart, end: tokenEnd });
      cursor = tokenEnd;
    }

    pushFallbackItem(items, entries, cursor, entries.length, "token-tail", isKanjiFn);
    return { items, cursor };
  }

  function alignSurfaceReading(surface, reading, options = {}) {
    const text = String(surface || "");
    const chars = Array.from(text);
    const normalizedReading = toHiragana(reading);
    const isKanjiFn = options.isKanji || isKanji;
    const parts = getSurfaceParts(chars, isKanjiFn);
    const kanjiRuns = parts.filter((part) => part.kind === "kanji");
    if (!kanjiRuns.length) {
      return [];
    }

    const sourceIndices = normalizeSourceIndices(chars, options.sourceIndices);
    const getCandidates = options.getCandidates;
    const runReadings = new Map();
    let needsReview = false;
    let reviewReason = "";
    const anchorRuns = parts.filter((part) => part.kind === "kana");

    if (!anchorRuns.length) {
      if (parts.length === 1 && parts[0].kind === "kanji") {
        runReadings.set(kanjiRuns[0].start, normalizedReading);
      } else {
        needsReview = true;
        reviewReason = "surface-structure";
      }
    } else {
      const anchorAlignment = findAnchorAlignment(anchorRuns, normalizedReading);
      if (anchorAlignment.failed) {
        needsReview = true;
        reviewReason = "anchor-not-found";
      } else {
        if (anchorAlignment.ambiguous) {
          needsReview = true;
          reviewReason = "anchor-ambiguous";
        }

        const matches = anchorAlignment.matches;
        for (let gapIndex = 0; gapIndex <= anchorRuns.length; gapIndex += 1) {
          const surfaceStart = gapIndex === 0 ? 0 : anchorRuns[gapIndex - 1].end;
          const surfaceEnd = gapIndex === anchorRuns.length
            ? chars.length
            : anchorRuns[gapIndex].start;
          const readingStart = gapIndex === 0 ? 0 : matches[gapIndex - 1].end;
          const readingEnd = gapIndex === anchorRuns.length
            ? normalizedReading.length
            : matches[gapIndex].start;
          const gapReading = normalizedReading.slice(readingStart, readingEnd);
          const gapRuns = kanjiRuns.filter((run) => run.start >= surfaceStart && run.end <= surfaceEnd);
          const hasOtherSurface = parts.some((part) => (
            part.kind === "other" && part.start >= surfaceStart && part.end <= surfaceEnd
          ));

          if (gapRuns.length === 1) {
            runReadings.set(gapRuns[0].start, gapReading);
            if (hasOtherSurface || !gapReading) {
              needsReview = true;
              reviewReason ||= hasOtherSurface ? "surface-structure" : "empty-reading";
            }
          } else if (gapReading || gapRuns.length) {
            needsReview = true;
            reviewReason ||= "surface-structure";
          }
        }
      }
    }

    return kanjiRuns.map((run) => {
      const runReading = runReadings.get(run.start) || "";
      return createAnnotation(
        run,
        runReading,
        sourceIndices,
        getCandidates,
        needsReview || !runReading,
        reviewReason,
      );
    });
  }

  return {
    alignSurfaceReading,
    alignTokenPositions,
    findAnchorAlignment,
    findTokenStart,
    isKana,
    isKanji,
    splitReadingByCandidates,
    toHiragana,
  };
});
