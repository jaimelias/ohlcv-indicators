import {FasterSMA} from 'trading-signals';

export const candlesStudies = (main, period) => {

    const {inputOhlcv, len} = main

    const cols = getCandlesStudies(inputOhlcv, period, len)
    return cols
}

const getCandlesStudies = (inputOhlcv, period = 20, len) => {

    let getSize = (a, b) => Math.abs(a - b)

    let candle_direction = new Array(len).fill(null)

    //body
    let candle_body_size = new Array(len).fill(null)

    //top
    let candle_top_size = new Array(len).fill(null)

    //bottom
    let candle_bottom_size = new Array(len).fill(null)

    //gap between the current open and previous close
    let candle_gap_size = new Array(len).fill(null)

    //instances
    let bodyInstance = new FasterSMA(period)
    let gapInstance = new FasterSMA(parseInt(period/2))

    for(let x = 0; x < len; x++)
    {
        const {open, high, low, close} = inputOhlcv[x]
        const gapSize = (typeof inputOhlcv[x-1] !== 'undefined') 
            ? calculateHighLowEmptyGaps(inputOhlcv[x], inputOhlcv[x-1]) 
            : null
        let bodySizeMean = null
        let gapSizeMean = null
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

        if(gapSize)
        {
            gapInstance.update(gapSize)
        }
        

        try
        {
            bodySizeMean = bodyInstance.getResult()
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
        candle_top_size[x] = classifySize(topSize, bodySizeMean, 0.25)
        
        //bottom
        candle_bottom_size[x] = classifySize(bottomSize, bodySizeMean, 0.25)

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


// 1 for large, 0.5 for medium and 0 for small
const classifySize = (value, mean, number = 0.25) => {

    if(value === null || mean === null) return null
    if(value > mean * (number*5)) return 1
    else if(value < mean * (number*3)) return 0
    else return number * 2
}

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