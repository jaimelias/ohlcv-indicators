import {FasterRSI} from 'trading-signals';
import { FasterSMA } from 'trading-signals';


export const rsi = (main, index, size) => {
    
    const value = main.verticalOhlcv.close[index]

    if(index === 0)
    {
        main.crossPairsList.push({fast: `rsi_${size}`, slow: `rsi_sma_${size}`, isDefault: true})

        Object.assign(main.instances, {
            [`rsi_${size}`]: new FasterRSI(size),
            [`rsi_sma_${size}`]: new FasterSMA(size)
        })

        Object.assign(main.verticalOhlcv, {
            [`rsi_${size}`]: [...main.nullArray],
            [`rsi_sma_${size}`]: [...main.nullArray]
        })
    }
    
    let currentRsi
    let smoothedRsi

    main.instances[`rsi_${size}`].update(value, main.lastIndexReplace)

    try
    {
        currentRsi = main.instances[`rsi_${size}`].getResult()
    } catch(err) {
        currentRsi = null
    }
    
    if(currentRsi)
    {
        main.pushToMain({index, key: `rsi_${size}`, value: currentRsi})
        main.instances[`rsi_sma_${size}`].update(currentRsi, main.lastIndexReplace)
    }

    try
    {
        smoothedRsi = main.instances[`rsi_sma_${size}`].getResult()
    } catch(err)
    {
        smoothedRsi = null
    }

    if(smoothedRsi)
    {
        main.pushToMain({index, key: `rsi_sma_${size}`, value: smoothedRsi})
    }

    return true
}