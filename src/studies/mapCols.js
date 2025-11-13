export const mapCols = (main, index, newCols, callback, {lag, isPriceBased}) => {

    const {verticalOhlcv, len, priceBased, precision} = main

    if(index === 0)
    {
        for(const key of newCols)
        {
            if(verticalOhlcv.hasOwnProperty(key)) {
                throw new Error(`New property "${key}" already exist in "verticalOhlcv" and can not be modified using mapCols.`)
            }

            verticalOhlcv[key] = new Array(len).fill(0)

            if(precision && isPriceBased)
            {
                priceBased.add(key)
            }
        }

        if(lag > 0)
        {
            main.lag(newCols, lag)
        }
    }

    const cols = callback({index, main})

    if(cols == null) return true

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