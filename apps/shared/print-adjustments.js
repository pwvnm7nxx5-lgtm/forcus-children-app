(function () {
  const storageKey = `print-adjustments:${location.pathname}`;
  const defaults = {
    scalePct: 100,
    sheetCount: 1,
    includeAnswers: true,
    orientation: "portrait",
  };
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
    return {
      scalePct: clampNumber(saved.scalePct ?? legacyScale[saved.scale], 70, 200, defaults.scalePct),
      sheetCount: clampNumber(saved.sheetCount, 1, 30, defaults.sheetCount),
      includeAnswers: saved.includeAnswers !== false,
      orientation: saved.orientation === "landscape" ? "landscape" : defaults.orientation,
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
        width: var(--print-page-width, 210mm) !important;
        min-height: var(--print-page-height, 297mm) !important;
        padding: var(--page-margin-y, 14mm) var(--page-margin-x, 13mm);
      }
      .problem-card .answer-line {
        margin-top: var(--answer-gap, 0mm);
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
        .pages {
          zoom: 1 !important;
        }
        .print-page {
          width: var(--print-page-width, 210mm) !important;
          min-height: var(--print-page-height, 297mm) !important;
        }
      }
    `;
    document.head.append(style);
  }

  function updateOrientationStyle(settings) {
    let style = document.querySelector("#printOrientationStyle");
    if (!style) {
      style = document.createElement("style");
      style.id = "printOrientationStyle";
      document.head.append(style);
    }
    const pageSize = settings.orientation === "landscape" ? "A4 landscape" : "A4 portrait";
    style.textContent = `@page { size: ${pageSize}; margin: 0; }`;
  }

  function applyOrientation(settings) {
    const landscape = settings.orientation === "landscape";
    document.documentElement.style.setProperty("--print-page-width", landscape ? "297mm" : "210mm");
    document.documentElement.style.setProperty("--print-page-height", landscape ? "210mm" : "297mm");
    document.documentElement.style.setProperty("--print-preview-mobile-overlap", landscape ? "-72mm" : "-112mm");
    document.documentElement.classList.toggle("print-orientation-landscape", landscape);
    updateOrientationStyle(settings);
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

  function createOrientationControl(value) {
    const field = document.createElement("label");
    field.className = "field print-adjust-field";

    const text = document.createElement("span");
    text.textContent = "用紙の向き";

    const select = document.createElement("select");
    select.id = "printOrientation";
    select.ariaLabel = "用紙の向き";

    const portrait = document.createElement("option");
    portrait.value = "portrait";
    portrait.textContent = "たて";

    const landscape = document.createElement("option");
    landscape.value = "landscape";
    landscape.textContent = "よこ";

    select.append(portrait, landscape);
    select.value = value;
    field.append(text, select);
    return field;
  }

  function upsertOrientationControl(settings) {
    let select = document.querySelector("#printOrientation");
    if (!select) {
      const sheetCount = fieldFor("printSheetCount");
      if (sheetCount) {
        sheetCount.after(createOrientationControl(settings.orientation));
      } else {
        document.querySelector(".settings-grid")?.append(createOrientationControl(settings.orientation));
      }
      select = document.querySelector("#printOrientation");
    }
    if (select) select.value = settings.orientation;
    return select;
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
    upsertRangeNumberControl({
      id: "printProblemScale",
      label: "問題の大きさ（%）",
      min: 70,
      max: 200,
      step: 5,
      value: settings.scalePct,
      unit: "%",
    });
    upsertSheetCountControl(settings);
    upsertOrientationControl(settings);
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

  function applySettings(settings) {
    if (applying) return;
    applying = true;
    try {
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

      const scale = settings.scalePct / 100;
      applyOrientation(settings);

      document.querySelectorAll(".problem-grid").forEach((grid) => {
        const hasVisual = Boolean(grid.querySelector(".visual"));
        const baseProblemMin = hasVisual ? 42 : 30;
        grid.style.setProperty("--problem-font", `${Math.round(18 * scale)}px`);
        grid.style.setProperty("--problem-min", `${(baseProblemMin * scale).toFixed(1)}mm`);
        grid.style.setProperty("--visual-min", `${(24 * scale).toFixed(1)}mm`);
        grid.style.setProperty("--visual-width", `${Math.round(132 * scale)}px`);
        grid.style.setProperty("--clock-width", `${Math.round(132 * scale)}px`);
        grid.style.setProperty("--dot-size", `${Math.round(10 * scale)}px`);
        grid.style.setProperty("--blank-width", `${(28 * scale).toFixed(1)}mm`);
        grid.style.setProperty("--blank-height", `${(8 * scale).toFixed(1)}mm`);
      });

      answerPages().forEach((page) => {
        const hideAnswer = !settings.includeAnswers;
        page.hidden = hideAnswer;
        page.classList.toggle("print-adjust-answer-hidden", hideAnswer);
      });

      const pageCount = document.querySelector("#pageCount");
      if (pageCount) {
        const visiblePages = visiblePrintPages().length;
        if (visiblePages) pageCount.textContent = `${visiblePages}枚`;
      }
      applyPreviewZoom();
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

    const orientation = document.querySelector("#printOrientation");
    if (orientation) {
      orientation.addEventListener("change", () => {
        settings.orientation = orientation.value === "landscape" ? "landscape" : "portrait";
        saveSettings(settings);
        applySettings(settings);
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
      }).observe(pages, { childList: true });
    }

    if (!window.__printAdjustmentsPatched) {
      window.__printAdjustmentsPatched = true;
      const nativePrint = window.print.bind(window);
      window.print = () => {
        if (printActive) return;
        printActive = true;
        applySettings(settings);
        try {
          nativePrint();
        } finally {
          window.setTimeout(() => {
            printActive = false;
          }, 1000);
        }
      };
      window.addEventListener("beforeprint", () => applySettings(settings));
      window.addEventListener("afterprint", () => {
        printActive = false;
        schedulePreviewZoom();
      });
      window.addEventListener("resize", schedulePreviewZoom);
    }

    const printButton = document.querySelector("#printBtn");
    if (printButton && !printButton.dataset.printAdjustManaged) {
      printButton.dataset.printAdjustManaged = "true";
      printButton.addEventListener("click", (event) => {
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
