import { getSMA } from "../moving-averages/sma.js";
import { getEMA } from "../moving-averages/ema.js";
import { findCrosses } from "../studies/findCrosses.js";
import {RSI} from 'trading-signals';

const ma = {getSMA, getEMA}

export const rsi = (close, period, movingAverage, movingAveragePeriod) => {

    const sliceData = close.slice(-(period*3))

    if(typeof period === 'number' && typeof movingAveragePeriod === 'undefined')
    {
        movingAveragePeriod = period
    }

    const col = getRSI(sliceData, period, movingAverage, movingAveragePeriod)

    return col   
}

export const getRSI = (data, period = 14, movingAverage = 'SMA', movingAveragePeriod = 14) => {


    if (data.length < period) {
        return [];
    }

    let rsi = []
    period = parseInt(period)
    movingAveragePeriod = parseInt(movingAveragePeriod)
    const instance = new RSI(period)
    const dataLength = data.length

    for(let x = 0; x < dataLength; x++)
    {
        let value = null
        instance.update(data[x])
        
        try
        {
            value = instance.getResult()
        }
        catch(err)
        {
            value = null
        }
    
        rsi.push(value)
    }

    rsi = rsi.filter(v => v)

    let output = {[`rsi_${period}`]: rsi}

    if(typeof movingAverage === 'string' && typeof movingAveragePeriod === 'number')
    {
        if(ma.hasOwnProperty(`get${movingAverage}`))
        {
            const rsi_smoothed = ma[`get${movingAverage}`](rsi, movingAveragePeriod)
            output[`rsi_${movingAverage}_${movingAveragePeriod}`] = rsi_smoothed
            output[`rsi_${period}_x_rsi_${movingAverage}_${movingAveragePeriod}`] = findCrosses(rsi, rsi_smoothed)
        }
    }

    return output
}
