const roundingPlaces = [
  { value: 10, label: "十の位" },
  { value: 100, label: "百の位" },
  { value: 1000, label: "千の位" },
  { value: 10000, label: "一万の位" },
];

function roundTo(value, place) {
  return Math.round(value / place) * place;
}

function makeRounding(randomInt, choice) {
  const place = choice(roundingPlaces);
  const value = randomInt(place.value, Math.min(99999999, place.value * 999));
  return { template: `${value.toLocaleString("ja-JP")}を${place.label}までの概数にすると {0}`, answers: [roundTo(value, place.value).toLocaleString("ja-JP")] };
}

function makeEstimateAddSub(randomInt, choice) {
  const place = choice(roundingPlaces.slice(1, 3));
  let a = randomInt(place.value * 2, place.value * 99);
  let b = randomInt(place.value, place.value * 89);
  const op = Math.random() < 0.5 ? "+" : "-";
  if (op === "-" && a < b) [a, b] = [b, a];
  const roundedA = roundTo(a, place.value);
  const roundedB = roundTo(b, place.value);
  const answer = op === "+" ? roundedA + roundedB : roundedA - roundedB;
  return { template: `${a.toLocaleString("ja-JP")} ${op} ${b.toLocaleString("ja-JP")}を${place.label}までの概数で見積もると {0}`, answers: [answer.toLocaleString("ja-JP")] };
}

function makeEstimateMultiply(randomInt) {
  const a = randomInt(110, 990);
  const b = randomInt(11, 99);
  const answer = roundTo(a, 100) * roundTo(b, 10);
  return { template: `${a} × ${b}を百の位・十の位の概数で見積もると {0}`, answers: [answer.toLocaleString("ja-JP")] };
}

window.WORKSHEET_APP = {
  id: "rounding-print-grade4", title: "4年生 概数・四捨五入", defaultType: "mixed", defaultCount: 24, defaultColumns: 2, countMax: 60,
  types: [{ value: "rounding" }, { value: "estimateAddSub" }, { value: "estimateMultiply" }, { value: "mixed" }],
  generate(type, { randomInt, choice }) {
    const selected = type === "mixed" ? choice(["rounding", "estimateAddSub", "estimateMultiply"]) : type;
    if (selected === "rounding") return makeRounding(randomInt, choice);
    if (selected === "estimateAddSub") return makeEstimateAddSub(randomInt, choice);
    return makeEstimateMultiply(randomInt);
  },
};
