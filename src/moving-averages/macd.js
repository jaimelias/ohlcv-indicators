import { findCrosses } from "../studies/findCrosses.js";
import {EMA, MACD, FasterEMA, FasterMACD} from 'trading-signals';


export const macd = (main, fastLine, slowLine, signalLine) => {

    const {verticalOhlcv} = main
    const {close} = verticalOhlcv
    const col = getMACD(close, fastLine, slowLine, signalLine)

    return col
}

export const getMACD = (data, fastLine = 12, slowLine = 26, signalLine = 9) => {

    const dataLength = data.length
    const diff = new Array(dataLength).fill(null)
    const dea = new Array(dataLength).fill(null)
    const histogram = new Array(dataLength).fill(null)

    const instance = new FasterMACD(new FasterEMA(fastLine), new FasterEMA(slowLine), new FasterEMA(signalLine))

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
    
        diff[x] = obj.macd
        dea[x] = obj.signal
        histogram[x] = obj.histogram
    }

    const x = findCrosses({fast: diff, slow: dea})

	return {
		macd_diff: diff, 
		macd_dea: dea,
		macd_histogram: histogram,
        macd_diff_x_macd_dea: x
    }
}