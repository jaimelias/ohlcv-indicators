export const candles = main => {

    const {inputOhlcv} = main
    const cols = getCandlestickPattern(inputOhlcv);
    return cols;
}

export const getCandlestickPattern = inputOhlcv => {
    const size = 2; //remove slice for backtesting
    inputOhlcv = inputOhlcv.slice(-size);

    const candle_pattern = [];
    const candle_name = [];
    const candle_score = [];

    for (let x = 1; x < size; x++) {
        const curr = inputOhlcv[x];
        const prev = inputOhlcv[x - 1];

        let pattern = 'Neutral';
        let name = 'None';
        let score = 0;

        for (const patternObj of candlePatterns) {
            const { isSingleCandle, candle_name: patternName, candle_score: patternScore } = patternObj;
            const isMatch = isSingleCandle 
                ? candleFunctions[patternName](curr) 
                : candleFunctions[patternName](prev, curr);

            if (isMatch) {
                if (score === 0) {
                    pattern = patternScore === 1 ? 'Bullish' : 'Bearish';
                    name = patternName;
                    score = patternScore;
                } else if (score !== patternScore) {
                    pattern = 'Neutral';
                    name = 'None';
                    score = 0;
                    break;
                } else {
                    name += `,${patternName}`;
                }
            }
        }

        candle_pattern.push(pattern);
        candle_name.push(name);
        candle_score.push(score);
    }

    return {
        candle_pattern,
        candle_name,
        candle_score
    }
}




const candlePatterns = [
    {
        candle_name: "isHammer",
        candle_score: 1,
        isSingleCandle: true
    },
    {
        candle_name: "isInvertedHammer",
        candle_score: 1,
        isSingleCandle: true
    },
    {
        candle_name: "isBullishHammer",
        candle_score: 1,
        isSingleCandle: true
    },
    {
        candle_name: "isBearishHammer",
        candle_score: -1,
        isSingleCandle: true
    },
    {
        candle_name: "isBullishInvertedHammer",
        candle_score: 1,
        isSingleCandle: true
    },
    {
        candle_name: "isBearishInvertedHammer",
        candle_score: -1,
        isSingleCandle: true
    },
    {
        candle_name: "isHangingMan",
        candle_score: -1,
        isSingleCandle: false
    },
    {
        candle_name: "isShootingStar",
        candle_score: -1,
        isSingleCandle: false
    },
    {
        candle_name: "isBullishEngulfing",
        candle_score: 1,
        isSingleCandle: false
    },
    {
        candle_name: "isBearishEngulfing",
        candle_score: -1,
        isSingleCandle: false
    },
    {
        candle_name: "isBullishHarami",
        candle_score: 1,
        isSingleCandle: false
    },
    {
        candle_name: "isBearishHarami",
        candle_score: -1
    },
    {
        candle_name: "isBullishKicker",
        candle_score: 1,
        isSingleCandle: false
    },
    {
        candle_name: "isBearishKicker",
        candle_score: -1,
        isSingleCandle: false
    }
]


const bodyLen = candlestick => Math.abs(candlestick.open - candlestick.close);

const wickLen = candlestick => candlestick.high - Math.max(candlestick.open, candlestick.close);

const tailLen = candlestick => Math.min(candlestick.open, candlestick.close) - candlestick.low;

const bodyEnds = candlestick => candlestick.open <= candlestick.close ?
  { bottom: candlestick.open, top: candlestick.close } :
  { bottom: candlestick.close, top: candlestick.open };

const isBullish = candlestick => candlestick.open < candlestick.close;

const isBearish = candlestick => candlestick.open > candlestick.close;

const isEngulfed = (previous, current) => 
  bodyEnds(previous).top <= bodyEnds(current).top &&
  bodyEnds(previous).bottom >= bodyEnds(current).bottom;

const hasGapUp = (previous, current) => 
  bodyEnds(previous).top < bodyEnds(current).bottom;

