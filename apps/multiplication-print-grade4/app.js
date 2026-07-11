window.MULTIPLICATION_WORKSHEET_APP = {
  id: "multiplication-print-grade4",
  title: "4年生 かけ算の筆算プリント",
  defaultType: "threeByTwo",
  defaultCount: 12,
  defaultColumns: 3,
  digitWidth: 6,
  types: ["threeByTwo", "fourByTwo", "threeByThree", "mixed"],
  ranges: {
    threeByTwo: { aMin: 101, aMax: 999, bMin: 11, bMax: 99 },
    fourByTwo: { aMin: 1000, aMax: 9999, bMin: 11, bMax: 99 },
    threeByThree: { aMin: 101, aMax: 999, bMin: 101, bMax: 999 },
  },
};
