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
  if (vertical) {
    const divisor = randomInt(6, 49) * 2;
    const quotient = randomInt(1, 9) * 10 + 5;
    const normalizedDividend = (divisor * quotient) / 10;
    const workDividend = normalizedDividend * 10;
    return {
      a: formatScaled(normalizedDividend, 1),
      b: formatScaled(divisor, 1),
      op: "÷",
      answer: formatScaled(quotient, 1),
      answerPlaces: 1,
      longDivision: {
        divisor,
        dividend: workDividend,
        quotient,
        divisorDigits: 2,
        dividendDecimalAfterIndex: String(normalizedDividend).length - 1,
        quotientDecimalAfterIndex: String(quotient).length - 2,
      },
    };
  }

  const divisorPlaces = 1;
  const quotientPlaces = randomInt(1, 2);
  const divisor = randomInt(2, 99);
  const quotient = randomInt(2, quotientPlaces === 1 ? 499 : 4999);
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
  id: "decimal-print-grade5", title: "5年生 小数のかけ算・わり算", defaultType: "mixed", defaultCount: 18, defaultColumns: 3, digitCount: 8,
  verticalTypes: ["multiply", "divide", "mixed"], verticalLongDivisionTypes: ["divide", "mixed"], longDivisionCountMax: 18, longDivisionColumnsMax: 3,
  types: [{ value: "multiply" }, { value: "divide" }, { value: "mixed" }],
  generate(type, { randomInt, choice, formatScaled }, settings) {
    const selected = type === "mixed" ? choice(settings.layout === "vertical" ? ["multiply", "divide"] : ["multiply", "divide"]) : type;
    return selected === "multiply"
      ? makeMultiply(randomInt, formatScaled, settings.layout === "vertical")
      : makeDivide(randomInt, formatScaled, settings.layout === "vertical");
  },
};