const hasGapDown = (previous, current) => 
  bodyEnds(previous).bottom > bodyEnds(current).top;

const isHammer = candlestick => 
  tailLen(candlestick) > (bodyLen(candlestick) * 2) &&
  wickLen(candlestick) < bodyLen(candlestick);

const isInvertedHammer = candlestick => 
  wickLen(candlestick) > (bodyLen(candlestick) * 2) &&
  tailLen(candlestick) < bodyLen(candlestick);

const isBullishHammer = candlestick => 
  isBullish(candlestick) && isHammer(candlestick);

const isBearishHammer = candlestick => 
  isBearish(candlestick) && isHammer(candlestick);

const isBullishInvertedHammer = candlestick => 
  isBullish(candlestick) && isInvertedHammer(candlestick);

const isBearishInvertedHammer = candlestick => 
  isBearish(candlestick) && isInvertedHammer(candlestick);

const isHangingMan = (previous, current) => 
  isBullish(previous) && isBearishHammer(current) && hasGapUp(previous, current);

const isShootingStar = (previous, current) => 
  isBullish(previous) && isBearishInvertedHammer(current) && hasGapUp(previous, current);

const isBullishEngulfing = (previous, current) => 
  isBearish(previous) && isBullish(current) && isEngulfed(previous, current);

const isBearishEngulfing = (previous, current) => 
  isBullish(previous) && isBearish(current) && isEngulfed(previous, current);

const isBullishHarami = (previous, current) => 
  isBearish(previous) && isBullish(current) && isEngulfed(current, previous);

const isBearishHarami = (previous, current) => 
  isBullish(previous) && isBearish(current) && isEngulfed(current, previous);

const isBullishKicker = (previous, current) => 
  isBearish(previous) && isBullish(current) && hasGapUp(previous, current) && 
  !(isHammer(current) || isInvertedHammer(current));

const isBearishKicker = (previous, current) => 
  isBullish(previous) && isBearish(current) && hasGapDown(previous, current) && 
  !(isHammer(current) || isInvertedHammer(current));

const findPattern = (dataArray, callback) => {
  const paramCount = callback.length;
  const upperBound = dataArray.length - paramCount;
  const results = [];

  for (let i = 0; i <= upperBound; i++) {
    const values = [];

    for (let j = 0; j < paramCount; j++) {
      values.push(dataArray[i + j]);
    }

    if (callback(...values)) {
      results.push(i);
    }
  }

  return results;
}

const hammer = dataArray => findPattern(dataArray, isHammer);

const invertedHammer = dataArray => findPattern(dataArray, isInvertedHammer);

const bullishHammer = dataArray => findPattern(dataArray, isBullishHammer);

const bearishHammer = dataArray => findPattern(dataArray, isBearishHammer);

const bullishInvertedHammer = dataArray => findPattern(dataArray, isBullishInvertedHammer);

const bearishInvertedHammer = dataArray => findPattern(dataArray, isBearishInvertedHammer);

const hangingMan = dataArray => findPattern(dataArray, isHangingMan);

const shootingStar = dataArray => findPattern(dataArray, isShootingStar);

const bullishEngulfing = dataArray => findPattern(dataArray, isBullishEngulfing);

const bearishEngulfing = dataArray => findPattern(dataArray, isBearishEngulfing);

const bullishHarami = dataArray => findPattern(dataArray, isBullishHarami);

const bearishHarami = dataArray => findPattern(dataArray, isBearishHarami);

const bullishKicker = dataArray => findPattern(dataArray, isBullishKicker);

const bearishKicker = dataArray => findPattern(dataArray, isBearishKicker)


const candleFunctions = {
    isHammer, 
    isInvertedHammer, 
    isBullishHammer, 
    isBearishHammer, 
    isBullishInvertedHammer, 
    isBearishInvertedHammer,
    isHangingMan,
    isShootingStar,
    isBullishEngulfing,
    isBearishEngulfing,
    isBullishHarami,
    isBearishHarami,
    isBullishKicker,
    isBearishKicker
}