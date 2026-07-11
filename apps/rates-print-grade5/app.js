function makeAverage(randomInt, shuffle) {
  const average = randomInt(10, 100);
  const offset = randomInt(2, Math.min(15, average - 1));
  const values = shuffle([average - offset, average, average + offset]);
  return { template: `${values.join(", ")}の平均 = {0}`, answers: [average] };
}

function makePerUnit(randomInt) {
  const count = randomInt(2, 9);
  const unit = randomInt(2, 50) * 10;
  return { template: `${count}個で${(count * unit).toLocaleString("ja-JP")}円。1個あたり {0}円`, answers: [unit] };
}

function makePercentage(randomInt, choice) {
  const rate = choice([10, 20, 25, 30, 40, 50, 60, 75, 80, 90]);
  const base = randomInt(2, 40) * 100;
  const amount = (base * rate) / 100;
  if (Math.random() < 0.5) return { template: `${base.toLocaleString("ja-JP")}の${rate}% = {0}`, answers: [amount.toLocaleString("ja-JP")] };
  return { template: `${amount.toLocaleString("ja-JP")}は${base.toLocaleString("ja-JP")}の {0}%`, answers: [rate] };
}

function makeSpeed(randomInt) {
  const hours = randomInt(2, 6);
  const speed = randomInt(3, 12) * 10;
  const distance = speed * hours;
  if (Math.random() < 0.5) return { template: `${distance}kmを${hours}時間で進む速さ = 時速 {0}km`, answers: [speed] };
  return { template: `時速${speed}kmで${hours}時間進む道のり = {0}km`, answers: [distance] };
}

window.WORKSHEET_APP = {
  id: "rates-print-grade5", title: "5年生 割合・平均・速さ", defaultType: "mixed", defaultCount: 24, defaultColumns: 2, countMax: 60,
  types: [{ value: "average" }, { value: "perUnit" }, { value: "percentage" }, { value: "speed" }, { value: "mixed" }],
  generate(type, { randomInt, choice, shuffle }) {
    const selected = type === "mixed" ? choice(["average", "perUnit", "percentage", "speed"]) : type;
    if (selected === "average") return makeAverage(randomInt, shuffle);
    if (selected === "perUnit") return makePerUnit(randomInt);
    if (selected === "percentage") return makePercentage(randomInt, choice);
    return makeSpeed(randomInt);
  },
};
