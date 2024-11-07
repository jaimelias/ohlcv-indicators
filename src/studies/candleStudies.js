import {FasterSMA} from 'trading-signals';

export const candlesStudies = (main, period) => {

    const {inputOhlcv, len} = main

    const cols = getCandlesStudies(inputOhlcv, period, len)
    return cols
}

const getCandlesStudies = (inputOhlcv, period = 20, len) => {

    const getSize = (a, b) => Math.abs(a - b)
    

    //close > open
    let candle_direction = new Array(len).fill(null) //scaled candle direction close > open = 1, else 0
    let candle_body_size = new Array(len).fill(null) //scaled body size (0, 0.5 and 1)
    let candle_top_size = new Array(len).fill(null) //scaled top size (0, 0.5 and 1)
    let candle_bottom_size = new Array(len).fill(null) //scaled bottom size(0, 0.5 and 1)
    let candle_gap_size = new Array(len).fill(null) //scaled gap between the current open and previous close (0, 0.5 and 1)

    //instances
    let bodyInstance = new FasterSMA(period)
    let topInstance = new FasterSMA(period)
    let bottomInstance = new FasterSMA(period)
    let gapInstance = new FasterSMA(parseInt(period/2))

    for(let x = 0; x < len; x++)
    {
        const curr = inputOhlcv[x]
        const prev = inputOhlcv[x-1]

        if(typeof prev === 'undefined')
        {
            continue
        }

        const {open, high, low, close} = curr
        const gapSize = calculateHighLowEmptyGaps(curr, prev) 
        let bodySizeMean = null
        let gapSizeMean = null
        let bottomSizeMean = null
        let topSizeMean = null
        const bodySize = getSize(open, close)
        let topSize
        let bottomSize
        let candleDirection = (close > open) ? 1 : 0 // 1 for bullish and 0 for bearish

        if(candleDirection === 1)
        {
            topSize = getSize(high, close)
            bottomSize = getSize(open, low)
        }
        else
        {
            topSize = getSize(high, open)
            bottomSize = getSize(close, low)
        }

        bodyInstance.update(bodySize)
        topInstance.update(topSize)
        bottomInstance.update(bottomSize)

        if(gapSize)
        {
            gapInstance.update(gapSize)
        }
        
        try
        {
            bodySizeMean = bodyInstance.getResult()
            topSizeMean = topInstance.getResult()
            bottomSizeMean = bottomInstance.getResult()
            gapSizeMean = gapInstance.getResult()
        }
        catch(err)
        {
            bodySizeMean = null
            gapSizeMean = null
        }

        candle_direction[x] = candleDirection

        //body
        candle_body_size[x] = classifySize(bodySize, bodySizeMean, 0.25)
        
        //top
        candle_top_size[x] = classifySize(topSize, topSizeMean, 0.1)
        
        //bottom
        candle_bottom_size[x] = classifySize(bottomSize, bottomSizeMean, 0.1)

        //gap
        candle_gap_size[x] = classifySize(gapSize, gapSizeMean, 0.25)

    }

    return {
        candle_direction,
        candle_gap_size,
        candle_body_size,
        candle_top_size,
        candle_bottom_size
    }
}


const classifySize = (value, mean, threshold = 0.25) => {
    if (value === null || mean === null) return null;

    const largeThreshold = mean * (1 + threshold * 4); // Adjusted threshold for 'large'
    const smallThreshold = mean * (1 - threshold * 2); // Adjusted threshold for 'small'

    if (value > largeThreshold) {
        return 1; // Large
    } else if (value > smallThreshold) {
        return 0.5; // Medium
    } else {
        return 0; // Small
    }
};



const calculateHighLowEmptyGaps = (current, prev) => {
    // This function calculates the empty gaps between the current high/low and the previous high/low.
    // Gaps are zones where the highest highs and lowest lows of the previous and current candles do not touch.
    // If any of the values overlap, the gapSize is 0.

    if (!prev) return null; // No previous candle, so no gap

    const {open, high, low, close } = current;
    const { high: prevHigh, low: prevLow } = prev;

    const highs = [high, prevHigh]
    const lows = [low, prevLow]


    if(close > open)
    {
        highs.push(close)
        lows.push(open)
    }
    else
    {
        highs.push(open)
        lows.push(close)        
    }


    const maxHigh = Math.max(high, prevHigh)
    const minLow = Math.min(low, prevLow)
    const fullSize = maxHigh - minLow
    const prevSize = Math.abs(prevHigh - prevLow)
    const currentSize = Math.abs(high-low)
    const gapSize = fullSize - (prevSize+currentSize)

    return (gapSize > 0) ? gapSize : 0.01
}