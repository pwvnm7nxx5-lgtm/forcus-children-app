function gcd(a, b) {
  let x = a;
  let y = b;
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

function coprimePair(randomInt) {
  let a;
  let b;
  do {
    a = randomInt(1, 12);
    b = randomInt(1, 12);
  } while (a === b || gcd(a, b) !== 1);
  return [a, b];
}

function makeSimplify(randomInt) {
  const [a, b] = coprimePair(randomInt);
  const scale = randomInt(2, 12);
  return { template: `${a * scale}:${b * scale}を簡単にすると {0}:{1}`, answers: [a, b] };
}

function makeEquivalent(randomInt) {
  const [a, b] = coprimePair(randomInt);
  const scale = randomInt(2, 9);
  return { template: `${a}:${b}と等しい比を1つ書くと {0}:{1}`, answers: [a * scale, b * scale] };
}

function makeMissing(randomInt) {
  const [a, b] = coprimePair(randomInt);
  const scale = randomInt(2, 12);
  if (Math.random() < 0.5) return { template: `${a}:${b} = ${a * scale}:{0}`, answers: [b * scale] };
  return { template: `${a}:${b} = {0}:${b * scale}`, answers: [a * scale] };
}

function makeRatioValue(choice) {
  const [a, b] = choice([[1, 2], [1, 4], [2, 5], [3, 5], [3, 4], [4, 5], [3, 2], [5, 2], [2, 1]]);
  return { template: `${a}:${b}の比の値 = {0}`, answers: [String(a / b)] };
}

window.WORKSHEET_APP = {
  id: "ratio-print-grade6", title: "6年生 比", defaultType: "mixed", defaultCount: 24, defaultColumns: 3, countMax: 60,
  types: [{ value: "simplify" }, { value: "equivalent" }, { value: "missing" }, { value: "ratioValue" }, { value: "mixed" }],
  generate(type, { randomInt, choice }) {
    const selected = type === "mixed" ? choice(["simplify", "equivalent", "missing", "ratioValue"]) : type;
    if (selected === "simplify") return makeSimplify(randomInt);
    if (selected === "equivalent") return makeEquivalent(randomInt);
    if (selected === "missing") return makeMissing(randomInt);
    return makeRatioValue(choice);
  },
};
