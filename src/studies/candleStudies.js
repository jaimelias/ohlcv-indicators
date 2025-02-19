import { FasterSMA, FasterBollingerBands } from 'trading-signals'
import { classifyBoll } from '../utilities/classification.js'

const diff = (a, b) => a - b

export const candleStudies = (main, index, size, stdDev, {lag, scale}) => {

    const { verticalOhlcv, instances, lastIndexReplace } = main

    if(index === 0)
    {
        const {nullArray} = main

        Object.assign(verticalOhlcv, {
            candle_gap: [...nullArray],
            candle_body: [...nullArray],
            candle_top: [...nullArray],
            candle_bottom: [...nullArray],
            candle_close: [...nullArray],
            candle_high: [...nullArray],
            candle_low: [...nullArray],
            candle_open: [...nullArray],          
        })

        Object.assign(instances, {
            candleStudies: {
                bodyInstance: new FasterBollingerBands(size, stdDev),
                closeInstance: new FasterBollingerBands(size, stdDev),
                highInstance: new FasterBollingerBands(size, stdDev),
                lowInstance: new FasterBollingerBands(size, stdDev),
                openInstance: new FasterBollingerBands(size, stdDev)             
            }
        })

        if(lag > 0)
        {
            const keyNames = ['candle_body', 'candle_gap', 'candle_close', 'candle_high', 'candle_low', 'candle_open', 'candle_top', 'candle_bottom']
            main.lag(keyNames, lag)
        }
        
    }

    // If we do not have a previous candle, we cannot compute differences
    const prevOpen = verticalOhlcv.open[index-1]
    const prevHigh = verticalOhlcv.high[index-1]
    const prevLow = verticalOhlcv.low[index-1]
    const prevClose = verticalOhlcv.close[index-1]

    if (index === 0) return true

    const currOpen = verticalOhlcv.open[index]
    const currHigh = verticalOhlcv.high[index]
    const currLow = verticalOhlcv.low[index]
    const currClose = verticalOhlcv.close[index]


    //sizes
    const bodySize = diff(currClose, currOpen)
    const topSize = diff(currHigh, Math.max(currOpen, currClose))
    const bottomSize = diff(Math.min(currOpen, currClose), currLow)
    const gapSize = diff(prevClose, currOpen)
    const closeChange = diff(currClose, prevClose)
    const highChange = diff(currHigh, prevHigh)
    const lowChange = diff(currLow, prevLow)
    const openChange = diff(currOpen, prevOpen)

    let bodyBoll = null
    let closeBoll = null
    let highBoll = null
    let lowBoll = null
    let openBoll = null

    const {
        bodyInstance,
        closeInstance,
        highInstance,
        lowInstance,
        openInstance
    } = instances.candleStudies

    // Update instances with current absolute values
    bodyInstance.update(Math.abs(bodySize), lastIndexReplace)
    closeInstance.update(Math.abs(closeChange), lastIndexReplace)
    highInstance.update(Math.abs(highChange), lastIndexReplace)
    lowInstance.update(Math.abs(lowChange), lastIndexReplace)
    openInstance.update(Math.abs(openChange), lastIndexReplace)

    try {
        bodyBoll = bodyInstance.getResult()
        closeBoll = closeInstance.getResult()
        highBoll = highInstance.getResult()
        lowBoll = lowInstance.getResult()
        openBoll = openInstance.getResult()
    } catch (err) {
        // If there's not enough data, means remain null
    }


    console.log(scale)

    main.pushToMain({index, key: 'candle_close', value: classifyBoll(closeChange, closeBoll, scale)})
    main.pushToMain({index, key: 'candle_high', value: classifyBoll(highChange, highBoll, scale)})
    main.pushToMain({index, key: 'candle_low', value: classifyBoll(lowChange, lowBoll, scale)})
    main.pushToMain({index, key: 'candle_open', value: classifyBoll(openChange, openBoll, scale)})

    main.pushToMain({index, key: 'candle_body', value: classifyBoll(bodySize, bodyBoll, scale)})
    main.pushToMain({index, key: 'candle_gap', value: classifyBoll(gapSize, bodyBoll, scale)})
    main.pushToMain({index, key: 'candle_top', value: classifyBoll(topSize, bodyBoll, scale)})
    main.pushToMain({index, key: 'candle_bottom', value: classifyBoll(bottomSize, bodyBoll, scale)})

    return true
}


