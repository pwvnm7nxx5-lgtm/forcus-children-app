function makeMultiply(randomInt, formatScaled, vertical) {
  const aPlaces = randomInt(1, 2);
  const a = randomInt(11, aPlaces === 1 ? 999 : 9999);
  const bPlaces = vertical ? 1 : randomInt(1, 2);
  const b = vertical ? randomInt(2, 9) : randomInt(2, bPlaces === 1 ? 99 : 999);
  return {
    a: formatScaled(a, aPlaces),
    b: formatScaled(b, bPlaces),
    op: "×",
    answer: formatScaled(a * b, aPlaces + bPlaces),
    answerPlaces: aPlaces + bPlaces,
  };
}

function makeDivide(randomInt, formatScaled, vertical) {
  const divisorPlaces = 1;
  const quotientPlaces = vertical ? 1 : randomInt(1, 2);
  const divisor = randomInt(2, 99);
  const quotient = randomInt(11, vertical ? 99 : (quotientPlaces === 1 ? 499 : 4999));
  const dividendPlaces = divisorPlaces + quotientPlaces;
  return {
    a: formatScaled(divisor * quotient, dividendPlaces),
    b: formatScaled(divisor, divisorPlaces),
    op: "÷",
    answer: formatScaled(quotient, quotientPlaces),
    answerPlaces: quotientPlaces,
  };
}

window.DECIMAL_WORKSHEET_APP = {
  id: "decimal-print-grade5", title: "5年生 小数のかけ算・わり算", defaultType: "mixed", defaultCount: 18, defaultColumns: 3, digitCount: 8, minDigitCount: 5,
  verticalTypes: ["multiply", "divide", "mixed"], types: [{ value: "multiply" }, { value: "divide" }, { value: "mixed" }],
  generate(type, { randomInt, choice, formatScaled }, settings) {
    const selected = type === "mixed" ? choice(["multiply", "divide"]) : type;
    return selected === "multiply" ? makeMultiply(randomInt, formatScaled, settings.layout === "vertical") : makeDivide(randomInt, formatScaled, settings.layout === "vertical");
  },
};
