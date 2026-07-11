const PI = 3.14;

function formatNumber(value) {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function makeCircleArea(randomInt) {
  const radius = randomInt(2, 20);
  return { template: `半径${radius}cmの円の面積 = {0}cm²`, answers: [formatNumber(radius * radius * PI)] };
}

function makePrismVolume(randomInt) {
  const baseArea = randomInt(6, 80);
  const height = randomInt(2, 15);
  return { template: `底面積${baseArea}cm²、高さ${height}cmの角柱の体積 = {0}cm³`, answers: [baseArea * height] };
}

function makeCylinderVolume(randomInt) {
  const radius = randomInt(2, 10);
  const height = randomInt(2, 15);
  return { template: `半径${radius}cm、高さ${height}cmの円柱の体積 = {0}cm³`, answers: [formatNumber(radius * radius * PI * height)] };
}

window.WORKSHEET_APP = {
  id: "area-volume-print-grade6", title: "6年生 面積・体積計算", defaultType: "mixed", defaultCount: 18, defaultColumns: 2, countMax: 60,
  types: [{ value: "circleArea" }, { value: "prismVolume" }, { value: "cylinderVolume" }, { value: "mixed" }],
  generate(type, { randomInt, choice }) {
    const selected = type === "mixed" ? choice(["circleArea", "prismVolume", "cylinderVolume"]) : type;
    if (selected === "circleArea") return makeCircleArea(randomInt);
    if (selected === "prismVolume") return makePrismVolume(randomInt);
    return makeCylinderVolume(randomInt);
  },
};
