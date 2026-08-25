(function attachReadingCorrections(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.KANJI_READING_CORRECTIONS = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, (root) => {
  const SCHEMA_VERSION = 1;
  const DEFAULT_STORAGE_KEY = "kanji-reading-corrections-v1";
  const DEFAULT_MAX_ENTRIES = 1500;

  function toHiragana(text) {
    return Array.from(String(text || ""), (char) => {
      const codePoint = char.codePointAt(0);
      return codePoint >= 0x30a1 && codePoint <= 0x30f6
        ? String.fromCodePoint(codePoint - 0x60)
        : char;
    }).join("");
  }

  function makeCorrectionKey(surface, sourceReading) {
    return `${String(surface || "")}\u0000${toHiragana(sourceReading)}`;
  }

  function normalizePieces(pieces) {
    if (!Array.isArray(pieces)) {
      return [];
    }
    return pieces.map((piece) => ({
      surface: String(piece?.surface || ""),
      reading: toHiragana(piece?.reading || ""),
    }));
  }

  function isValidSplitPieces(surface, reading, pieces) {
    return pieces.length > 0
      && pieces.every((piece) => piece.surface && piece.reading)
      && pieces.map((piece) => piece.surface).join("") === surface
      && pieces.map((piece) => piece.reading).join("") === reading;
  }

  function normalizeEntry(entry, expectedKey = "") {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const surface = String(entry.surface || "");
    const sourceReading = toHiragana(entry.sourceReading || "");
    const reading = toHiragana(entry.reading || "");
    const mode = entry.mode === "split" ? "split" : "group";
    const pieces = normalizePieces(entry.pieces);
    const key = makeCorrectionKey(surface, sourceReading);
    if (!surface || !sourceReading || !reading || (expectedKey && key !== expectedKey)) {
      return null;
    }
    if (mode === "split" && !isValidSplitPieces(surface, reading, pieces)) {
      return null;
    }
    return {
      surface,
      sourceReading,
      reading,
      mode,
      pieces,
      needsReview: Boolean(entry.needsReview),
      updatedAt: Number.isFinite(Number(entry.updatedAt)) ? Number(entry.updatedAt) : 0,
    };
  }

  function cloneEntry(entry) {
    return entry ? {
      ...entry,
      pieces: entry.pieces.map((piece) => ({ ...piece })),
    } : null;
  }

  function createStore(options = {}) {
    const storage = options.storage || root?.localStorage || null;
    const storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
    const maxEntries = Math.max(1, Number(options.maxEntries) || DEFAULT_MAX_ENTRIES);
    const now = typeof options.now === "function" ? options.now : () => Date.now();
    const entries = new Map();
    let loaded = false;
    let clock = 0;

    function evict() {
      while (entries.size > maxEntries) {
        let oldestKey = null;
        let oldestValue = Infinity;
        for (const [key, entry] of entries) {
          if (entry.updatedAt < oldestValue) {
            oldestKey = key;
            oldestValue = entry.updatedAt;
          }
        }
        if (oldestKey === null) {
          break;
        }
        entries.delete(oldestKey);
      }
    }

    function persist() {
      if (!storage || typeof storage.setItem !== "function") {
        return;
      }
      try {
        const serializable = {};
        for (const [key, entry] of entries) {
          serializable[key] = entry;
        }
        storage.setItem(storageKey, JSON.stringify({ version: SCHEMA_VERSION, entries: serializable }));
      } catch {
        // Storage may be unavailable or full; corrections still work in memory.
      }
    }

    function load() {
      if (loaded) {
        return;
      }
      loaded = true;
      if (!storage || typeof storage.getItem !== "function") {
        return;
      }
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw);
        if (parsed?.version !== SCHEMA_VERSION || !parsed.entries || typeof parsed.entries !== "object") {
          return;
        }
        for (const [key, value] of Object.entries(parsed.entries)) {
          const entry = normalizeEntry(value, key);
          if (!entry) {
            continue;
          }
          clock = Math.max(clock, entry.updatedAt);
          entries.set(key, entry);
        }
        evict();
      } catch {
        // Corrupt local data is ignored without affecting the worksheet.
      }
    }

    function touch(entry) {
      clock = Math.max(clock + 1, Number(now()) || 0);
      entry.updatedAt = clock;
    }

    function lookup(surface, sourceReading) {
      load();
      const key = makeCorrectionKey(surface, sourceReading);
      const entry = entries.get(key);
      if (!entry) {
        return null;
      }
      touch(entry);
      persist();
      return cloneEntry(entry);
    }

    function record(annotation, sourceReading = annotation?.correctionReading || annotation?.reading) {
      load();
      const surface = String(annotation?.surface || "");
      const normalizedSourceReading = toHiragana(sourceReading);
      const pieces = normalizePieces(annotation?.pieces);
      const mode = annotation?.mode === "split" ? "split" : "group";
      const reading = mode === "split"
        ? pieces.map((piece) => piece.reading).join("")
        : toHiragana(annotation?.reading || "");
      if (!surface || !normalizedSourceReading || !reading) {
        return null;
      }
      const key = makeCorrectionKey(surface, normalizedSourceReading);
      const entry = normalizeEntry({
        surface,
        sourceReading: normalizedSourceReading,
        reading,
        mode,
        pieces,
        needsReview: Boolean(annotation?.needsReview),
        updatedAt: 0,
      }, key);
      if (!entry) {
        return null;
      }
      touch(entry);
      entries.set(key, entry);
      evict();
      persist();
      return cloneEntry(entry);
    }

    function clear() {
      entries.clear();
      if (storage && typeof storage.removeItem === "function") {
        try {
          storage.removeItem(storageKey);
        } catch {
          // Ignore storage failures; the in-memory store is still reset.
        }
      }
    }

    function getEntries() {
      load();
      return [...entries.values()].sort((left, right) => left.updatedAt - right.updatedAt).map(cloneEntry);
    }

    return {
      clear,
      getEntries,
      lookup,
      makeCorrectionKey,
      record,
      size: () => {
        load();
        return entries.size;
      },
    };
  }

  return {
    DEFAULT_STORAGE_KEY,
    SCHEMA_VERSION,
    createStore,
    makeCorrectionKey,
    normalizeEntry,
    toHiragana,
  };
});
