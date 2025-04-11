export const pushToMain = ({main, index, key, value}) => {

    const {precision, priceBased, minMaxRanges, verticalOhlcv, precisionMultiplier} = main

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

    return true
}