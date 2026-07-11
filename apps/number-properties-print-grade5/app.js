function gcd(a, b) {
  let x = a;
  let y = b;
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

function lcm(a, b) {
  return (a * b) / gcd(a, b);
}

function divisors(value) {
  const result = [];
  for (let number = 1; number <= value; number += 1) {
    if (value % number === 0) result.push(number);
  }
  return result;
}

function makeProblem(type, randomInt) {
  if (type === "parity") {
    const value = randomInt(10, 999);
    return { template: `${value}は偶数・奇数のどちらか: {0}`, answers: [value % 2 === 0 ? "偶数" : "奇数"] };
  }
  if (type === "multiples") {
    const value = randomInt(2, 15);
    return { template: `${value}の倍数を小さい順に3つ書くと {0} {1} {2}`, answers: [value, value * 2, value * 3] };
  }
  if (type === "divisors") {
    const value = randomInt(8, 60);
    return { template: `${value}の約数をすべて書くと {0}`, answers: [divisors(value).join(", ")] };
  }
  const a = randomInt(2, 18);
  const b = randomInt(2, 18);
  if (type === "commonMultiples") {
    const base = lcm(a, b);
    return { template: `${a}と${b}の公倍数を小さい順に3つ書くと {0} {1} {2}`, answers: [base, base * 2, base * 3] };
  }
  if (type === "commonDivisors") {
    return { template: `${a}と${b}の公約数をすべて書くと {0}`, answers: [divisors(gcd(a, b)).join(", ")] };
  }
  if (Math.random() < 0.5) return { template: `${a}と${b}の最小公倍数は {0}`, answers: [lcm(a, b)] };
  return { template: `${a}と${b}の最大公約数は {0}`, answers: [gcd(a, b)] };
}

window.WORKSHEET_APP = {
  id: "number-properties-print-grade5", stateVersion: 2, title: "5年生 約数・倍数", defaultType: "mixed", defaultCount: 24, defaultColumns: 2, countMax: 60,
  types: [{ value: "parity" }, { value: "multiples" }, { value: "divisors" }, { value: "commonMultiples" }, { value: "commonDivisors" }, { value: "lcmGcd" }, { value: "mixed" }],
  generate(type, { randomInt, choice }) {
    const selected = type === "mixed" ? choice(["parity", "multiples", "divisors", "commonMultiples", "commonDivisors", "lcmGcd"]) : type;
    return makeProblem(selected, randomInt);
  },
};
