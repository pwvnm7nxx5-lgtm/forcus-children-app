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

  const NON_WORD_TOKEN_POS = new Set(["助詞", "助動詞", "記号", "フィラー", "接続詞"]);

  function isMergeBoundaryToken(token) {
    const surface = String(token?.surface_form || token?.surface || "");
    const pos = String(token?.pos || "");
    return !surface
      || NON_WORD_TOKEN_POS.has(pos)
      || /[\s。、，．,.！？!?「」『』（）()［］【】〈〉《》・…]/u.test(surface);
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

  function normalizeExactPieces(surface, reading, exactPieces) {
    const chars = Array.from(surface || "");
    const target = toHiragana(reading);
    if (!chars.length || !target || !Array.isArray(exactPieces) || !exactPieces.length) {
      return null;
    }

    let surfaceIndex = 0;
    let readingIndex = 0;
    const pieces = exactPieces.map((piece) => {
      const pieceSurface = String(piece?.surface || "");
      const pieceReading = toHiragana(piece?.reading || "");
      const pieceChars = Array.from(pieceSurface);
      if (
        !pieceChars.length
        || !pieceReading
        || chars.slice(surfaceIndex, surfaceIndex + pieceChars.length).join("") !== pieceSurface
        || !target.startsWith(pieceReading, readingIndex)
      ) {
        return null;
      }
      surfaceIndex += pieceChars.length;
      readingIndex += pieceReading.length;
      return { surface: pieceSurface, reading: pieceReading };
    });
    return pieces.every(Boolean) && surfaceIndex === chars.length && readingIndex === target.length
      ? pieces
      : null;
  }

  function splitReadingByCandidates(surface, reading, getCandidates, getExactWordReading) {
    const chars = Array.from(surface || "");
    const target = toHiragana(reading);
    if (!chars.length || !target) {
      return null;
    }

    if (typeof getExactWordReading === "function") {
      const exactPieces = normalizeExactPieces(
        surface,
        target,
        getExactWordReading(surface, target),
      );
      if (exactPieces) {
        return exactPieces;
      }
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

  function createAnnotation(
    run,
    reading,
    sourceIndices,
    getCandidates,
    getExactWordReading,
    needsReview,
    reviewReason,
  ) {
    const normalizedReading = toHiragana(reading);
    const range = getSourceRange(sourceIndices, run.start, run.end);
    const splitPieces = !needsReview && normalizedReading
      ? splitReadingByCandidates(run.surface, normalizedReading, getCandidates, getExactWordReading)
      : null;
    const resolvedReview = Boolean(needsReview || !normalizedReading || !splitPieces);
    let pieceSurfaceIndex = 0;
    const pieces = splitPieces
      ? splitPieces.map((piece) => {
        const pieceLength = Array.from(piece.surface).length;
        const pieceRange = getSourceRange(
          sourceIndices,
          run.start + pieceSurfaceIndex,
          run.start + pieceSurfaceIndex + pieceLength,
        );
        const normalizedPiece = {
          ...piece,
          sourceIndices: sourceIndices.slice(
            run.start + pieceSurfaceIndex,
            run.start + pieceSurfaceIndex + pieceLength,
          ),
          ...pieceRange,
        };
        pieceSurfaceIndex += pieceLength;
        return normalizedPiece;
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

  function alignExactSurfaceReading(surface, reading, exactPieces, sourceIndices, options = {}) {
    const text = String(surface || "");
    const normalizedReading = toHiragana(reading);
    const pieces = normalizeExactPieces(text, normalizedReading, exactPieces);
    if (!pieces) {
      return null;
    }

    const chars = Array.from(text);
    const normalizedSourceIndices = normalizeSourceIndices(chars, sourceIndices);
    const parts = getSurfaceParts(chars, options.isKanji || isKanji);
    const kanjiRuns = parts.filter((part) => part.kind === "kanji");
    const ranges = [];
    let surfaceIndex = 0;
    for (const piece of pieces) {
      const length = Array.from(piece.surface).length;
      ranges.push({
        ...piece,
        start: surfaceIndex,
        end: surfaceIndex + length,
      });
      surfaceIndex += length;
    }

    const annotations = [];
    for (const run of kanjiRuns) {
      const runPieces = ranges.filter((piece) => piece.start >= run.start && piece.end <= run.end);
      const coveredLength = runPieces.reduce((total, piece) => total + (piece.end - piece.start), 0);
      const crossesRun = ranges.some((piece) => (
        (piece.start < run.start && piece.end > run.start)
        || (piece.start < run.end && piece.end > run.end)
      ));
      if (crossesRun || coveredLength !== run.end - run.start) {
        return null;
      }

      const grouped = Boolean(options.forceReview)
        || runPieces.some((piece) => piece.end - piece.start > 1);
      const runReading = runPieces.map((piece) => piece.reading).join("");
      const range = getSourceRange(normalizedSourceIndices, run.start, run.end);
      const review = Boolean(options.forceReview);
      annotations.push({
        id: "reading-" + range.sourceStart + "-" + range.sourceEnd,
        surface: run.surface,
        reading: runReading,
        mode: grouped ? "group" : "split",
        pieces: grouped
          ? []
          : runPieces.map((piece) => {
            const pieceRange = getSourceRange(normalizedSourceIndices, piece.start, piece.end);
            return {
              surface: piece.surface,
              reading: piece.reading,
              sourceIndices: normalizedSourceIndices.slice(piece.start, piece.end),
              sourceStart: pieceRange.sourceStart,
              sourceEnd: pieceRange.sourceEnd,
            };
          }),
        sourceIndices: normalizedSourceIndices.slice(run.start, run.end),
        sourceStart: range.sourceStart,
        sourceEnd: range.sourceEnd,
        needsReview: review,
        manual: false,
        reviewReason: review ? (options.reviewReason || "forced-review") : "",
      });
    }
    return annotations.length ? annotations : null;
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

  function clipTokenItem(item, units, start, end) {
    if (end <= start) {
      return null;
    }
    const surface = units.slice(start, end).map((entry) => entry?.char || "").join("");
    if (!surface) {
      return null;
    }
    const isWholeToken = start === item.start && end === item.end;
    const token = {
      ...item.token,
      surface_form: surface,
      reading: isWholeToken ? item.token?.reading || "" : "",
    };
    return {
      ...item,
      token,
      surface,
      start,
      end,
    };
  }

  function normalizeExactMatches(items, units, matches) {
    const tokenItems = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item?.type === "token");
    const normalized = (Array.isArray(matches) ? matches : [])
      .map((match) => {
        const start = Number(match?.start);
        const end = Number(match?.end);
        const surface = String(match?.surface || "");
        const reading = toHiragana(match?.reading || "");
        const owner = tokenItems.find(({ item }) => item.start < end && item.end > start);
        return {
          ...match,
          start,
          end,
          surface,
          reading,
          ownerIndex: owner?.index ?? -1,
        };
      })
      .filter((match) => (
        Number.isInteger(match.start)
        && Number.isInteger(match.end)
        && match.start >= 0
        && match.end > match.start
        && match.end <= units.length
        && match.surface
        && match.reading
        && match.ownerIndex >= 0
      ))
      .sort((left, right) => left.start - right.start || right.end - left.end);

    const result = [];
    let coveredUntil = -1;
    for (const match of normalized) {
      if (match.start < coveredUntil) {
        continue;
      }
      result.push(match);
      coveredUntil = match.end;
    }
    return result;
  }

  function insertExactSurfaceMatches(items, units, matches) {
    const entries = Array.isArray(items) ? items : [];
    const sourceUnits = Array.isArray(units) ? units : [];
    const exactMatches = normalizeExactMatches(entries, sourceUnits, matches);
    if (!exactMatches.length) {
      return entries;
    }

    const output = [];
    entries.forEach((item, itemIndex) => {
      if (item?.type !== "token") {
        output.push(item);
        return;
      }

      const overlaps = exactMatches.filter((match) => item.start < match.end && item.end > match.start);
      if (!overlaps.length) {
        output.push(item);
        return;
      }

      const boundaries = new Set([item.start, item.end]);
      overlaps.forEach((match) => {
        if (match.start > item.start && match.start < item.end) boundaries.add(match.start);
        if (match.end > item.start && match.end < item.end) boundaries.add(match.end);
      });
      const sortedBoundaries = [...boundaries].sort((left, right) => left - right);
      for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
        const start = sortedBoundaries[index];
        const end = sortedBoundaries[index + 1];
        const covering = overlaps.find((match) => match.start <= start && match.end >= end);
        if (covering) {
          if (covering.ownerIndex === itemIndex && start === covering.start) {
            const sourceIndices = sourceUnits
              .slice(covering.start, covering.end)
              .map((unit, offset) => getUnitInputIndex(unit, covering.start + offset));
            const sourceRange = getSourceRange(sourceIndices, 0, sourceIndices.length);
            output.push({
              ...item,
              start: covering.start,
              end: covering.end,
              surface: covering.surface,
              sourceIndices,
              sourceStart: sourceRange.sourceStart,
              sourceEnd: sourceRange.sourceEnd,
              readingKind: "exact",
              dictionaryMatch: covering,
              token: {
                ...item.token,
                surface_form: covering.surface,
                reading: covering.reading,
              },
            });
          }
          continue;
        }
        const clipped = clipTokenItem(item, sourceUnits, start, end);
        if (clipped) output.push(clipped);
      }
    });
    return output;
  }

  function mergeReadingTokenItems(items, getMatch) {
    const entries = Array.isArray(items) ? items : [];
    if (typeof getMatch !== "function") {
      return entries;
    }

    const merged = [];
    for (let index = 0; index < entries.length; index += 1) {
      const first = entries[index];
      if (first?.type !== "token") {
        merged.push(first);
        continue;
      }
      if (isMergeBoundaryToken(first.token)) {
        merged.push(first);
        continue;
      }

      let surface = "";
      let reading = "";
      let previous = null;
      let best = null;

      for (let candidateIndex = index; candidateIndex < entries.length; candidateIndex += 1) {
        const candidate = entries[candidateIndex];
        if (candidate?.type !== "token") {
          break;
        }
        if (candidateIndex > index && isMergeBoundaryToken(candidate.token)) {
          break;
        }
        if (previous && candidate.start !== previous.end) {
          break;
        }

        surface += String(candidate.surface || "");
        reading += toHiragana(candidate.token?.reading || "");
        const match = getMatch(surface, reading);
        if (candidateIndex > index && match) {
          best = {
            endIndex: candidateIndex,
            end: candidate.end,
            kind: match.kind || "exact",
            reading,
            surface,
          };
        }
        previous = candidate;
      }

      if (!best) {
        merged.push(first);
        continue;
      }

      merged.push({
        ...first,
        end: best.end,
        readingKind: best.kind,
        surface: best.surface,
        token: {
          ...first.token,
          surface_form: best.surface,
          reading: best.reading,
        },
      });
      index = best.endIndex;
    }
    return merged;
  }

  function alignSurfaceReading(surface, reading, options = {}) {
    const text = String(surface || "");
    const chars = Array.from(text);
    const normalizedReading = toHiragana(reading);
    const isKanjiFn = options.isKanji || isKanji;
    const getExactWordReading = options.getExactWordReading;
    if (typeof getExactWordReading === "function") {
      const exactAnnotations = alignExactSurfaceReading(
        text,
        normalizedReading,
        getExactWordReading(text, normalizedReading),
        options.sourceIndices,
        options,
      );
      if (exactAnnotations) {
        return exactAnnotations;
      }
    }
    const parts = getSurfaceParts(chars, isKanjiFn);
    const kanjiRuns = parts.filter((part) => part.kind === "kanji");
    if (!kanjiRuns.length) {
      return [];
    }

    const sourceIndices = normalizeSourceIndices(chars, options.sourceIndices);
    const getCandidates = options.getCandidates;
    const runReadings = new Map();
    let needsReview = Boolean(options.forceReview);
    let reviewReason = needsReview ? (options.reviewReason || "forced-review") : "";
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
        getExactWordReading,
        needsReview || !runReading,
        reviewReason,
      );
    });
  }

  return {
    alignSurfaceReading,
    alignTokenPositions,
    insertExactSurfaceMatches,
    findAnchorAlignment,
    findTokenStart,
    isKana,
    isKanji,
    mergeReadingTokenItems,
    normalizeExactPieces,
    alignExactSurfaceReading,
    splitReadingByCandidates,
    toHiragana,
  };
});
