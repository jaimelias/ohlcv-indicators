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
    let candle_body_size_mean = new Array(len).fill(null)
    let candle_body_size_label = new Array(len).fill(null)

    //top
    let candle_top_size_mean = new Array(len).fill(null)
    let candle_top_size = new Array(len).fill(null)
    let candle_top_size_label = new Array(len).fill(null)

    //bottom
    let candle_bottom_size_mean = new Array(len).fill(null)
    let candle_bottom_size = new Array(len).fill(null)
    let candle_bottom_size_label = new Array(len).fill(null)


    //instances
    let bodyInstance = new FasterSMA(period)
    let topInstance = new FasterSMA(period)
    let bottomInstance = new FasterSMA(period)


    for(let x = 0; x < len; x++)
    {
        const {open, high, low, close} = inputOhlcv[x]
        let bodySizeMean = null
        let topSizeMean = null
        let bottomSizeMean = null
        const bodySize = getSize(open, close)
        let topSize
        let bottomSize
        let candleDirection = (close > open) ? 'bullish' : 'bearish'

        if(candleDirection === 'bullish')
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

        try
        {
            bodySizeMean = bodyInstance.getResult()
            topSizeMean = topInstance.getResult()
            bottomSizeMean = bottomInstance.getResult()
        }
        catch(err)
        {
            bodySizeMean = null
        }

        candle_direction[x] = candleDirection

        //body
        candle_body_size[x] = bodySize
        candle_body_size_mean[x] = bodySizeMean
        candle_body_size_label[x] = labelSize(bodySize, bodySizeMean)
        
        //top
        candle_top_size[x] = topSize
        candle_top_size_mean[x] = topSizeMean
        candle_top_size_label[x] = labelSize(topSize, topSizeMean)
        

        //bottom
        candle_bottom_size[x] = bottomSize
        candle_bottom_size_mean[x] = bottomSizeMean
        candle_bottom_size_label[x] = labelSize(bottomSize, bottomSizeMean)
        
    }

    return {
        candle_direction,
        candle_body_size_mean,
        candle_body_size,
        candle_body_size_label,
        candle_top_size_mean,
        candle_top_size,
        candle_top_size_label,
        candle_bottom_size_mean,
        candle_bottom_size,
        candle_bottom_size_label
    }
}

const labelSize = (value, mean) => {

    if(value === null || mean === null) return null
    if(value > mean * 1.25) return 'large'
    else if(value < mean * 0.75) return 'small'
    else return 'medium'
}