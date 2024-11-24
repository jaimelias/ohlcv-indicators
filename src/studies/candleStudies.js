import {FasterSMA} from 'trading-signals'
import { classifySize } from '../utilities/classification.js'

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
    let candle_close_direction =  new Array(len).fill(null) //scaled shadow size curr.close - prev.close
    let candle_high_direction = new Array(len).fill(null) //scaled shadow size curr.high - prev.high
    let candle_low_direction = new Array(len).fill(null) //scaled shadow size curr.low - prev.low
    let candle_open_direction = new Array(len).fill(null) //scaled shadow size curr.open - prev.open

    //instances
    let topInstance 
    let bottomInstance
    let gapInstance
    let bodySizeInstance
    let shadowSizeInstance
    let closeDirectionInstance
    let highDirectionInstance
    let lowDirectionInstance
    let openDirectionInstance

    if(classify)
    {
        topInstance = new FasterSMA(period)
        bottomInstance = new FasterSMA(period)
        gapInstance = new FasterSMA(period)
        bodySizeInstance = new FasterSMA(period)
        shadowSizeInstance = new FasterSMA(period)
        closeDirectionInstance = new FasterSMA(period)
        highDirectionInstance = new FasterSMA(period)
        lowDirectionInstance = new FasterSMA(period)
        openDirectionInstance = new FasterSMA(period)
    }

    for(let x = 0; x < len; x++)
    {
        const curr = inputOhlcv[x]
        const prev = inputOhlcv[x-1]

        if(typeof prev === 'undefined') continue

        const {open, high, low, close} = curr


        //initial means
        let gapMean = null
        let bottomSizeMean = null
        let topSizeMean = null
        let bodySizeMean = null
        let shadowSizeMean = null
        let closeDirectionMean = null
        let highDirectionMean = null
        let lowDirectionMean = null
        let openDirectionMean = null

        //directions
        const isUp = close > open
        const candleBodySize = Math.abs(close - open)
        const shadowSize = Math.abs(curr.high - curr.low)

        //sizes
        const topSize = high - Math.max(open, close)
        const bottomSize = Math.min(open, close) - low
        const gapSize = Math.abs(prev.close - curr.open)
        const closeDirection = Math.abs(curr.close - prev.close)
        const highDirection = Math.abs(curr.high - prev.high)
        const lowDirection = Math.abs(curr.low - prev.low)
        const openDirection = Math.abs(curr.open - prev.open)

        if(classify)
        {
            //instances
            topInstance.update(Math.abs(topSize))
            bottomInstance.update(Math.abs(bottomSize))
            shadowSizeInstance.update(Math.abs(shadowSize))

            gapInstance.update(gapSize)
            bodySizeInstance.update(candleBodySize)
            closeDirectionInstance.update(closeDirection)
            highDirectionInstance.update(highDirection)
            lowDirectionInstance.update(lowDirection)
            openDirectionInstance.update(openDirection)
            
            try
            {
                topSizeMean = topInstance.getResult()
                bottomSizeMean = bottomInstance.getResult()
                gapMean = gapInstance.getResult()
                bodySizeMean = bodySizeInstance.getResult()
                shadowSizeMean = shadowSizeInstance.getResult()
                closeDirectionMean = closeDirectionInstance.getResult()
                highDirectionMean = highDirectionInstance.getResult()
                lowDirectionMean = lowDirectionInstance.getResult()
                openDirectionMean = openDirectionInstance.getResult()
            }
            catch(err)
            {
                bodySizeMean = null
                gapMean = null
                topSizeMean = null
                bottomSizeMean = null
                shadowSizeMean = null
                closeDirectionMean = null
                highDirectionMean = null
                lowDirectionMean = null
                openDirectionMean = null
            }

            //negatives and positives
            candle_body_size[x] = (isUp) 
            ? classifySize(candleBodySize, bodySizeMean, 2, changeLevel) 
            : -Math.abs(classifySize(candleBodySize, bodySizeMean, 2, changeLevel)) || 0;

            candle_gap_size[x] = (isUp) 
            ? classifySize(gapSize, gapMean, 2, changeLevel) 
            : -Math.abs(classifySize(gapSize, gapMean, 2, changeLevel)) || 0;

            candle_close_direction[x] = (isUp) 
            ? classifySize(closeDirection, closeDirectionMean, 2, changeLevel) 
            : -Math.abs(classifySize(closeDirection, closeDirectionMean, 2, changeLevel)) || 0;

            candle_high_direction[x] = (isUp) 
            ? classifySize(highDirection, highDirectionMean, 2, changeLevel) 
            : -Math.abs(classifySize(highDirection, highDirectionMean, 2, changeLevel)) || 0;  
            
            
            candle_low_direction[x] = (isUp) 
            ? classifySize(lowDirection, lowDirectionMean, 2, changeLevel) 
            : -Math.abs(classifySize(lowDirection, lowDirectionMean, 2, changeLevel)) || 0;

            candle_open_direction[x] = (isUp) 
            ? classifySize(openDirection, openDirectionMean, 2, changeLevel) 
            : -Math.abs(classifySize(openDirection, openDirectionMean, 2, changeLevel)) || 0;

            
            //positives only
            candle_top_size[x] = classifySize(topSize, topSizeMean, 0.5, sizeLevel)
            candle_bottom_size[x] = classifySize(bottomSize, bottomSizeMean, 0.5, sizeLevel)
            candle_shadow_size[x] = classifySize(shadowSize, shadowSizeMean, 0.5, sizeLevel)
        }
        else{
             //negatives and positives
             candle_body_size[x] = candleBodySize
             candle_gap_size[x] = gapSize
             candle_close_direction[x] = closeDirection
             candle_high_direction[x] = highDirection
             candle_low_direction[x] = lowDirection
 
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
        candle_close_direction,
        candle_high_direction,
        candle_low_direction,
        candle_open_direction
    }
}