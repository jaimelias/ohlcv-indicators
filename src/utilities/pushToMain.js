export const pushToMain = ({main, index, key, value}) => {

    const {precision, priceBased, minMaxRanges, verticalOhlcv, autoMinMaxKeys, precisionMultiplier} = main

    if(value === null || typeof value === 'undefined')
    {
        main.invalidValueIndex = index //do not use let for main.invalidValueIndex

        for(const k of Object.keys(minMaxRanges))
        {
            minMaxRanges[k] = {min: Infinity, max: -Infinity}
        }

        verticalOhlcv[key][index] = null
        return false
    }

    verticalOhlcv[key][index] = value    

    if(typeof value === 'number' && !key.includes('_x_'))
    {
        const keyInAutoMinMax = autoMinMaxKeys.includes(key)

        if(key.includes('_diff_') && keyInAutoMinMax)
        {
            if(!minMaxRanges.hasOwnProperty(key) || (minMaxRanges[key].min === Infinity || minMaxRanges[key].max === -Infinity))
            {
                minMaxRanges[key] = { min: -1, max: 1}
            }
        }
        else if(key.startsWith('candle_') && keyInAutoMinMax)
        {
            minMaxRanges[key] = { min: -3, max: 3}
        }
        else if(key.includes('_range_') && keyInAutoMinMax)
        {
            minMaxRanges[key] = { min: 0, max: 1 }
        }
        else if(key.startsWith('rsi_') && keyInAutoMinMax)
        {
            minMaxRanges[key] = { min: 0, max: 1 }
        }
        else {
            const newValue = (precision && priceBased.includes(key)) ? (value / precisionMultiplier) : value

            if(!minMaxRanges.hasOwnProperty(key))
            {
                minMaxRanges[key] = { min: Infinity, max: -Infinity }
            }

            if(newValue < minMaxRanges[key].min)
            {
                minMaxRanges[key].min = newValue
            }
            if(newValue > minMaxRanges[key].max)
            {
                minMaxRanges[key].max = newValue
            }
        }
    }

    return true
}