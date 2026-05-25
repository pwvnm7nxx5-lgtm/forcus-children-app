(function () {
  const storageKey = `print-adjustments:${location.pathname}`;
  const defaults = {
    scalePct: 100,
    sheetCount: 1,
    includeAnswers: true,
  };
  const legacyScale = { compact: 88, normal: 100, large: 118 };

  let settings = loadSettings();
  let applying = false;

  function clampNumber(value, min, max, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  }

  function loadSettings() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {}

    return {
      scalePct: clampNumber(saved.scalePct ?? legacyScale[saved.scale], 70, 150, defaults.scalePct),
      sheetCount: clampNumber(saved.sheetCount, 1, 30, defaults.sheetCount),
      includeAnswers: saved.includeAnswers !== false,
    };
  }

  function saveSettings() {
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
      .print-adjust-hidden {
        display: none !important;
      }
      .problem-grid {
        gap: var(--row-gap, 7mm) var(--column-gap, 6mm);
      }
      .problem {
        min-height: var(--problem-min, auto);
        font-size: var(--problem-font, inherit);
      }
      .problem-card,
      .formula,
      .prompt,
      .answer-line,
      .problem-text {
        font-size: var(--problem-font, inherit);
      }
      .visual,
      .problem-visual {
        min-height: var(--visual-min, auto);
      }
      .visual svg,
      .problem-visual svg {
        width: var(--visual-width, auto) !important;
        max-width: 100%;
        height: auto;
      }
      .visual .clock,
      .visual svg.clock,
      .problem-visual .clock,
      .problem-visual svg.clock {
        width: var(--clock-width, var(--visual-width, 132px)) !important;
        max-width: 100%;
        height: auto;
      }
      .dot,
      .number-dot {
        width: var(--dot-size, 10px);
        height: var(--dot-size, 10px);
      }
      .blank,
      .answer-blank {
        min-width: var(--blank-width, 28mm);
        min-height: var(--blank-height, 8mm);
      }
    `;
    document.head.append(style);
  }

  function fieldFor(id) {
    const input = document.querySelector(`#${id}`);
    return input?.closest(".field") || input?.closest("label") || input?.parentElement || null;
  }

  function hideObsoleteControls() {
    [
      "problemSpacing",
      "pageMarginY",
      "pageMarginX",
      "answerGap",
      "layoutProblemScale",
      "layoutProblemSpacing",
      "layoutPageMarginY",
      "layoutPageMarginX",
      "layoutAnswerGap",
    ].forEach((id) => {
      const field = fieldFor(id);
      if (field) field.classList.add("print-adjust-hidden");
    });
  }

  function createRangeNumberControl({ id, label, min, max, step, value }) {
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

    const number = document.createElement("input");
    number.id = `${id}Number`;
    number.type = "number";
    number.min = String(min);
    number.max = String(max);
    number.step = String(step);
    number.value = String(value);
    number.inputMode = "numeric";
    number.setAttribute("aria-label", `${label}の数値`);

    row.append(range, number);
    field.append(text, row);
    return field;
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

    field.append(text, input);
    return field;
  }

  function insertControl(control) {
    const grid = document.querySelector(".settings-grid") || document.querySelector(".row-fields");
    grid?.append(control);
  }

  function ensureScaleControl() {
    const existing = document.querySelector("#problemScale");
    if (existing) {
      settings.scalePct = readScaleValue(existing);
      const number = document.querySelector("#problemScaleNumber");
      if (number) number.value = String(settings.scalePct);
      return existing;
    }

    insertControl(createRangeNumberControl({
      id: "problemScale",
      label: "問題の大きさ（%）",
      min: 70,
      max: 150,
      step: 5,
      value: settings.scalePct,
    }));
    return document.querySelector("#problemScale");
  }

  function ensureSheetCountControl() {
    let control = document.querySelector("#printSheetCount");
    if (!control) {
      insertControl(createSheetCountControl(settings.sheetCount));
      control = document.querySelector("#printSheetCount");
    }
    if (control) control.value = String(settings.sheetCount);
    return control;
  }

  function syncSettingsFromControls() {
    const scaleControl = document.querySelector("#problemScale");
    if (scaleControl) {
      settings.scalePct = readScaleValue(scaleControl);
      const number = document.querySelector("#problemScaleNumber");
      if (number) number.value = String(settings.scalePct);
    }

    const sheetCountControl = document.querySelector("#printSheetCount");
    if (sheetCountControl) {
      settings.sheetCount = clampNumber(sheetCountControl.value, 1, 30, defaults.sheetCount);
      sheetCountControl.value = String(settings.sheetCount);
    }

    const includeAnswers = document.querySelector("#includeAnswers");
    if (includeAnswers) {
      settings.includeAnswers = includeAnswers.checked;
    }

    saveSettings();
  }

  function readScaleValue(control) {
    if (!control) return settings.scalePct;
    if (legacyScale[control.value]) return legacyScale[control.value];
    return clampNumber(control.value, 70, 150, settings.scalePct);
  }

  function visibleOriginalPages() {
    return Array.from(document.querySelectorAll(".print-page")).filter((page) => !page.dataset.printAdjustCopy);
  }

  function isAnswerPage(page) {
    return Boolean(
      page.querySelector(".answer") ||
      page.querySelector(".sheet-kind.answer") ||
      page.querySelector(".print-kind.answer") ||
      page.dataset.kind === "answer"
    );
  }

  function syncCopies() {
    if (typeof window.__printAdjustmentsGenerateSheets === "function") {
      const handled = window.__printAdjustmentsGenerateSheets({
        sheetCount: settings.sheetCount,
        includeAnswers: settings.includeAnswers,
      });
      if (handled) return;
    }

    const originals = visibleOriginalPages();
    const copies = Array.from(document.querySelectorAll('[data-print-adjust-copy="true"]'));
    if (!originals.length || settings.sheetCount <= 1) {
      copies.forEach((page) => page.remove());
      return;
    }

    const expectedCopies = originals.length * (settings.sheetCount - 1);
    if (copies.length === expectedCopies) return;

    copies.forEach((page) => page.remove());

    const container = document.querySelector("#pages") || originals[0].parentElement;
    for (let setIndex = 2; setIndex <= settings.sheetCount; setIndex += 1) {
      originals.forEach((page) => {
        const clone = page.cloneNode(true);
        clone.dataset.printAdjustCopy = "true";
        clone.dataset.printAdjustSet = String(setIndex);
        container.append(clone);
      });
    }
  }

  function applyScale() {
    const scale = settings.scalePct / 100;
    document.querySelectorAll(".problem-grid").forEach((grid) => {
      const hasVisual = Boolean(grid.querySelector(".visual, .problem-visual, svg"));
      const baseProblemMin = hasVisual ? 42 : 30;
      grid.style.setProperty("--problem-font", `${Math.round(18 * scale)}px`);
      grid.style.setProperty("--problem-min", `${(baseProblemMin * scale).toFixed(1)}mm`);
      grid.style.setProperty("--row-gap", "7mm");
      grid.style.setProperty("--column-gap", "6mm");
      grid.style.setProperty("--card-gap", "4mm");
      grid.style.setProperty("--visual-min", `${(24 * scale).toFixed(1)}mm`);
      grid.style.setProperty("--visual-width", `${Math.round(132 * scale)}px`);
      grid.style.setProperty("--clock-width", `${Math.round(132 * scale)}px`);
      grid.style.setProperty("--dot-size", `${Math.round(10 * scale)}px`);
      grid.style.setProperty("--blank-width", `${(28 * scale).toFixed(1)}mm`);
      grid.style.setProperty("--blank-height", `${(8 * scale).toFixed(1)}mm`);
    });
  }

  function applyAnswers() {
    visibleOriginalPages()
      .concat(Array.from(document.querySelectorAll('[data-print-adjust-copy="true"]')))
      .filter(isAnswerPage)
      .forEach((page) => {
        page.hidden = !settings.includeAnswers;
      });
  }

  function updatePageCount() {
    const pageCount = document.querySelector("#pageCount");
    if (!pageCount) return;
    const visiblePages = Array.from(document.querySelectorAll(".print-page")).filter((page) => !page.hidden).length;
    if (visiblePages) pageCount.textContent = `${visiblePages}枚`;
  }

  function applySettings() {
    if (applying) return;
    applying = true;
    syncSettingsFromControls();
    syncCopies();
    applyScale();
    applyAnswers();
    updatePageCount();
    applying = false;
  }

  function applyBeforePrint() {
    applySettings();
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const fontsReady = document.fonts?.ready || Promise.resolve();
          Promise.race([
            fontsReady,
            new Promise((timeoutResolve) => setTimeout(timeoutResolve, 250)),
          ]).finally(resolve);
        });
      });
    });
  }

  function bindRangeNumber(range, key) {
    const number = document.querySelector(`#${range.id}Number`);
    const update = (rawValue) => {
      const value = clampNumber(rawValue, Number(range.min) || 70, Number(range.max) || 150, defaults[key]);
      range.value = String(value);
      if (number) number.value = String(value);
      settings[key] = value;
      saveSettings();
      applySettings();
    };

    range.addEventListener("input", () => update(range.value));
    number?.addEventListener("input", () => update(number.value));
  }

  function bindLegacyScale(select) {
    select.addEventListener("change", () => {
      settings.scalePct = readScaleValue(select);
      saveSettings();
      applySettings();
    });
  }

  function setup() {
    injectStyles();
    hideObsoleteControls();

    const scaleControl = ensureScaleControl();
    const sheetCountControl = ensureSheetCountControl();

    if (scaleControl) {
      if (scaleControl.tagName === "SELECT") {
        bindLegacyScale(scaleControl);
      } else {
        bindRangeNumber(scaleControl, "scalePct");
      }
    }

    const updateSheetCount = () => {
      settings.sheetCount = clampNumber(sheetCountControl.value, 1, 30, defaults.sheetCount);
      sheetCountControl.value = String(settings.sheetCount);
      saveSettings();
      applySettings();
    };
    sheetCountControl?.addEventListener("input", updateSheetCount);
    sheetCountControl?.addEventListener("change", updateSheetCount);

    const includeAnswers = document.querySelector("#includeAnswers");
    if (includeAnswers) {
      includeAnswers.disabled = false;
      includeAnswers.checked = settings.includeAnswers;
      includeAnswers.addEventListener("change", () => {
        settings.includeAnswers = includeAnswers.checked;
        saveSettings();
        applySettings();
      });
    }

    applySettings();
    window.__preparePrintAdjustments = applyBeforePrint;

    if (!window.__printAdjustmentsPatched) {
      window.__printAdjustmentsPatched = true;
      const nativePrint = window.print.bind(window);
      let printing = false;
      window.print = () => {
        if (printing) {
          nativePrint();
          return;
        }
        printing = true;
        applyBeforePrint().finally(() => {
          nativePrint();
          printing = false;
        });
      };
      window.addEventListener("beforeprint", () => {
        applySettings();
      });
    }

    const pages = document.querySelector("#pages");
    if (pages) {
      new MutationObserver(() => applySettings()).observe(pages, { childList: true, subtree: false });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
