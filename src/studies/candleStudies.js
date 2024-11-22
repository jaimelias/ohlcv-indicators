import {FasterSMA} from 'trading-signals'
import { classifyChange, classifySize } from '../utilities/classification.js'

export const candlesStudies = (main, period, classify, classificationLevels) => {

    const {inputOhlcv, len} = main

    const cols = getCandlesStudies(inputOhlcv, period, len, classify, classificationLevels)
    return cols
}

const getCandlesStudies = (inputOhlcv, period = 20, len, classify = true, classificationLevels = {}) => {

    const {changeLevel = 7, sizeLevel = 5} = classificationLevels
 
    //close > open
    let candle_body_size = new Array(len).fill(null) //scaled candle direction close - open
    let candle_top_size = new Array(len).fill(null) //scaled top size (0, 0.5 and 1)
    let candle_bottom_size = new Array(len).fill(null) //scaled bottom size(0, 0.5 and 1)
    let candle_gap_size = new Array(len).fill(null) //scaled gap between the current open and previous close (-1 to 1)
    let candle_shadow_size = new Array(len).fill(null) //scaled shadow size high - slow
    let candle_position =  new Array(len).fill(null) //scaled shadow size curr.close - prev.close


    //instances
    let topInstance 
    let bottomInstance
    let gapInstance
    let bodySizeInstance
    let shadowSizeInstance
    let positionInstance

    if(classify)
    {
        topInstance = new FasterSMA(period)
        bottomInstance = new FasterSMA(period)
        gapInstance = new FasterSMA(period)
        bodySizeInstance = new FasterSMA(period)
        shadowSizeInstance = new FasterSMA(period)
        positionInstance = new FasterSMA(period)
    }

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
        let positionMean = null

        //directions
        const candleBodySize = close - open // 1 for bullish and 0 for bearish
        const shadowSize = curr.high - curr.low

        //sizes
        const topSize = high - Math.max(open, close)
        const bottomSize = Math.min(open, close) - low
        const gapSize = prev.close - curr.open
        const position = curr.close - prev.close

        if(classify)
        {
            //instances
            topInstance.update(Math.abs(topSize))
            bottomInstance.update(Math.abs(bottomSize))
            shadowSizeInstance.update(Math.abs(shadowSize))

            gapInstance.update(gapSize)
            bodySizeInstance.update(candleBodySize)
            positionInstance.update(position)
            
            
            try
            {
                topSizeMean = topInstance.getResult()
                bottomSizeMean = bottomInstance.getResult()
                gapMean = gapInstance.getResult()
                bodySizeMean = bodySizeInstance.getResult()
                shadowSizeMean = shadowSizeInstance.getResult()
                positionMean = positionInstance.getResult()
            }
            catch(err)
            {
                bodySizeMean = null
                gapMean = null
                topSizeMean = null
                bottomSizeMean = null
                shadowSizeMean = null
                positionMean = null
            }

            //negatives and positives
            candle_body_size[x] = classifyChange(candleBodySize, bodySizeMean, 0.5, changeLevel)
            candle_gap_size[x] = classifyChange(gapSize, gapMean, 0.5, changeLevel)
            candle_position[x] = classifyChange(position, positionMean, 0.5, changeLevel)

            //positives only
            candle_top_size[x] = classifySize(topSize, topSizeMean, 0.5, sizeLevel)
            candle_bottom_size[x] = classifySize(bottomSize, bottomSizeMean, 0.5, sizeLevel)
            candle_shadow_size[x] = classifySize(shadowSize, shadowSizeMean, 0.5, sizeLevel)
        }
        else{
             //negatives and positives
             candle_body_size[x] = candleBodySize
             candle_gap_size[x] = gapSize
             candle_position[x] = position
 
             //positives only
             candle_top_size[x] = topSize
             candle_bottom_size[x] = bottomSize
             candle_shadow_size[x] = shadowSize           
        }

    }

    return {
        candle_gap_size,
        candle_body_size,
        candle_top_size,
        candle_bottom_size,
        candle_shadow_size,
        candle_position
    }
}