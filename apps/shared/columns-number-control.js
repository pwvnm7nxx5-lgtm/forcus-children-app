(function () {
  const columns = document.querySelector("#columns");
  if (!columns || columns.tagName !== "SELECT") return;

  const selected = columns.selectedOptions?.[0] || columns.querySelector("option[selected]") || columns.options[0];
  const input = document.createElement("input");
  input.id = columns.id;
  input.name = columns.name;
  input.type = "number";
  input.min = columns.dataset.min || "1";
  input.max = columns.dataset.max || "6";
  input.step = "1";
  input.value = selected?.value || columns.value || "2";
  input.inputMode = "numeric";
  input.ariaLabel = columns.getAttribute("aria-label") || "列数";
  input.className = columns.className;
  columns.replaceWith(input);

  input.addEventListener("input", () => {
    if (input.value === "") return;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
})();
