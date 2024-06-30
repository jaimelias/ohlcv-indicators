import { findCrosses } from "../utilities.js";
import { getEMA } from "./ema.js";


export const MACD = (main, fastLine = 12, slowLine = 26, signalLine = 9) => {
    const ohlcv = main.getData()
    const data = ohlcv['close'];
    const macd = getMACD(main.BigNumber, data, fastLine, slowLine, signalLine)

    for(let k in macd)
    {
        main.addColumn(`macd_${k}`, macd[k]);
    }
}

export const getMACD = (BigNumber, data, fastLine = 12, slowLine = 26, signalLine = 9) => {

    const fastEMA = getEMA(BigNumber, data, fastLine)
    const slowEMA = getEMA(BigNumber, data, slowLine)

    // Calculate the MACD line (diff)
    const diff = fastEMA.map((o, i) => o.minus(slowEMA[i]));
    

    // Calculate the MACD line (dea)
    const dea = getEMA(BigNumber, diff, signalLine)

    // Calculate the MACD line (histogram)
    const histogram = diff.map((d, i) => d.minus(dea[i]))
    const crosses = findCrosses(BigNumber, diff, dea)

	return {
		diff, 
		dea,
		histogram,
        crosses
    }
}