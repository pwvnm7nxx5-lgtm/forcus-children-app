(function (root) {
  const clamp = (value, min, max, fallback) => Number.isFinite(Number(value))
    ? Math.max(min, Math.min(max, Math.floor(Number(value)))) : fallback;
  const katakana = text => text.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function wordScripts(count, mode, random = Math.random) {
    if (mode !== 'mixed') return Array(count).fill(mode === 'katakana' ? 'katakana' : 'hiragana');
    return shuffle(Array.from({ length: count }, (_, i) => i < Math.ceil(count / 2) ? 'hiragana' : 'katakana'), random);
  }
  function makeSheet(pool, count, used = new Set(), random = Math.random) {
    if (!Number.isInteger(count) || count < 2 || count > 6) throw new Error('1ページの組数は2〜6組にしてください。');
    const unique = [...new Map(pool.map(word => [word.id, word])).values()];
    if (unique.length < count) throw new Error(`出題できることばが${unique.length}語です。${count}語以上選んでください。`);
    let chosen;
    for (let attempt = 0; attempt < 24; attempt++) {
      const fresh = shuffle(unique.filter(word => !used.has(word.id)), random);
      const reused = shuffle(unique.filter(word => used.has(word.id)), random);
      const candidates = [...fresh, ...reused];
      // Final attempt favours less ambiguous words even with a constant test RNG.
      if (attempt === 23) candidates.sort((a, b) => (a.conflicts?.length || 0) - (b.conflicts?.length || 0));
      chosen = [];
      for (const word of candidates) {
        if (chosen.every(other => !(word.conflicts || []).includes(other.id) && !(other.conflicts || []).includes(word.id))) chosen.push(word);
        if (chosen.length === count) break;
      }
      if (chosen.length === count) break;
    }
    if (chosen.length < count) throw new Error('名前が似た絵だけでは答えが曖昧になります。出題することばを増やすか組数を減らしてください。');
    const ids = chosen.map(word => word.id);
    ids.forEach(id => used.add(id));
    let words;
    // Bounded rejection avoids fixed points. A cyclic shift always works as fallback.
    for (let attempt = 0; attempt < 24; attempt++) {
      const candidate = shuffle(ids, random);
      if (candidate.every((id, index) => id !== ids[index])) { words = candidate; break; }
    }
    return { ids, words: words || [...ids.slice(1), ids[0]] };
  }
  function validSheet(sheet, allowed, count) {
    if (!sheet || !Array.isArray(sheet.ids) || !Array.isArray(sheet.words)) return false;
    return sheet.ids.length === count && sheet.words.length === count && new Set(sheet.ids).size === count
      && sheet.ids.every(id => allowed.has(id)) && new Set(sheet.words).size === count
      && sheet.words.every(id => sheet.ids.includes(id));
  }
  function answerPairs(sheet) {
    return sheet.ids.map((id, pictureIndex) => ({ id, pictureIndex, wordIndex: sheet.words.indexOf(id) }));
  }
  const api = { clamp, katakana, shuffle, wordScripts, makeSheet, validSheet, answerPairs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PictureWordGenerator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
