import { getSMA } from "../moving-averages/sma.js";
import { getEMA } from "../moving-averages/ema.js";
import { findCrosses } from "../studies/findCrosses.js";
import {RSI, FasterRSI} from 'trading-signals';

const ma = {getSMA, getEMA}

export const rsi = (main, period, movingAverage, movingAveragePeriod) => {

    const {verticalOhlcv} = main
    const {close} = verticalOhlcv

    if(typeof period === 'number' && typeof movingAveragePeriod === 'undefined')
    {
        movingAveragePeriod = period
    }

    const col = getRSI(close, period, movingAverage, movingAveragePeriod)

    return col   
}

export const getRSI = (data, period = 14, movingAverage = 'SMA', movingAveragePeriod = 14) => {

    const dataLength = data.length

    if (dataLength < period) {
        return [];
    }

    let rsi = new Array(dataLength).fill(null)
    const instance = new FasterRSI(period)

    for(let x = 0; x < dataLength; x++)
    {
        let value = null

        if(data[x] !== null)
        {
            instance.update(data[x])
            
            try
            {
                value = instance.getResult()
            }
            catch(err)
            {
                value = null
            }
        }
    
        rsi[x] = value
    }

    let output = {[`rsi_${period}`]: rsi}

    if(typeof movingAverage === 'string' && typeof movingAveragePeriod === 'number')
    {
        if(ma.hasOwnProperty(`get${movingAverage}`))
        {
            const rsi_smoothed = ma[`get${movingAverage}`](rsi, movingAveragePeriod)
            output[`rsi_${movingAverage}_${movingAveragePeriod}`] = rsi_smoothed
            output[`rsi_${period}_x_rsi_${movingAverage}_${movingAveragePeriod}`] = findCrosses({fast: rsi, slow: rsi_smoothed})
        }
    }

    return output
}
