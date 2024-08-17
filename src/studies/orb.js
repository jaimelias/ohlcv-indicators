import { findCrosses } from "./findCrosses.js"

export const orb = main => {
    const {inputOhlcv, len, precision, verticalOhlcv} = main
    const {close} = verticalOhlcv
    const cols = getOrbOfTheFirstCandle(inputOhlcv, close, len, precision)
    return cols
}

const getOrbOfTheFirstCandle = (inputOhlcv, close, len, precision) => {
    const orb_high = new Array(len).fill(0)
    const orb_low = new Array(len).fill(0)
    let startIndex = 0
    let currentDate = null
    let firstCandleHigh = 0
    let firstCandleLow = 0

    for (let i = 0; i < len; i++) {
        const current = inputOhlcv[i]

        if(i === 0){
            if(!current.hasOwnProperty('date'))
            {
                throw Error(`input ohlcv array must have a date property available in candle datapoint`)
            }
        }

        const date = current.date.split(' ')[0]

        if (date !== currentDate) {
            currentDate = date;
            firstCandleHigh = current.high
            firstCandleLow = current.low
        }

        orb_high[startIndex] = firstCandleHigh
        orb_low[startIndex] = firstCandleLow
        startIndex++
    }

    return {orb_high, orb_low}
}
