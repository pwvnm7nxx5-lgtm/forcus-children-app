function makeAddOrSub(op, randomInt, formatScaled) {
  const places = randomInt(1, 2);
  let a = randomInt(1, places === 1 ? 999 : 9999);
  let b = randomInt(1, places === 1 ? 999 : 9999);
  if (op === "-" && b > a) [a, b] = [b, a];
  return { a: formatScaled(a, places), b: formatScaled(b, places), op, answer: formatScaled(op === "+" ? a + b : a - b, places), answerPlaces: places };
}
function makeMultiply(randomInt, formatScaled) {
  const places = randomInt(1, 2); const a = randomInt(11, places === 1 ? 999 : 9999); const b = randomInt(2, 9);
  return { a: formatScaled(a, places), b: String(b), op: "×", answer: formatScaled(a * b, places), answerPlaces: places };
}
function makeDivide(randomInt, formatScaled, vertical) {
  const places = vertical ? 1 : randomInt(1, 2); const divisor = randomInt(2, 9); const quotient = randomInt(11, vertical ? 99 : (places === 1 ? 499 : 4999)); const dividend = quotient * divisor;
  return { a: formatScaled(dividend, places), b: String(divisor), op: "÷", answer: formatScaled(quotient, places), answerPlaces: places };
}
window.DECIMAL_WORKSHEET_APP = { id: "decimal-print-grade4", title: "4年生 小数計算", defaultType: "mixed", defaultCount: 18, defaultColumns: 3, digitCount: 7, minDigitCount: 5, verticalTypes: ["addition", "subtraction", "multiplyInteger", "divideInteger", "mixed"], types: [{ value: "addition" }, { value: "subtraction" }, { value: "multiplyInteger" }, { value: "divideInteger" }, { value: "mixed" }], generate(type, { randomInt, choice, formatScaled }, settings) { const selected = type === "mixed" ? choice(["addition", "subtraction", "multiplyInteger", "divideInteger"]) : type; if (selected === "addition") return makeAddOrSub("+", randomInt, formatScaled); if (selected === "subtraction") return makeAddOrSub("-", randomInt, formatScaled); if (selected === "multiplyInteger") return makeMultiply(randomInt, formatScaled); return makeDivide(randomInt, formatScaled, settings.layout === "vertical"); } };
