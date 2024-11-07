import {FasterSMA} from 'trading-signals';

export const candlesStudies = (main, period) => {

    const {inputOhlcv, len} = main

    const cols = getCandlesStudies(inputOhlcv, period, len)
    return cols
}

const getCandlesStudies = (inputOhlcv, period = 20, len) => {

    //close > open
    let candle_body_size = new Array(len).fill(null) //scaled candle direction close - open
    let candle_top_size = new Array(len).fill(null) //scaled top size (0, 0.5 and 1)
    let candle_bottom_size = new Array(len).fill(null) //scaled bottom size(0, 0.5 and 1)
    let candle_gap_size = new Array(len).fill(null) //scaled gap between the current open and previous close (-1 to 1)
    let candle_shadow_size = new Array(len).fill(null) //scaled shadow size high - slow

    //instances
    let topInstance = new FasterSMA(period)
    let bottomInstance = new FasterSMA(period)
    let gapInstance = new FasterSMA(period)
    let bodySizeInstance = new FasterSMA(period)
    let shadowSizeInstance = new FasterSMA(period)

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
        let shadowSizeMean = null

        //directions
        const candleBodySize = close - open // 1 for bullish and 0 for bearish

        //sizes
        const topSize = (candleBodySize > 0) ? high -  close : high - open
        const bottomSize = (candleBodySize > 0) ? open - low : close - low
        const gapSize = curr.open -  prev.close
        const shadowSize = curr.high - curr.low


        //instances
        topInstance.update(Math.abs(topSize))
        bottomInstance.update(Math.abs(bottomSize))
        shadowSizeInstance.update(Math.abs(shadowSize))

        gapInstance.update(gapSize)
        bodySizeInstance.update(candleBodySize)
        
        
        try
        {
            topSizeMean = topInstance.getResult()
            bottomSizeMean = bottomInstance.getResult()
            gapMean = gapInstance.getResult()
            bodySizeMean = bodySizeInstance.getResult()
            shadowSizeMean = shadowSizeInstance.getResult()
        }
        catch(err)
        {
            bodySizeMean = null
            gapMean = null
            topSizeMean = null
            bottomSizeMean = null
            shadowSizeMean = null
        }

        //negatives and positives
        candle_body_size[x] = classifyChange(candleBodySize, bodySizeMean, 0.5)
        candle_gap_size[x] = classifyChange(gapSize, gapMean, 0.5)

        //positives only
        candle_top_size[x] = classifySize(topSize, topSizeMean, 0.5)
        candle_bottom_size[x] = classifySize(bottomSize, bottomSizeMean, 0.5)
        candle_shadow_size[x] = classifySize(shadowSize, shadowSizeMean, 0.5)
    }

    return {
        candle_gap_size,
        candle_body_size,
        candle_top_size,
        candle_bottom_size,
        candle_shadow_size
    }
}

const classifyChange = (value, mean, standardDeviation = 0.5) => {
    if (value === null || mean === null || standardDeviation === null) return null;

    const largePositiveThreshold = mean + (2 * standardDeviation); // Large positive
    const mediumPositiveThreshold = mean + (1.5 * standardDeviation); // Medium positive (1.5σ)
    const smallPositiveThreshold = mean + (0.5 * standardDeviation); // Small positive (0.5σ)
    const smallNegativeThreshold = mean - (0.5 * standardDeviation); // Small negative (-0.5σ)
    const mediumNegativeThreshold = mean - (1.5 * standardDeviation); // Medium negative (-1.5σ)
    const largeNegativeThreshold = mean - (2 * standardDeviation); // Large negative

    if (value >= largePositiveThreshold) {
        return 1;    // Large positive
    } else if (value >= mediumPositiveThreshold) {
        return 0.75; // Medium positive
    } else if (value >= smallPositiveThreshold) {
        return 0.25; // Small positive
    } else if (value <= largeNegativeThreshold) {
        return -1;   // Large negative
    } else if (value <= mediumNegativeThreshold) {
        return -0.75; // Medium negative
    } else if (value <= smallNegativeThreshold) {
        return -0.25; // Small negative
    } else {
        return 0; // No significant change
    }
};



const classifySize = (value, mean, standardDeviation = 1.5) => {
    if (value === null || mean === null || standardDeviation === null) return null;

    const largeThreshold = mean + (2 * standardDeviation); // Large (2σ above mean)
    const mediumThreshold = mean + (1 * standardDeviation); // Medium (1σ above mean)
    const smallThreshold = mean - (1 * standardDeviation); // Small (1σ below mean)
    const verySmallThreshold = mean - (1.5 * standardDeviation); // Very small (1.5σ below mean)

    if (value > largeThreshold) {
        return 1; // Large
    } else if (value > mediumThreshold) {
        return 0.75; // Medium
    } else if (value > smallThreshold) {
        return 0.5; // Small
    } else if (value > verySmallThreshold) {
        return 0.25; // Very small
    } else {
        return 0; // Insignificant
    }
};
