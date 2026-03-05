
const getRet = (next, prev) => (next - prev) / prev 
const isBadNumber = (v) => v == null || !Number.isFinite(v)

export const priceFeatures  = (main, index, {lag, colKeys}) => {
    const { verticalOhlcv } = main

    if(index === 0) {
        const {len} = main

        const newCols = {
            ret_change: new Float64Array(len).fill(NaN),
            ret_upper_wick: new Float64Array(len).fill(NaN),
            ret_lower_wick: new Float64Array(len).fill(NaN),
            ret_gap: new Float64Array(len).fill(NaN),
            ret_body: new Float64Array(len).fill(NaN),
            ret_range: new Float64Array(len).fill(NaN)
        }

        for(const target of colKeys) {
            if(!verticalOhlcv.hasOwnProperty(target)) {
                throw new Error(
                    `Target property ${target} not found in verticalOhlcv for "priceFeatures".`
                );
            }

            newCols[`ret_${target}`] = new Float64Array(len).fill(NaN)
        }

        Object.assign(verticalOhlcv, newCols)

        if(lag) {
            main.lag(Object.keys(newCols), lag)
        }
    }

    const prevClose = verticalOhlcv.close[index - 1]

    if(typeof prevClose === 'undefined') return

    const currOpen = verticalOhlcv.open[index]
    const currHigh = verticalOhlcv.high[index]
    const currLow = verticalOhlcv.low[index]
    const currClose = verticalOhlcv.close[index]

    const upperWickTop = Math.max(currOpen, currClose)
    const lowerWickTop = Math.min(currOpen, currClose)

    const row = {
        ret_change: getRet(currClose, prevClose),
        ret_upper_wick: getRet(currHigh, upperWickTop),
        ret_lower_wick: getRet(lowerWickTop, currLow),
        ret_gap: getRet(currOpen, prevClose),
        ret_body: getRet(currClose, currOpen),
        ret_range: getRet(currHigh, currLow)
    }

    let hasInvalidTarget = false

    for(const target of colKeys) {
        const targetVal = verticalOhlcv[target][index]

        if(isBadNumber(targetVal)) {
            hasInvalidTarget = true
            break
        }

        const targetRet = getRet(currClose, targetVal)
        row[`ret_${target}`] = targetRet
    }

    if(hasInvalidTarget) return

    for(const [key, value] of Object.entries(row)) {
         main.pushToMain({index, key, value})
    }

}