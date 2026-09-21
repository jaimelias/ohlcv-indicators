import { validateInputValues } from '../utilities/validators.js'
import { initializeColumns } from '../core-functions/initializeColumns.js'

const isBadNumber = (v) => v == null || !Number.isFinite(v)

export const candleFeatures  = (main, index, {lag, colKeys, retLogs}) => {
    const { verticalOhlcv, priceBased, scaledGroups } = main

    const getRet = (next, prev) => (retLogs) ? Math.log(next / prev) : (next - prev) / prev
    const prefix = (retLogs) ? 'ret_log_' : 'ret_'

    if(index === 0) {
        validateInputValues({ open: true, high: true, low: true, close: true }, verticalOhlcv, index, 'candleFeatures')

        const columns = [
            'change', 'mid_price_change', 'upper_wick', 'lower_wick',
            'gap', 'body', 'range'
        ].map(name => ({ key: `${prefix}${name}` }))

        for(const target of colKeys) {
            validateInputValues({ [target]: true }, verticalOhlcv, index, 'candleFeatures')

            if(!verticalOhlcv.hasOwnProperty(target)) {
                throw new Error(
                    `Target property in "options.colKey" array "${target}" not found in verticalOhlcv for "candleFeatures".`
                );
            }

            else if(!priceBased.has(target)) {
                 throw new Error(
                     `Target property in "options.colKey" array "${target}" not found in priceBased for "candleFeatures".`
                );               
            }

            columns.push({ key: `${prefix}${target}` })
        }

        scaledGroups.candleFeatures = initializeColumns(main, columns, { lag })
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