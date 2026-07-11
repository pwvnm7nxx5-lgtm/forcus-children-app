function makeAverage(randomInt, shuffle) {
  const average = randomInt(10, 60);
  const offset = randomInt(2, Math.min(10, average - 1));
  const values = shuffle([average - offset, average, average + offset]);
  return { template: `${values.join(", ")}の平均 = {0}`, answers: [average] };
}

function makePerUnit(randomInt, choice) {
  const count = randomInt(2, 9);
  const unit = choice([20, 30, 40, 50, 60, 80, 100]);
  return {
    prompt: `${count}個で${(count * unit).toLocaleString("ja-JP")}円。1個あたり`,
    answerTemplate: "{0}円",
    answers: [unit],
  };
}

function makePercentage(choice) {
  const rate = choice([10, 20, 25, 30, 40, 50, 60, 75, 80, 90]);
  const base = choice([40, 60, 80, 100, 120, 160, 200, 240, 300, 400, 500]);
  const amount = (base * rate) / 100;
  if (Math.random() < 0.5) return { template: `${base.toLocaleString("ja-JP")}の${rate}% = {0}`, answers: [amount.toLocaleString("ja-JP")] };
  return {
    prompt: `${amount.toLocaleString("ja-JP")}は${base.toLocaleString("ja-JP")}の`,
    answerTemplate: "{0}%",
    answers: [rate],
  };
}

function makeSpeed(randomInt, choice) {
  const hours = randomInt(2, 5);
  const speed = choice([20, 30, 40, 50, 60]);
  const distance = speed * hours;
  if (Math.random() < 0.5) {
    return {
      prompt: `${distance}kmを${hours}時間で進む速さ = 時速`,
      answerTemplate: "{0}km",
      answers: [speed],
    };
  }
  return {
    prompt: `時速${speed}kmで${hours}時間進む道のり =`,
    answerTemplate: "{0}km",
    answers: [distance],
  };
}

window.WORKSHEET_APP = {
  id: "rates-print-grade5", stateVersion: 3, title: "5年生 割合・平均・速さ", defaultType: "mixed", defaultCount: 24, defaultColumns: 2, countMax: 60,
  types: [{ value: "average" }, { value: "perUnit" }, { value: "percentage" }, { value: "speed" }, { value: "mixed" }],
  generate(type, { randomInt, choice, shuffle }) {
    const selected = type === "mixed" ? choice(["average", "perUnit", "percentage", "speed"]) : type;
    if (selected === "average") return makeAverage(randomInt, shuffle);
    if (selected === "perUnit") return makePerUnit(randomInt, choice);
    if (selected === "percentage") return makePercentage(choice);
    return makeSpeed(randomInt, choice);
  },
};
