//true if first row date starts with yyyy-mm-dd date
const validateFirstDate = arr => arr[0].hasOwnProperty('date') && typeof arr[0].date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(arr[0].date)

export const parseOhlcvToVertical = (input, len) => {
    const numberColsKeys = ['open', 'high', 'low', 'close', 'volume']
    const numberColsKeysSet = new Set(numberColsKeys)
    const verticalOhlcv = {}

    // Initialize arrays for numerical columns
    for (const key of numberColsKeys) {
        verticalOhlcv[key] = new Array(len)
    }

    // Extract other keys and initialize their arrays
    const inputKeys = Object.keys(input[0])
    const otherKeys = []

    for (const key of inputKeys) {
        if (!numberColsKeysSet.has(key)) {
            verticalOhlcv[key] = new Array(len)
            otherKeys.push(key)
        }
    }


    let prevDateStr
    let sessionIndex = 0
    let sessionIntradayIndex = 0
    const isValidDate = validateFirstDate(input)

    if(isValidDate)
    {
        verticalOhlcv['session_index'] = new Array(len)
        verticalOhlcv['session_intraday_index'] = new Array(len)
        prevDateStr = input[0].date.slice(0, 10)
    }
    
    for (let x = 0; x < len; x++) {
        const current = input[x]

        verticalOhlcv.open[x] = current.open
        verticalOhlcv.high[x] = current.high
        verticalOhlcv.low[x] = current.low
        verticalOhlcv.close[x] = current.close
        verticalOhlcv.volume[x] = current.volume

        // Process other keys
        for (const key of otherKeys) {
            verticalOhlcv[key][x] = current[key]
        }

        // Date processing for session indices
        if (isValidDate) {
            const thisDateStr = current.date.slice(0, 10)

            if (thisDateStr !== prevDateStr) {
                prevDateStr = thisDateStr
                sessionIndex++
                sessionIntradayIndex = 0
            }

            verticalOhlcv.session_index[x] = sessionIndex
            verticalOhlcv.session_intraday_index[x] = sessionIntradayIndex
            sessionIntradayIndex++
        }
    }

    return verticalOhlcv
}