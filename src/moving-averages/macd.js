import { findCrosses } from "../studies/findCrosses.js";
import {EMA, MACD} from 'trading-signals';


export const macd = (main, fastLine, slowLine, signalLine) => {
    const {ohlcv} = main
    const data = ohlcv['close']
    const maxSize = Math.max(fastLine, slowLine, signalLine)
    const sliceData = data.slice(-(maxSize*3))
    const col = getMACD(sliceData, fastLine, slowLine, signalLine)

    return col
}

export const getMACD = (data, fastLine = 12, slowLine = 26, signalLine = 9) => {

    const diff = []
    const dea = []
    const histogram = []

    const instance = new MACD({
        indicator: EMA,
        shortInterval: fastLine,
        longInterval: slowLine,
        signalInterval: signalLine
    })

    const dataLength = data.length

    for(let x = 0; x < dataLength; x++)
    {
        let obj = {}
        instance.update(data[x])
        
        try
        {
            obj = instance.getResult()
        }
        catch(err)
        {
            obj = {macd: null, signal: null, histogram: null}
        }
    
        diff.push(obj.macd)
        dea.push(obj.signal)
        histogram.push(obj.histogram)
    }

    const x = findCrosses(diff, dea)

	return {
		macd_diff: diff, 
		macd_dea: dea,
		macd_histogram: histogram,
        macd_diff_x_macd_dea: x
    }
}