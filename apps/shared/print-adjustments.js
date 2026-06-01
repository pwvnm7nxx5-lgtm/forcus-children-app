(function () {
  const storageKey = `print-adjustments:${location.pathname}`;
  const defaults = {
    scalePct: 100,
    sheetCount: 1,
    includeAnswers: true,
    autoFitEnabled: true,
    orientation: "portrait",
    punchGuide: "none",
  };
  const featureOptions = window.__printAdjustmentsOptions || {};
  const autoFitAvailable = featureOptions.autoFit !== false;
  const lightweightPrint = featureOptions.lightweightPrint !== false;
  const legacyScale = { compact: 88, normal: 100, large: 118 };
  let applying = false;
  let observerFrame = 0;
  let resizeFrame = 0;
  let skipNextObserver = false;
  let lastSheetSignature = "";
  let printActive = false;

  function clampNumber(value, min, max, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  }

  function loadSettings() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {}
    const orientation = saved.orientation === "landscape" ? "landscape" : defaults.orientation;
    const punchGuide = ["none", "left", "top"].includes(saved.punchGuide) ? saved.punchGuide : defaults.punchGuide;
    return {
      scalePct: clampNumber(saved.scalePct ?? legacyScale[saved.scale], 70, 200, defaults.scalePct),
      sheetCount: clampNumber(saved.sheetCount, 1, 30, defaults.sheetCount),
      includeAnswers: saved.includeAnswers !== false,
      autoFitEnabled: autoFitAvailable && saved.autoFitEnabled !== false,
      orientation,
      punchGuide,
    };
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {}
  }

  function injectStyles() {
    if (document.querySelector("#printAdjustmentsStyle")) return;
    const style = document.createElement("style");
    style.id = "printAdjustmentsStyle";
    style.textContent = `
      .print-adjust-field {
        grid-column: span 2;
      }
      .print-adjust-control {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 74px;
        gap: 8px;
        align-items: center;
      }
      .print-adjust-control input[type="range"] {
        width: 100%;
      }
      .print-page {
        width: var(--print-page-width, 210mm);
        height: var(--print-page-height, 297mm);
        min-height: var(--print-page-height, 297mm);
        overflow: visible;
        padding: var(--page-margin-y, 14mm) var(--page-margin-x, 13mm);
        position: relative;
      }
      .punch-guide {
        position: absolute;
        z-index: 30;
        display: grid;
        place-items: center;
        width: 8mm;
        height: 8mm;
        color: #111827;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
        pointer-events: none;
      }
      .punch-guide-left {
        left: 1mm;
        top: 50%;
        transform: translateY(-50%);
      }
      .punch-guide-top {
        left: 50%;
        top: 1mm;
        transform: translateX(-50%);
      }
      @media print {
        .print-page {
          width: var(--print-page-width, 210mm);
          height: var(--print-page-height, 297mm);
          min-height: var(--print-page-height, 297mm);
          overflow: visible;
          position: relative;
        }
      }
      .problem-card .answer-line {
        margin-top: var(--answer-gap, 0mm);
      }
      .problem-grid .blank {
        border: 0;
        border-radius: 0;
        background: transparent;
      }
      .problem-card {
        gap: var(--problem-card-gap, 3mm);
        padding-bottom: var(--problem-card-pad, 3mm);
      }
      .visual {
        min-height: var(--visual-min, 24mm);
      }
      .visual .clock,
      .visual svg.clock {
        width: var(--clock-width, var(--visual-width, 132px));
      }
      .visual svg {
        max-width: 100%;
      }
      .print-adjust-answer-hidden {
        display: none !important;
      }
      @media (max-width: 980px) {
        .print-page {
          margin-bottom: var(--print-preview-mobile-overlap, -112mm) !important;
        }
      }
      @media print {
        body.print-lightweight {
          background: #fff !important;
        }
        .pages {
          zoom: 1 !important;
        }
        body.print-lightweight .print-page {
          background: #fff !important;
          box-shadow: none !important;
          filter: none !important;
          -webkit-print-color-adjust: economy;
          print-color-adjust: economy;
        }
        body.print-lightweight .sheet-kind,
        body.print-lightweight .page-hint {
          background: transparent !important;
        }
        .print-page {
          width: var(--print-page-width, 210mm) !important;
          min-height: var(--print-page-height, 297mm) !important;
        }
      }
    `;
    document.head.append(style);
  }

  function ensurePageRuleStyle() {
    let style = document.querySelector("#printPageRuleStyle");
    if (!style) {
      style = document.createElement("style");
      style.id = "printPageRuleStyle";
      document.head.append(style);
    }
    return style;
  }

  function applyPaperSize(settings) {
    const landscape = settings.orientation === "landscape";
    const width = landscape ? "297mm" : "210mm";
    const height = landscape ? "210mm" : "297mm";
    document.documentElement.style.setProperty("--print-page-width", width);
    document.documentElement.style.setProperty("--print-page-height", height);
    document.documentElement.style.setProperty("--print-preview-mobile-overlap", landscape ? "-72mm" : "-112mm");
    document.body.classList.toggle("print-landscape", landscape);
    document.body.classList.toggle("print-portrait", !landscape);
    document.body.classList.toggle("print-lightweight", lightweightPrint);
    ensurePageRuleStyle().textContent = `@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 0; }`;
  }

  function applyPreviewZoom() {
    if (window.matchMedia?.("print").matches) return;
    const preview = document.querySelector(".preview-wrap");
    const pages = document.querySelector("#pages");
    const page = visiblePrintPages()[0] || document.querySelector(".print-page");
    if (!preview || !pages || !page) return;

    pages.style.zoom = "";
    const availableWidth = Math.max(320, preview.clientWidth - 32);
    const pageWidth = page.getBoundingClientRect().width;
    const zoom = pageWidth > availableWidth ? Math.max(0.5, availableWidth / pageWidth) : 1;
    pages.style.zoom = String(Number(zoom.toFixed(3)));
  }

  function schedulePreviewZoom() {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      applyPreviewZoom();
    });
  }

  function createCheckboxControl({ id, label, checked }) {
    const row = document.createElement("label");
    const input = document.createElement("input");
    input.id = id;
    input.type = "checkbox";
    input.checked = checked;
    row.append(input, document.createTextNode(` ${label}`));
    return row;
  }

  function upsertAutoFitControl(settings) {
    let input = document.querySelector("#printAutoFit");
    if (!input) {
      const row = createCheckboxControl({
        id: "printAutoFit",
        label: "A4に収める",
        checked: settings.autoFitEnabled,
      });
      const includeAnswers = document.querySelector("#includeAnswers");
      const checkRow = includeAnswers?.closest(".check-row") || document.querySelector(".check-row");
      if (includeAnswers?.closest("label")) {
        includeAnswers.closest("label").before(row);
      } else if (checkRow) {
        checkRow.prepend(row);
      } else {
        document.querySelector(".settings-grid")?.append(row);
      }
      input = document.querySelector("#printAutoFit");
    }
    if (input) input.checked = settings.autoFitEnabled;
    return input;
  }

  function createOrientationControl(settings) {
    const field = document.createElement("label");
    field.className = "field";
    const text = document.createElement("span");
    text.textContent = "用紙の向き";

    const select = document.createElement("select");
    select.id = "printOrientation";
    [
      ["portrait", "縦向き"],
      ["landscape", "横向き"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    });
    select.value = settings.orientation;
    field.append(text, select);
    return field;
  }

  function upsertOrientationControl(settings) {
    let select = document.querySelector("#printOrientation");
    if (!select) {
      const target = fieldFor("printProblemScale") || document.querySelector(".settings-grid")?.lastElementChild;
      const control = createOrientationControl(settings);
      if (target) {
        target.before(control);
      } else {
        document.querySelector(".settings-grid")?.append(control);
      }
      select = document.querySelector("#printOrientation");
    }
    if (select) select.value = settings.orientation;
    return select;
  }

  function createPunchGuideControl(settings) {
    const field = document.createElement("label");
    field.className = "field";
    const text = document.createElement("span");
    text.textContent = "穴あけガイド";

    const select = document.createElement("select");
    select.id = "printPunchGuide";
    [
      ["none", "なし"],
      ["left", "左の真ん中 ◀"],
      ["top", "上の真ん中 ▲"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    });
    select.value = settings.punchGuide;
    field.append(text, select);
    return field;
  }

  function upsertPunchGuideControl(settings) {
    let select = document.querySelector("#printPunchGuide");
    if (!select) {
      const target = fieldFor("printProblemScale") || document.querySelector(".settings-grid")?.lastElementChild;
      const control = createPunchGuideControl(settings);
      if (target) {
        target.before(control);
      } else {
        document.querySelector(".settings-grid")?.append(control);
      }
      select = document.querySelector("#printPunchGuide");
    }
    if (select) select.value = settings.punchGuide;
    return select;
  }

  function fieldFor(id) {
    const input = document.querySelector(`#${id}`);
    return input?.closest(".field") || input?.parentElement || null;
  }

  function createRangeNumberControl({ id, label, min, max, step, value, unit }) {
    const field = document.createElement("label");
    field.className = "field print-adjust-field";
    const text = document.createElement("span");
    text.textContent = label;

    const row = document.createElement("span");
    row.className = "print-adjust-control";

    const range = document.createElement("input");
    range.id = id;
    range.type = "range";
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(value);
    range.dataset.unit = unit;

    const number = document.createElement("input");
    number.id = `${id}Number`;
    number.type = "number";
    number.min = String(min);
    number.max = String(max);
    number.step = String(step);
    number.value = String(value);
    number.inputMode = "decimal";
    number.ariaLabel = `${label}の数値`;

    row.append(range, number);
    field.append(text, row);
    return field;
  }

  function upsertRangeNumberControl(config) {
    const existingField = fieldFor(config.id);
    const replacement = createRangeNumberControl(config);
    if (existingField) {
      existingField.replaceWith(replacement);
    } else {
      document.querySelector(".settings-grid")?.append(replacement);
    }
  }

  function createSheetCountControl(value) {
    const field = document.createElement("label");
    field.className = "field print-adjust-field";

    const text = document.createElement("span");
    text.textContent = "作成する枚数";

    const input = document.createElement("input");
    input.id = "printSheetCount";
    input.type = "number";
    input.min = "1";
    input.max = "30";
    input.step = "1";
    input.value = String(value);
    input.inputMode = "numeric";
    input.ariaLabel = "作成する枚数";

    field.append(text, input);
    return field;
  }

  function upsertSheetCountControl(settings) {
    if (typeof window.__printAdjustmentsGenerateSheets !== "function") return null;
    let input = document.querySelector("#printSheetCount");
    if (!input) {
      document.querySelector(".settings-grid")?.append(createSheetCountControl(settings.sheetCount));
      input = document.querySelector("#printSheetCount");
    }
    if (input) input.value = String(settings.sheetCount);
    return input;
  }

  function ensureControls(settings) {
    injectStyles();
    upsertOrientationControl(settings);
    upsertPunchGuideControl(settings);
    upsertRangeNumberControl({
      id: "printProblemScale",
      label: "問題の大きさ上限（%）",
      min: 70,
      max: 200,
      step: 5,
      value: settings.scalePct,
      unit: "%",
    });
    upsertSheetCountControl(settings);
    if (autoFitAvailable) {
      upsertAutoFitControl(settings);
    }
  }

  function answerPages() {
    return Array.from(document.querySelectorAll(".print-page")).filter((page) => (
      page.querySelector(".answer") || page.querySelector(".sheet-kind.answer") || page.querySelector(".print-kind.answer")
    ));
  }

  function visiblePrintPages() {
    return Array.from(document.querySelectorAll(".print-page")).filter((page) => (
      !page.hidden && !page.classList.contains("print-adjust-answer-hidden")
    ));
  }

  function sheetSignature(settings) {
    return `${settings.sheetCount}:${settings.includeAnswers ? "answers" : "questions"}`;
  }

  function shouldGenerateSheets(settings) {
    if (typeof window.__printAdjustmentsGenerateSheets !== "function") return false;
    const expectedPages = settings.sheetCount * (settings.includeAnswers ? 2 : 1);
    return lastSheetSignature !== sheetSignature(settings) || visiblePrintPages().length !== expectedPages;
  }

  function syncPunchGuides(settings) {
    document.querySelectorAll(".print-page").forEach((page) => {
      let guide = page.querySelector(":scope > .punch-guide");
      if (settings.punchGuide === "none") {
        guide?.remove();
        return;
      }
      if (!guide) {
        guide = document.createElement("span");
        guide.className = "punch-guide";
        guide.setAttribute("aria-hidden", "true");
        page.append(guide);
      }
      guide.className = `punch-guide punch-guide-${settings.punchGuide}`;
      guide.textContent = settings.punchGuide === "left" ? "◀" : "▲";
    });
  }

  function cssLengthToMm(value, fallback) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    if (value.endsWith("px")) return parsed * 25.4 / 96;
    if (value.endsWith("cm")) return parsed * 10;
    if (value.endsWith("in")) return parsed * 25.4;
    return parsed;
  }

  function cssLengthToPx(value, fallback) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    if (value.endsWith("mm")) return parsed * 96 / 25.4;
    if (value.endsWith("cm")) return parsed * 96 / 2.54;
    if (value.endsWith("in")) return parsed * 96;
    return parsed;
  }

  function cssVarValue(element, cssVar) {
    return element.style.getPropertyValue(cssVar).trim()
      || window.getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
      || window.getComputedStyle(element).getPropertyValue(cssVar).trim();
  }

  function baseCssMm(element, dataKey, cssVar, fallback) {
    const attr = `printBase${dataKey}`;
    if (!element.dataset[attr]) {
      element.dataset[attr] = String(cssLengthToMm(cssVarValue(element, cssVar), fallback));
    }
    return Number(element.dataset[attr]) || fallback;
  }

  function baseCssPx(element, dataKey, cssVar, fallback) {
    const attr = `printBase${dataKey}`;
    if (!element.dataset[attr]) {
      element.dataset[attr] = String(cssLengthToPx(cssVarValue(element, cssVar), fallback));
    }
    return Number(element.dataset[attr]) || fallback;
  }

  function setProblemScale(scalePct) {
    const scale = scalePct / 100;

    document.querySelectorAll(".problem-grid").forEach((grid) => {
      const hasVisual = Boolean(grid.querySelector(".visual"));
      const baseProblemMin = baseCssMm(grid, "ProblemMin", "--problem-min", hasVisual ? 42 : 30);
      const baseRowGap = baseCssMm(grid, "RowGap", "--row-gap", 7);
      const baseProblemFont = baseCssPx(grid, "ProblemFont", "--problem-font", 18);
      const baseBlankWidth = baseCssMm(grid, "BlankWidth", "--blank-width", 28);
      const baseBlankHeight = baseCssMm(grid, "BlankHeight", "--blank-height", 8);
      const baseBlankW = baseCssMm(grid, "BlankW", "--blank-w", 12);
      const baseBlankH = baseCssMm(grid, "BlankH", "--blank-h", 9);
      const baseProblemCardGap = baseCssMm(grid, "ProblemCardGap", "--problem-card-gap", 3);
      const baseProblemCardPad = baseCssMm(grid, "ProblemCardPad", "--problem-card-pad", 3);

      grid.style.setProperty("--problem-font", `${Math.round(baseProblemFont * scale)}px`);
      grid.style.setProperty("--problem-min", `${(baseProblemMin * scale).toFixed(1)}mm`);
      grid.style.setProperty("--row-gap", `${(baseRowGap * scale).toFixed(1)}mm`);
      grid.style.setProperty("--visual-min", `${(24 * scale).toFixed(1)}mm`);
      grid.style.setProperty("--visual-width", `${Math.round(132 * scale)}px`);
      grid.style.setProperty("--clock-width", `${Math.round(132 * scale)}px`);
      grid.style.setProperty("--dot-size", `${Math.round(10 * scale)}px`);
      grid.style.setProperty("--blank-width", `${(baseBlankWidth * scale).toFixed(1)}mm`);
      grid.style.setProperty("--blank-height", `${(baseBlankHeight * scale).toFixed(1)}mm`);
      grid.style.setProperty("--blank-w", `${(baseBlankW * scale).toFixed(1)}mm`);
      grid.style.setProperty("--blank-h", `${(baseBlankH * scale).toFixed(1)}mm`);
      grid.style.setProperty("--problem-card-gap", `${(baseProblemCardGap * scale).toFixed(1)}mm`);
      grid.style.setProperty("--problem-card-pad", `${(baseProblemCardPad * scale).toFixed(1)}mm`);
    });

    document.querySelectorAll(".vertical-formula").forEach((formula) => {
      const baseDigitSize = baseCssMm(formula, "DigitSize", "--digit-size", 8);
      const baseHelperSize = baseCssMm(formula, "HelperSize", "--helper-size", 2.8);
      const baseOperatorWidth = baseCssMm(formula, "OperatorWidth", "--operator-width", 6);
      const baseFormulaGap = baseCssMm(formula, "FormulaGap", "--formula-gap", 1);
      formula.style.setProperty("--digit-size", `${(baseDigitSize * scale).toFixed(1)}mm`);
      formula.style.setProperty("--helper-size", `${(baseHelperSize * scale).toFixed(1)}mm`);
      formula.style.setProperty("--operator-width", `${(baseOperatorWidth * scale).toFixed(1)}mm`);
      formula.style.setProperty("--formula-gap", `${(baseFormulaGap * scale).toFixed(1)}mm`);
    });
  }

  function pageFits(page) {
    const style = window.getComputedStyle(page);
    const targetWidth = Number.parseFloat(style.width);
    const targetHeight = Number.parseFloat(style.minHeight) || Number.parseFloat(style.height);
    const rect = page.getBoundingClientRect();
    const tolerance = 0.5;
    const actualWidth = Math.max(page.scrollWidth, rect.width);
    const actualHeight = Math.max(page.scrollHeight, rect.height);
    const fitsWidth = !targetWidth || actualWidth <= targetWidth + tolerance;
    const fitsHeight = !targetHeight || actualHeight <= targetHeight + tolerance;
    return fitsWidth && fitsHeight;
  }

  function pagesFit() {
    const pages = visiblePrintPages();
    return pages.length > 0 && pages.every(pageFits);
  }

  function setFitStatus(message) {
    const status = document.querySelector("#status");
    if (!status) return;
    if (message) {
      status.textContent = message;
      status.dataset.printFitStatus = "true";
    } else if (status.dataset.printFitStatus === "true") {
      status.textContent = "";
      delete status.dataset.printFitStatus;
    }
  }

  function minimumAutoFitScale() {
    return visiblePrintPages().some((page) => page.classList.contains("vertical-layout") || page.querySelector(".vertical-formula")) ? 70 : 25;
  }

  function applyAutoFit(settings) {
    if (!settings.autoFitEnabled) {
      setProblemScale(settings.scalePct);
      return;
    }

    const minScale = minimumAutoFitScale();
    const maxScale = clampNumber(settings.scalePct, minScale, 200, defaults.scalePct);
    let low = minScale;
    let high = maxScale;

    setProblemScale(high);
    if (pagesFit()) {
      setProblemScale(high);
      setFitStatus("");
      return;
    }

    setProblemScale(low);
    if (!pagesFit()) {
      setFitStatus(`${minScale}%でも収まりません。列数や問題数を調整してください。`);
      return;
    }

    for (let i = 0; i < 8; i += 1) {
      const mid = (low + high) / 2;
      setProblemScale(mid);
      if (pagesFit()) {
        low = mid;
      } else {
        high = mid;
      }
    }

    setProblemScale(low);
    setFitStatus("");
  }

  function syncPrintPages(settings) {
    applyPaperSize(settings);

    if (shouldGenerateSheets(settings)) {
      const handled = window.__printAdjustmentsGenerateSheets({
        sheetCount: settings.sheetCount,
        includeAnswers: settings.includeAnswers,
      });
      if (handled) {
        lastSheetSignature = sheetSignature(settings);
        skipNextObserver = true;
      }
    }

    answerPages().forEach((page) => {
      const hideAnswer = !settings.includeAnswers;
      page.hidden = hideAnswer;
      page.classList.toggle("print-adjust-answer-hidden", hideAnswer);
    });
    syncPunchGuides(settings);

    const pageCount = document.querySelector("#pageCount");
    if (pageCount) {
      const visiblePages = visiblePrintPages().length;
      if (visiblePages) pageCount.textContent = `${visiblePages}枚`;
    }
  }

  function applySettings(settings, options = {}) {
    if (applying) return;
    applying = true;
    try {
      syncPrintPages(settings);
      if (options.autoFit !== false) applyAutoFit(settings);
      if (options.previewZoom !== false) applyPreviewZoom();
    } finally {
      applying = false;
    }
  }

  function prepareForPrint(settings) {
    if (applying) return;
    applying = true;
    try {
      syncPrintPages(settings);
    } finally {
      applying = false;
    }
  }

  function bindRangeNumber(id, key, settings) {
    const range = document.querySelector(`#${id}`);
    const number = document.querySelector(`#${id}Number`);
    if (!range || !number) return;

    const sync = (source, target) => {
      const value = clampNumber(source.value, Number(source.min), Number(source.max), defaults[key] || 0);
      source.value = String(value);
      target.value = String(value);
      settings[key] = value;
      saveSettings(settings);
      applySettings(settings);
    };

    range.addEventListener("input", () => sync(range, number));
    number.addEventListener("input", () => sync(number, range));
  }

  function setup() {
    const settings = loadSettings();
    ensureControls(settings);
    bindRangeNumber("printProblemScale", "scalePct", settings);

    const autoFit = document.querySelector("#printAutoFit");
    if (autoFitAvailable && autoFit) {
      autoFit.addEventListener("change", () => {
        settings.autoFitEnabled = autoFit.checked;
        saveSettings(settings);
        applySettings(settings);
      });
    }

    const orientation = document.querySelector("#printOrientation");
    if (orientation) {
      orientation.addEventListener("change", () => {
        settings.orientation = orientation.value === "landscape" ? "landscape" : "portrait";
        saveSettings(settings);
        applySettings(settings);
      });
    }

    const punchGuide = document.querySelector("#printPunchGuide");
    if (punchGuide) {
      punchGuide.addEventListener("change", () => {
        settings.punchGuide = ["left", "top"].includes(punchGuide.value) ? punchGuide.value : "none";
        saveSettings(settings);
        applySettings(settings, { autoFit: false });
      });
    }

    const sheetCount = document.querySelector("#printSheetCount");
    if (sheetCount) {
      const updateSheetCount = () => {
        settings.sheetCount = clampNumber(sheetCount.value, 1, 30, defaults.sheetCount);
        sheetCount.value = String(settings.sheetCount);
        saveSettings(settings);
        applySettings(settings);
      };
      sheetCount.addEventListener("input", updateSheetCount);
      sheetCount.addEventListener("change", updateSheetCount);
    }

    const includeAnswers = document.querySelector("#includeAnswers");
    if (includeAnswers) {
      includeAnswers.disabled = false;
      includeAnswers.checked = settings.includeAnswers;
      includeAnswers.addEventListener("change", () => {
        settings.includeAnswers = includeAnswers.checked;
        saveSettings(settings);
        applySettings(settings);
      });
    }

    applySettings(settings);
    const pages = document.querySelector("#pages");
    if (pages) {
      skipNextObserver = false;
      new MutationObserver(() => {
        if (skipNextObserver) {
          skipNextObserver = false;
          return;
        }
        if (observerFrame) return;
        observerFrame = window.requestAnimationFrame(() => {
          observerFrame = 0;
          applySettings(settings);
        });
      }).observe(pages, { childList: true, subtree: true });
    }

    if (!window.__printAdjustmentsPatched) {
      window.__printAdjustmentsPatched = true;
      const nativePrint = window.print.bind(window);
      window.print = () => {
        if (printActive) return;
        printActive = true;
        prepareForPrint(settings);
        try {
          nativePrint();
        } finally {
          window.setTimeout(() => {
            printActive = false;
          }, 1000);
        }
      };
      window.addEventListener("beforeprint", () => prepareForPrint(settings));
      window.addEventListener("afterprint", () => {
        printActive = false;
        schedulePreviewZoom();
      });
      window.addEventListener("resize", schedulePreviewZoom);
      window.addEventListener("keydown", (event) => {
        const key = event.key?.toLowerCase();
        if ((event.ctrlKey || event.metaKey) && key === "p" && !event.altKey) {
          prepareForPrint(settings);
        }
      }, true);
    }

    const printButton = document.querySelector("#printBtn");
    if (printButton && !printButton.dataset.printAdjustManaged) {
      const managedPrintButton = printButton.cloneNode(true);
      managedPrintButton.dataset.printAdjustManaged = "true";
      printButton.replaceWith(managedPrintButton);
      managedPrintButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.print();
      }, true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
