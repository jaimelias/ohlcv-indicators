import { findCrosses } from "../utilities.js";
import { getEMA } from "./ema.js";


export const MACD = (main, fastLine = 12, slowLine = 26, signalLine = 9) => {
    const {ohlcv} = main
    const data = ohlcv['close']
    const macd = getMACD(data, fastLine, slowLine, signalLine)

    for(let k in macd)
    {
        main.addColumn(k, macd[k]);
    }
}

export const getMACD = (data, fastLine = 12, slowLine = 26, signalLine = 9) => {

    const fastEMA = getEMA(data, fastLine)
    const slowEMA = getEMA(data, slowLine)

    // Calculate the MACD line (diff)
    const diff = fastEMA.map((o, i) => (isNaN(o) || isNaN(slowEMA[i])) ? null : o - slowEMA[i]);    

    // Calculate the MACD line (dea)
    const dea = getEMA(diff, signalLine)

    // Calculate the MACD line (histogram)
    const histogram = diff.map((d, i) => d - dea[i])
    const x = findCrosses(diff, dea)

	return {
		'macd_diff': diff, 
		'macd_dea': dea,
		'macd_histogram': histogram,
        'macd_diff_x_macd_dea': x
    }
}