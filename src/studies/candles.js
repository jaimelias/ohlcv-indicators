export const candles = ohlcv => {

    const cols = getCandlestickPattern(ohlcv);
    return cols;
}

export const getCandlestickPattern = ohlcv => {
    const { open, high, low, close } = ohlcv;
    const length = open.length;

    // Ensure input arrays are valid and of equal length
    if (![open, high, low, close].every(o => Array.isArray(o) && o.length > 1 && o.length === length)) {
        return { pattern: Array(length).fill('Neutral'), name: Array(length).fill('No Pattern'), score: Array(length).fill(0) };
    }

    // Helper function to check if two numbers are close
    const isCloseTo = (a, b, epsilon = 0.0001) => Math.abs(a - b) < epsilon;
    const isUp = o => o.close > o.open
    const isDown = o => o.close < o.open
    const isDouble = (large, small) => large > (small * 2)

    // Conditions for bullish and bearish patterns
    const conditions = {
        bullish: [
            {
                name: 'Marubozu',
                condition: (prev2, prev, curr) => isDown(prev2) && isDown(prev) && isUp(curr) && isDouble(curr, prev),
                score: 2
            },
            {
                name: 'Engulfing',
                condition: (prev, curr) => curr.open < prev.close && curr.close > prev.open && curr.low < prev.low && curr.high > prev.high,
                score: 2
            },
            {
                name: 'Kicker',
                condition: (prev, curr) => curr.open < prev.open && curr.close > curr.open && prev.close < prev.open,
                score: 2
            },
            {
                name: 'Morning Star',
                condition: (prev2, prev, curr) => prev2.close > prev2.open && prev.close < prev.open && curr.close > prev.open,
                score: 3
            },
            {
                name: 'Piercing Line',
                condition: (prev, curr) => curr.close > prev.close && curr.open < prev.open && curr.close > ((prev.open + prev.close) / 2),
                score: 1
            },
            {
                name: 'Belt Hold',
                condition: (prev, curr) => curr.open > prev.open && isCloseTo(curr.close, curr.high) && isCloseTo(prev.close, prev.low),
                score: 1
            },
            {
                name: 'Harami',
                condition: (prev, curr) => curr.open > prev.close && curr.close < prev.open && curr.open < prev.open && curr.close > prev.close,
                score: 1
            },
            {
                name: 'Doji',
                condition: (prev, curr) => isCloseTo(curr.close, curr.open) && (curr.high - curr.low) > Math.abs(curr.close - curr.open),
                score: 0
            }
        ],
        bearish: [
            {
                name: 'Marubozu',
                condition: (prev, curr) => isCloseTo(curr.open, curr.high) && isCloseTo(curr.close, curr.low),
                score: -2
            },
            {
                name: 'Engulfing',
                condition: (prev, curr) => curr.open > prev.close && curr.close < prev.open && curr.high > prev.high && curr.low < prev.low,
                score: -2
            },
            {
                name: 'Kicker',
                condition: (prev, curr) => curr.open > prev.open && curr.close < curr.open && prev.close > prev.open,
                score: -2
            },
            {
                name: 'Evening Star',
                condition: (prev2, prev, curr) => prev2.close < prev2.open && prev.close > prev.open && curr.close < prev.open,
                score: -3
            },
            {
                name: 'Dark Cloud Cover',
                condition: (prev, curr) => curr.close < prev.close && curr.open > prev.open && curr.close < ((prev.open + prev.close) / 2),
                score: -1
            },
            {
                name: 'Belt Hold',
                condition: (prev, curr) => curr.open < prev.open && isCloseTo(curr.close, curr.low) && isCloseTo(prev.close, prev.high),
                score: -1
            },
            {
                name: 'Harami',
                condition: (prev, curr) => curr.open < prev.close && curr.close > prev.open && curr.open > prev.open && curr.close < prev.close,
                score: -1
            },
            {
                name: 'Doji',
                condition: (prev, curr) => isCloseTo(curr.close, curr.open) && (curr.high - curr.low) > Math.abs(curr.close - curr.open),
                score: 0
            }
        ]
    };

    // Helper function to check priority of patterns
    const priorityCheck = (prev, curr, patterns, prev2 = null) => {
        for (const { name, condition, score } of patterns) {
            if (prev2) {
                if (condition(prev2, prev, curr)) {
                    return { name, score };
                }
            } else if (condition(prev, curr)) {
                return { name, score };
            }
        }
        return null;
    };

    // Arrays to store pattern results
    const patternArray = ['Neutral'];
    const nameArray = ['No Pattern'];
    const scoreArray = [0];

    // Loop through each data point starting from the second one
    for (let i = 2; i < length; i++) {
        const prev = {
            open: open[i - 1],
            high: high[i - 1],
            low: low[i - 1],
            close: close[i - 1]
        };

        const curr = {
            open: open[i],
            high: high[i],
            low: low[i],
            close: close[i]
        };

        const prev2 = {
            open: open[i - 2],
            high: high[i - 2],
            low: low[i - 2],
            close: close[i - 2]
        }

        const result = prev2 ? priorityCheck(prev, curr, conditions.bullish, prev2) || priorityCheck(prev, curr, conditions.bearish, prev2) :
            priorityCheck(prev, curr, conditions.bullish) || priorityCheck(prev, curr, conditions.bearish);

        if (result) {
            patternArray.push(result.score > 0 ? 'Bullish' : 'Bearish');
            nameArray.push(result.name);
            scoreArray.push(result.score);
        } else {
            patternArray.push('Neutral');
            nameArray.push('No Pattern');
            scoreArray.push(0);
        }
    }

    return {
        candle_pattern: patternArray,
        candle_name: nameArray,
        candle_score: scoreArray
    }
}
