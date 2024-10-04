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

    for(let x = 0; x < len; x++)
    {
        const prev = inputOhlcv[x-1]
        const {open, high, low, close} = inputOhlcv[x]
        const gapSize = (typeof prev !== 'undefined') ? Math.abs(prev.close - open) : null
        let bodySizeMean = null
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

        try
        {
            bodySizeMean = bodyInstance.getResult()
        }
        catch(err)
        {
            bodySizeMean = null
        }

        candle_direction[x] = candleDirection

        //body
        candle_body_size[x] = classifySize(bodySize, bodySizeMean)
        
        //top
        candle_top_size[x] = classifySize(topSize, bodySizeMean)
        
        //bottom
        candle_bottom_size[x] = classifySize(bottomSize, bodySizeMean)

        //gap
        candle_gap_size[x] = classifySize(gapSize, bodySizeMean)
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
const classifySize = (value, mean) => {

    if(value === null || mean === null) return null
    if(value > mean * 1.25) return 1
    else if(value < mean * 0.75) return 0
    else return 0.5
}