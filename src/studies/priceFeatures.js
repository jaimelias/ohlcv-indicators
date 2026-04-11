

const isBadNumber = (v) => v == null || !Number.isFinite(v)

export const priceFeatures  = (main, index, {lag, colKeys, retLogs}) => {
    const { verticalOhlcv } = main

    const getRet = (next, prev) => (retLogs) ? Math.log(next / prev) : (next - prev) / prev
    const prefix = (retLogs) ? 'ret_log_' : 'ret_'

    if(index === 0) {
        const {len} = main

        const newCols = {
            [`${prefix}change`]: new Float64Array(len).fill(NaN),
            [`${prefix}mid_price_change`]: new Float64Array(len).fill(NaN),
            [`${prefix}upper_wick`]: new Float64Array(len).fill(NaN),
            [`${prefix}lower_wick`]: new Float64Array(len).fill(NaN),
            [`${prefix}gap`]: new Float64Array(len).fill(NaN),
            [`${prefix}body`]: new Float64Array(len).fill(NaN),
            [`${prefix}range`]: new Float64Array(len).fill(NaN)
        }

        for(const target of colKeys) {
            if(!verticalOhlcv.hasOwnProperty(target)) {
                throw new Error(
                    `Target property ${target} not found in verticalOhlcv for "priceFeatures".`
                );
            }

            newCols[`${prefix}${target}`] = new Float64Array(len).fill(NaN)
        }

        Object.assign(verticalOhlcv, newCols)

        if(lag) {
            main.lag(Object.keys(newCols), lag)
        }
    }

    const prevClose = verticalOhlcv.close[index - 1]
    const prevOpen = verticalOhlcv.open[index - 1]

    if(typeof prevClose === 'undefined') return

   

    const currOpen = verticalOhlcv.open[index]
    const currHigh = verticalOhlcv.high[index]
    const currLow = verticalOhlcv.low[index]
    const currClose = verticalOhlcv.close[index]
    
    const prevMidPrice = (prevClose + prevOpen) / 2
    const currMidPrice = (currOpen + currClose) / 2

    const upperWickTop = Math.max(currOpen, currClose)
    const lowerWickTop = Math.min(currOpen, currClose)

    const row = {
        [`${prefix}change`]: getRet(currClose, prevClose),
        [`${prefix}mid_price_change`]: getRet(currMidPrice, prevMidPrice),
        [`${prefix}upper_wick`]: getRet(currHigh, upperWickTop),
        [`${prefix}lower_wick`]: getRet(lowerWickTop, currLow),
        [`${prefix}gap`]: getRet(currOpen, prevClose),
        [`${prefix}body`]: getRet(currClose, currOpen),
        [`${prefix}range`]: getRet(currHigh, currLow)
    }

    let hasInvalidTarget = false

    for(const target of colKeys) {
        const targetVal = verticalOhlcv[target][index]

        if(isBadNumber(targetVal)) {
            hasInvalidTarget = true
            break
        }

        const targetRet = getRet(currClose, targetVal)
        row[`${prefix}${target}`] = targetRet
    }

    if(hasInvalidTarget) return

    for(const [key, value] of Object.entries(row)) {
         main.pushToMain({index, key, value})
    }

}