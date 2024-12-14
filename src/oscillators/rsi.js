import {FasterRSI} from 'trading-signals';
import { FasterSMA } from 'trading-signals';


export const rsi = (main, index, size) => {
    
    const value = main.verticalOhlcv.close[index]

    if(!main.instances.hasOwnProperty(`rsi_${size}`))
    {
        main.autoCrossPairsList.push({fast: `rsi_${size}`, slow: `rsi_sma_${size}`})
        main.instances[`rsi_${size}`] = new FasterRSI(size)
        main.instances[`rsi_sma_${size}`] = new FasterSMA(size)
        main.verticalOhlcv[`rsi_${size}`] = new Array(main.len).fill(null)
        main.verticalOhlcv[`rsi_sma_${size}`] = new Array(main.len).fill(null)
    }
    
    let currentRsi
    let smoothedRsi

    main.instances[`rsi_${size}`].update(value)

    try
    {
        currentRsi = main.instances[`rsi_${size}`].getResult()
    } catch(err) {
        currentRsi = null
    }
    
    if(currentRsi)
    {
        main.verticalOhlcv[`rsi_${size}`][index] = currentRsi
        main.instances[`rsi_sma_${size}`].update(currentRsi)
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
        main.verticalOhlcv[`rsi_sma_${size}`][index] = smoothedRsi
    }

    return true
}