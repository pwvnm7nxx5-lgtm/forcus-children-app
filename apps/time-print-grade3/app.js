function makeDuration(totalMinutes) {
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

function durationText(duration) {
  if (duration.hours === 0) return `${duration.minutes}分`;
  if (duration.minutes === 0) return `${duration.hours}時間`;
  return `${duration.hours}時間 ${duration.minutes}分`;
}

function makeAddition(randomInt) {
  const first = randomInt(1, 18) * 5;
  const second = randomInt(1, 18) * 5;
  const result = makeDuration(first + second);
  return {
    template: `${durationText(makeDuration(first))} + ${durationText(makeDuration(second))} = {0}時間 {1}分`,
    answers: [result.hours, result.minutes],
  };
}

function makeSubtraction(randomInt) {
  const answer = randomInt(1, 18) * 5;
  const removed = randomInt(1, 18) * 5;
  const total = makeDuration(answer + removed);
  const result = makeDuration(answer);
  return {
    template: `${durationText(total)} - ${durationText(makeDuration(removed))} = {0}時間 {1}分`,
    answers: [result.hours, result.minutes],
  };
}

function makeConversion(randomInt) {
  if (Math.random() < 0.5) {
    const minutes = randomInt(1, 9);
    const seconds = randomInt(1, 59);
    return { template: `${minutes * 60 + seconds}秒 = {0}分 {1}秒`, answers: [minutes, seconds] };
  }
  const minutes = randomInt(1, 12);
  return { template: `${minutes}分 = {0}秒`, answers: [minutes * 60] };
}

window.WORKSHEET_APP = {
  id: "time-print-grade3",
  title: "3年生 時刻と時間",
  defaultType: "mixed",
  defaultCount: 24,
  defaultColumns: 3,
  countMax: 60,
  types: [
    { value: "addition", label: "時間のたし算" },
    { value: "subtraction", label: "時間のひき算" },
    { value: "conversion", label: "分と秒の単位変換" },
    { value: "mixed", label: "ミックス" },
  ],
  generate(type, { randomInt, choice }) {
    const selected = type === "mixed" ? choice(["addition", "subtraction", "conversion"]) : type;
    if (selected === "addition") return makeAddition(randomInt);
    if (selected === "subtraction") return makeSubtraction(randomInt);
    return makeConversion(randomInt);
  },
};
