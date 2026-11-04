(() => {
  'use strict';
  const { vocabulary, categories } = window.PictureWordVocabulary;
  const legacyIds = window.PictureWordLegacyIds;
  const G = window.PictureWordGenerator;
  const byId = new Map(vocabulary.map(word => [word.id, word]));
  const key = 'picture-word-matching:v1';
  const $ = id => document.getElementById(id);
  const fields = ['worksheetTitle', 'studentName', 'worksheetDate', 'scriptMode', 'category', 'pairCount', 'fontSize'];
  let sheets = [], excluded = new Set(), loadedSignature = '', failedImages = new Set(), generationError = false;
  const svgNS = 'http://www.w3.org/2000/svg';
  Object.entries(categories).forEach(([value, text]) => $('category').add(new Option(text, value)));
  function settings() {
    return Object.fromEntries(fields.map(id => [id, $(id).value]));
  }
  function pool() { return vocabulary.filter(word => !excluded.has(word.id) && ($('category').value === 'all' || word.category === $('category').value)); }
  function signature() { return JSON.stringify([$('category').value, Number($('pairCount').value), [...excluded].sort()]); }
  function setStatus(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
  function save() {
    try { localStorage.setItem(key, JSON.stringify({ catalogVersion: 2, settings: settings(), excluded: [...excluded], sheets })); }
    catch { setStatus('このブラウザでは保存できません。画面を閉じると問題が失われます。', true); }
  }
  function restore() {
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      if (!stored || typeof stored !== 'object') return;
      fields.forEach(id => {
        const field = $(id), value = stored.settings?.[id];
        if (typeof value !== 'string') return;
        if (field.tagName === 'SELECT') {
          if ([...field.options].some(option => option.value === value)) field.value = value;
        } else field.value = value.slice(0, Number(field.maxLength));
      });
      const resolve = id => typeof id === 'string' ? (byId.has(id) ? id : Object.hasOwn(legacyIds, id) ? legacyIds[id] : null) : null;
      excluded = new Set(Array.isArray(stored.excluded) ? stored.excluded.map(resolve).filter(Boolean) : []);
      const allowed = new Set(pool().map(word => word.id));
      const drafts = Array.isArray(stored.sheets) ? stored.sheets.slice(0, 30).map(sheet => ({
        ids: Array.isArray(sheet?.ids) ? sheet.ids.map(resolve) : [],
        words: Array.isArray(sheet?.words) ? sheet.words.map(resolve) : [],
      })) : [];
      const valid = sheet => G.validSheet(sheet, allowed, Number($('pairCount').value))
        && sheet.ids.every(id => byId.get(id).conflicts.every(other => !sheet.ids.includes(other)));
      const used = new Set(drafts.filter(valid).flatMap(sheet => sheet.ids));
      sheets = drafts.map(sheet => valid(sheet) ? sheet : G.makeSheet(pool(), Number($('pairCount').value), used));
      $('catalogNotice').hidden = stored.catalogVersion === 2;
      loadedSignature = signature();
    } catch { /* Invalid or unavailable storage starts a fresh worksheet. */ }
  }
  function ensureSheets(count) {
    if (loadedSignature !== signature()) { sheets = []; loadedSignature = signature(); }
    const candidates = pool(), pairs = Number($('pairCount').value);
    if (candidates.length < pairs) throw new Error(`出題できることばが${candidates.length}語です。${pairs}語以上選ぶか組数を減らしてください。`);
    const used = new Set(sheets.flatMap(sheet => sheet.ids));
    while (sheets.length < count) sheets.push(G.makeSheet(candidates, pairs, used));
    return sheets.slice(0, count);
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function picture(word, lazy = false) {
    const art = word.art;
    const tileWidth = art.width / art.columns, tileHeight = art.height / art.rows;
    const cropWidth = tileWidth * (1 + art.leftBleed - art.rightTrim), cropX = tileWidth * (art.column - art.leftBleed);
    const frame = element('span', 'illustration');
    frame.style.setProperty('--art-aspect', cropWidth / tileHeight);
    frame.dataset.illustrationId = word.id;
    const img = element('img'); img.src = word.image; img.alt = word.hiragana; img.width = art.width; img.height = art.height; img.decoding = 'async';
    img.style.width = `${art.width / cropWidth * 100}%`;
    img.style.height = `${art.rows * 100}%`;
    img.style.left = `${-cropX / cropWidth * 100}%`;
    img.style.top = `${-art.row * 100}%`;
    if (lazy) img.loading = 'lazy';
    img.addEventListener('error', () => {
      failedImages.add(word.id); $('printBtn').disabled = true;
      setStatus('絵を読み込めませんでした。再読み込みしてから印刷してください。', true);
    });
    frame.append(img);
    return frame;
  }
  function pageFor(sheet, index, answer) {
    const page = element('section', `print-page${answer ? ' answer-page' : ''}`);
    page.dataset.sheetIndex = index;
    const header = element('header', 'matching-header');
    header.append(element('h2', '', $('worksheetTitle').value || 'せんで むすぼう'));
    const meta = element('div', 'matching-meta');
    meta.append(element('p', '', `なまえ　${$('studentName').value}`), element('p', '', `ひづけ　${$('worksheetDate').value}`));
    header.append(meta);
    const label = element('p', `sheet-label${answer ? ' answer' : ''}`, `${answer ? 'こたえ' : 'もんだい'} ${index + 1}`);
    const instructions = element('p', 'instructions', 'えと ことばを せんで むすぼう');
    const board = element('div', 'matching-board');
    const count = sheet.ids.length;
    board.style.setProperty('--pairs', count);
    board.style.setProperty('--word-font', `${7 * Number($('fontSize').value) / 100}mm`);
    const pics = element('div', 'picture-row'), words = element('div', 'word-row');
    const modes = G.wordScripts(count, $('scriptMode').value, () => .5);
    sheet.ids.forEach(id => {
      const frame = element('div', 'picture-frame'); frame.dataset.wordId = id;
      frame.append(picture(byId.get(id))); pics.append(frame);
    });
    sheet.words.forEach((id, i) => {
      const word = byId.get(id), frame = element('div', 'word-frame');
      frame.dataset.wordId = id; frame.dataset.script = modes[i];
      frame.style.setProperty('--chars', word.hiragana.length);
      frame.append(element('span', '', modes[i] === 'katakana' ? G.katakana(word.hiragana) : word.hiragana)); words.append(frame);
    });
    // Align centres to the actual grid tracks including its fixed 3mm gutters.
    const centre = i => `calc((100% - ${(count - 1) * 3}mm) / ${count} * ${i + .5} + ${i * 3}mm)`;
    const connections = document.createElementNS(svgNS, 'svg');
    connections.classList.add('connectors'); connections.setAttribute('aria-hidden', 'true');
    G.answerPairs(sheet).forEach(({ id, pictureIndex, wordIndex }) => {
      for (const [i, y, kind] of [[pictureIndex, '35%', 'picture'], [wordIndex, '78%', 'word']]) {
        const dot = element('span', `matching-dot ${kind}-dot`);
        dot.style.left = centre(i); dot.style.top = y; dot.dataset.wordId = id; board.append(dot);
      }
      if (answer) {
        const line = document.createElementNS(svgNS, 'line');
        line.classList.add('answer-connection'); line.dataset.wordId = id;
        // Percent coordinates are updated to measured millimetre-gutter centres after layout.
        line.dataset.from = pictureIndex; line.dataset.to = wordIndex;
        connections.append(line);
      }
    });
    board.append(connections, pics, words);
    const footer = element('footer', 'print-footer');
    footer.append(element('span', '', `${count}くみ`), element('span', '', '絵とことばのマッチング'));
    const content = element('div', 'print-page-content');
    content.append(header, instructions, label, board, footer);
    page.append(content);
    return page;
  }
  function fitConnections() {
    const scale = (window.__printAdjustmentsGetSettings?.().scalePct || 100) / 100;
    document.querySelectorAll('.matching-board').forEach(board => {
      board.style.setProperty('--matching-scale', scale);
      const rect = board.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const svg = board.querySelector('.connectors');
      svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
      const pictures = [...board.querySelectorAll('.picture-dot')], words = [...board.querySelectorAll('.word-dot')];
      const centre = dot => { const r = dot.getBoundingClientRect(); return { x: (r.left + r.width / 2) - rect.left, y: (r.top + r.height / 2) - rect.top }; };
      board.querySelectorAll('.answer-connection').forEach(line => {
        const from = centre(pictures[Number(line.dataset.from)]), to = centre(words.find(dot => dot.dataset.wordId === line.dataset.wordId));
        for (const [attribute, value] of Object.entries({ x1: from.x, y1: from.y, x2: to.x, y2: to.y })) line.setAttribute(attribute, value);
      });
    });
  }
  function render({ sheetCount = 1, includeAnswers = true } = {}) {
    try {
      generationError = false;
      const sets = ensureSheets(G.clamp(sheetCount, 1, 30, 1));
      const pages = sets.flatMap((sheet, i) => includeAnswers ? [pageFor(sheet, i, false), pageFor(sheet, i, true)] : [pageFor(sheet, i, false)]);
      $('pages').replaceChildren(...pages); $('pageCount').textContent = `${pages.length}枚`;
      $('printBtn').disabled = failedImages.size > 0;
      if (!failedImages.size) setStatus('絵の下の点とことばの上の点を結ぶプリントです。');
      $('poolInfo').textContent = `全${vocabulary.length}語のうち${pool().length}語から出題します。複数枚では使っていないことばを優先します。`;
      save(); requestAnimationFrame(fitConnections);
    } catch (error) {
      generationError = true;
      $('pages').replaceChildren(); $('pageCount').textContent = '0枚'; $('printBtn').disabled = true;
      setStatus(error.message, true); save();
    }
    $('bankCount').textContent = `（${vocabulary.length - excluded.size}/${vocabulary.length}語）`;
    return true;
  }
  const printSettings = () => window.__printAdjustmentsGetSettings?.() || { sheetCount: 1, includeAnswers: $('includeAnswers').checked };
  function redraw() { render(printSettings()); window.__printAdjustmentsRefresh?.(); }
  function visibleWords() {
    const query = $('wordSearch').value.trim();
    return vocabulary.filter(word => ($('category').value === 'all' || word.category === $('category').value)
      && (!query || word.hiragana.includes(query) || G.katakana(word.hiragana).includes(query)));
  }
  function renderBank() {
    if (!$('wordBank').open) return;
    const nodes = visibleWords().map(word => {
      const label = element('label', 'bank-word'), checkbox = element('input');
      checkbox.type = 'checkbox'; checkbox.checked = !excluded.has(word.id); checkbox.dataset.wordId = word.id;
      const content = element('span'); content.append(picture(word, true), element('span', '', word.hiragana));
      label.append(checkbox, content); return label;
    });
    $('bankList').replaceChildren(...(nodes.length ? nodes : [element('p', 'help', 'ことばが見つかりません。')]));
  }
  fields.forEach(id => $(id).addEventListener($(id).tagName === 'SELECT' ? 'change' : 'input', () => { redraw(); if (id === 'category') renderBank(); }));
  $('wordBank').addEventListener('toggle', renderBank);
  $('wordSearch').addEventListener('input', renderBank);
  $('bankList').addEventListener('change', event => {
    const input = event.target;
    if (!input.matches('input[data-word-id]')) return;
    if (input.checked) excluded.delete(input.dataset.wordId); else excluded.add(input.dataset.wordId);
    redraw();
  });
  for (const [id, select] of [['selectVisible', true], ['excludeVisible', false]]) $(id).addEventListener('click', () => {
    visibleWords().forEach(word => select ? excluded.delete(word.id) : excluded.add(word.id)); redraw(); renderBank();
  });
  $('resetSelection').addEventListener('click', () => { excluded.clear(); redraw(); renderBank(); });
  $('regenerateBtn').addEventListener('click', () => { sheets = []; redraw(); });
  async function printWorksheet() {
    const button = $('printBtn'); button.disabled = true;
    try {
      await Promise.all([...$('pages').querySelectorAll('img')].map(img => img.decode()));
      if (!failedImages.size && $('pages').children.length) window.print();
    } catch { setStatus('絵を読み込めませんでした。再読み込みしてから印刷してください。', true); }
    finally { button.disabled = failedImages.size > 0 || !$('pages').children.length; }
  }
  $('printBtn').addEventListener('click', printWorksheet);
  window.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p' && !event.altKey) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (generationError || failedImages.size || !$('pages').children.length) {
        setStatus('問題を作成できていません。設定と絵の読み込みを確認してください。', true);
      } else printWorksheet();
    }
  }, true);
  // The shared Ctrl+P handler captures this guard during its own setup.
  const browserPrint = window.print.bind(window);
  window.print = () => {
    if (generationError || failedImages.size || !$('pages').children.length) {
      setStatus('問題を作成できていません。設定と絵の読み込みを確認してください。', true);
      return;
    }
    if ([...$('pages').querySelectorAll('img')].some(img => !img.complete || !img.naturalWidth)) {
      setStatus('絵の読み込みが終わってから印刷してください。', true);
      return;
    }
    browserPrint();
  };
  window.__printAdjustmentsGenerateSheets = render;
  window.__printAdjustmentsExpectedPageCount = ({ sheetCount, includeAnswers }) => generationError || pool().length < Number($('pairCount').value) ? 0 : G.clamp(sheetCount, 1, 30, 1) * (includeAnswers ? 2 : 1);
  window.__printAdjustmentsAfterLayout = () => { fitConnections(); return { changed: false }; };
  window.addEventListener('beforeprint', fitConnections);
  window.addEventListener('print-adjustments:applied', fitConnections);
  window.addEventListener('resize', fitConnections);
  window.PictureWordApp = { getState: () => JSON.parse(JSON.stringify({ settings: settings(), sheets, excluded: [...excluded] })) };
  restore(); render();
})();
