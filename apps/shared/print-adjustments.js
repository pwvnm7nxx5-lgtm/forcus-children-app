(function () {
  const storageKey = `print-adjustments:${location.pathname}`;
  const defaults = {
    scalePct: 100,
    includeAnswers: true,
  };
  const legacyScale = { compact: 88, normal: 100, large: 118 };
  let applying = false;
  let observerFrame = 0;

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
      includeAnswers: saved.includeAnswers !== false,
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
    `;
    document.head.append(style);
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

  function ensureControls(settings) {
    injectStyles();
    upsertRangeNumberControl({
      id: "printProblemScale",
      label: "問題の大きさ（%）",
      min: 70,
      max: 150,
      step: 5,
      value: settings.scalePct,
      unit: "%",
    });
  }

  function answerPages() {
    return Array.from(document.querySelectorAll(".print-page")).filter((page) => (
      page.querySelector(".answer") || page.querySelector(".sheet-kind.answer") || page.querySelector(".print-kind.answer")
    ));
  }

  function applySettings(settings) {
    if (applying) return;
    applying = true;
    try {
      const scale = settings.scalePct / 100;

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
        const visiblePages = Array.from(document.querySelectorAll(".print-page")).filter((page) => (
          !page.hidden && !page.classList.contains("print-adjust-answer-hidden")
        )).length;
        if (visiblePages) pageCount.textContent = `${visiblePages}枚`;
      }
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
    const appOwnsProblemScale = Boolean(window.GRADE3_APP_CONFIG);
    const settings = loadSettings();
    if (!appOwnsProblemScale) {
      ensureControls(settings);
      bindRangeNumber("printProblemScale", "scalePct", settings);
    }

    const includeAnswers = document.querySelector("#includeAnswers");
    if (includeAnswers) {
      includeAnswers.disabled = false;
      includeAnswers.checked = settings.includeAnswers;
      includeAnswers.addEventListener("change", () => {
        settings.includeAnswers = includeAnswers.checked;
        saveSettings(settings);
        applySettings(settings);
        window.requestAnimationFrame(() => applySettings(settings));
      });
    }

    applySettings(settings);
    const pages = document.querySelector("#pages");
    if (pages) {
      new MutationObserver(() => {
        if (observerFrame) return;
        observerFrame = window.requestAnimationFrame(() => {
          observerFrame = 0;
          applySettings(settings);
        });
      }).observe(pages, { childList: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
