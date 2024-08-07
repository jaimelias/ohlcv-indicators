import { findCrosses } from "../studies/findCrosses.js";
import {EMA, MACD, FasterEMA, FasterMACD} from 'trading-signals';


export const macd = (main, fastLine, slowLine, signalLine) => {

    const {verticalOhlcv, precision} = main
    const {close} = verticalOhlcv
    const maxSize = Math.max(fastLine, slowLine, signalLine)
    const sliceData = close.slice(-(maxSize*3))
    const col = getMACD(sliceData, fastLine, slowLine, signalLine, precision)

    return col
}

export const getMACD = (data, fastLine = 12, slowLine = 26, signalLine = 9, precision) => {

    const diff = []
    const dea = []
    const histogram = []

    const instance = (precision) ? new MACD({
        indicator: EMA,
        shortInterval: fastLine,
        longInterval: slowLine,
        signalInterval: signalLine
    }) : new FasterMACD(new FasterEMA(fastLine), new FasterEMA(slowLine), new FasterEMA(signalLine))

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

    const x = findCrosses(diff, dea, precision)

	return {
		macd_diff: diff, 
		macd_dea: dea,
		macd_histogram: histogram,
        macd_diff_x_macd_dea: x
    }
}