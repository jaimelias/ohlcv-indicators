import {FasterSMA} from 'trading-signals';

export const candlesStudies = (main, period) => {

    const {inputOhlcv, len} = main

    const cols = getCandlesStudies(inputOhlcv, period, len)
    return cols
}

const getCandlesStudies = (inputOhlcv, period = 20, len) => {

    //close > open
    let candle_body_size = new Array(len).fill(null) //scaled candle direction close > open = 1, else 0
    let candle_top_size = new Array(len).fill(null) //scaled top size (0, 0.5 and 1)
    let candle_bottom_size = new Array(len).fill(null) //scaled bottom size(0, 0.5 and 1)
    let candle_gap_size = new Array(len).fill(null) //scaled gap between the current open and previous close (0, 0.5 and 1)

    //instances
    let topInstance = new FasterSMA(period)
    let bottomInstance = new FasterSMA(period)
    let gapInstance = new FasterSMA(period)
    let candleBodySizeInstance = new FasterSMA(period)

    for(let x = 0; x < len; x++)
    {
        const curr = inputOhlcv[x]
        const prev = inputOhlcv[x-1]

        if(typeof prev === 'undefined')
        {
            continue
        }

        const {open, high, low, close} = curr


        //initial means
        let gapMean = null
        let bottomSizeMean = null
        let topSizeMean = null
        let bodySizeMean = null

        //directions
        const candleBodySize = close - open // 1 for bullish and 0 for bearish

        //sizes
        const topSize = (candleBodySize > 0) ? high -  close : high - open
        const bottomSize = (candleBodySize > 0) ? open - low : close - low
        const gapSize = curr.open -  prev.close



        //instances
        topInstance.update(topSize)
        bottomInstance.update(bottomSize)
        gapInstance.update(gapSize)
        candleBodySizeInstance.update(candleBodySize)
        
        try
        {
            topSizeMean = topInstance.getResult()
            bottomSizeMean = bottomInstance.getResult()
            gapMean = gapInstance.getResult()
            bodySizeMean = candleBodySizeInstance.getResult()
        }
        catch(err)
        {
            bodySizeMean = null
            gapMean = null
            topSizeMean = null
            bottomSizeMean = null
        }

        //negatives and positives
        candle_body_size[x] = classifyChange(candleBodySize, bodySizeMean, 1.5)
        candle_gap_size[x] = classifyChange(gapSize, gapMean, 0.5)

        //positives only
        candle_top_size[x] = classifySize(topSize, topSizeMean, 0.5)
        candle_bottom_size[x] = classifySize(bottomSize, bottomSizeMean, 0.5)
        
    }

    return {
        candle_gap_size,
        candle_body_size,
        candle_top_size,
        candle_bottom_size
    }
}

const classifyChange = (value, mean, standardDeviation = 1.5) => {
    if (value === null || mean === null || standardDeviation === null) return null;

    const positiveLargeThreshold = mean + (1 * standardDeviation * 2); // Large positive (2σ above mean)
    const positiveSmallThreshold = mean + (1 * standardDeviation);     // Small positive (1σ above mean)
    const negativeSmallThreshold = mean - (1 * standardDeviation);     // Small negative (1σ below mean)
    const negativeLargeThreshold = mean - (1 * standardDeviation * 2); // Large negative (2σ below mean)

    if (value >= positiveLargeThreshold) {
        return 1; // Large positive
    } else if (value >= positiveSmallThreshold) {
        return 0.5; // Small positive
    } else if (value <= negativeLargeThreshold) {
        return -1; // Large negative
    } else if (value <= negativeSmallThreshold) {
        return -0.5; // Small negative
    } else {
        return 0; // No significant change
    }
}


const classifySize = (value, mean, standardDeviation = 1.5) => {
    if (value === null || mean === null || standardDeviation === null) return null;

    const largeThreshold = mean + (1 * standardDeviation * 2); // Large (2σ above mean)
    const smallThreshold = mean - (1 * standardDeviation);     // Small (1σ below mean)

    if (value > largeThreshold) {
        return 1; // Large
    } else if (value > smallThreshold) {
        return 0.5; // Medium
    } else {
        return 0; // Small
    }
}