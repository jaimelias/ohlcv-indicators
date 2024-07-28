import { getSMA } from "../moving-averages/sma.js";
import { getEMA } from "../moving-averages/ema.js";
import { findCrosses } from "../utilities.js";
import { RSI } from "@debut/indicators";

const ma = {getSMA, getEMA}

export const rsi = (main, period, movingAverage, movingAveragePeriod) => {

    const {ohlcv} = main
    const data = ohlcv['close']
    const col = getRSI(data, period, movingAverage, movingAveragePeriod)

    for(let k in col)
    {
        main.addColumn(`${k}`.toLowerCase(), col[k])
    }
}

export const getRSI = (data, period = 14, movingAverage = 'SMA', movingAveragePeriod = 14) => {
    if (data.length < period) {
        return [];
    }

    let rsi = []
    period = parseInt(period)
    movingAveragePeriod = parseInt(movingAveragePeriod)
    const instance = new RSI(period)

    data.forEach(c => {

        rsi.push(instance.nextValue(c))

    })

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
