import { validateInputValues } from '../utilities/validators.js'
import { initializeColumns } from '../core-functions/initializeColumns.js'

export const mapCols = (main, index, newCols, callback, {lag, isPriceBased, callbackParams = {}}) => {

    const {verticalOhlcv, precision} = main

    if(index === 0)
    {
        if (callback === defaultMapColsCallback) {
            validateInputValues({ open: true, close: true }, verticalOhlcv, index, 'mapCols')
        }

        for(const key of newCols)
        {
            if(verticalOhlcv.hasOwnProperty(key)) {
                throw new Error(`New property "${key}" already exist in "verticalOhlcv" and can not be modified using mapCols.`)
            }
        }

        initializeColumns(main, newCols.map(key => ({
            key, type: 'Array', priceBased: precision && isPriceBased
        })), { lag })
    }

    const cols = callback({index, main, params: callbackParams})

    if(cols == null) return;

    for(const [key, value] of Object.entries(cols))
    {
        main.pushToMain({ index, key, value })
    }
}

export const defaultMapColsCallback = ({main, index}) => {
    const {verticalOhlcv} = main

    const close = verticalOhlcv.close[index]
    const open = verticalOhlcv.open[index-1]
    
    return {
        change: ((close - open) / open) * 100
    }
} 