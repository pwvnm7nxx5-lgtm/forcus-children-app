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
  const problem = { a: formatScaled(dividend, places), b: String(divisor), op: "÷", answer: formatScaled(quotient, places), answerPlaces: places };
  if (vertical) problem.longDivision = { divisor, dividend, quotient, divisorDigits: 1, quotientDecimalAfterIndex: String(quotient).length - 2 };
  return problem;
}
function makeIntegerDivideDecimal(randomInt, formatScaled) {
  const divisor = randomInt(6, 49) * 2;
  const maximumQuotient = Math.max(10, Math.floor(990 / divisor / 5) * 5);
  const quotient = randomInt(2, Math.floor(maximumQuotient / 5)) * 5;
  const dividend = (divisor * quotient) / 10;
  return {
    a: String(dividend),
    b: formatScaled(divisor, 1),
    op: "÷",
    answer: String(quotient),
    answerPlaces: 0,
    longDivision: { divisor, dividend: dividend * 10, quotient, divisorDigits: 2, quotientDecimalAfterIndex: -1 },
  };
}
window.DECIMAL_WORKSHEET_APP = { id: "decimal-print-grade4", title: "4年生 小数計算", defaultType: "mixed", defaultCount: 18, defaultColumns: 3, digitCount: 7, verticalTypes: ["addition", "subtraction", "multiplyInteger", "divideInteger", "integerDivideDecimal", "mixed"], verticalLongDivisionTypes: ["divideInteger", "integerDivideDecimal", "mixed"], longDivisionCountMax: 18, longDivisionColumnsMax: 3, types: [{ value: "addition" }, { value: "subtraction" }, { value: "multiplyInteger" }, { value: "divideInteger" }, { value: "integerDivideDecimal" }, { value: "mixed" }], generate(type, { randomInt, choice, formatScaled }, settings) { let selected = type; if (type === "mixed") selected = choice(["addition", "subtraction", "multiplyInteger", "divideInteger", "integerDivideDecimal"]); if (selected === "addition") return makeAddOrSub("+", randomInt, formatScaled); if (selected === "subtraction") return makeAddOrSub("-", randomInt, formatScaled); if (selected === "multiplyInteger") return makeMultiply(randomInt, formatScaled); if (selected === "integerDivideDecimal") return makeIntegerDivideDecimal(randomInt, formatScaled); return makeDivide(randomInt, formatScaled, settings.layout === "vertical"); } };
