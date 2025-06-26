export const mapCols = (main, index, newCols, callback, {lag}) => {

    if(index + 1 > main.len) return

    const {verticalOhlcv, len, arrayTypes} = main

    if(index === 0)
    {

        for(const key of newCols)
        {
            if(verticalOhlcv.hasOwnProperty(key)) {
                throw new Error(`New property "${key}" already exist in "verticalOhlcv" and can not be modified using mapCols.`)
            }

            verticalOhlcv[key] = new Array(len).fill(0)
            arrayTypes[key] = 'Array'
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

    const currClose = verticalOhlcv.close[index]
    const prevClose = verticalOhlcv.close[index-1]
    
    if(typeof prevClose === 'undefined') return null

    return {
        change: (currClose - prevClose) / prevClose
    }
} 