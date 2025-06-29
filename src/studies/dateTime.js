import {oneHotEncode} from '../machine-learning/ml-utilities.js'

export const dateTime = (main, index, {lag, oneHot, precompute}) => {

    

    const {instances, verticalOhlcv, notNumberKeys} = main
    const {prefix} = precompute

    if(index === 0)
    {
        const {len, dateType, arrayTypes} = main
        if(!dateType) throw Error('dateTime method found and invalid "date" in input ohlcv')

        const startYear = verticalOhlcv.date[0].getUTCFullYear()
        const currentYear = new Date().getUTCFullYear()

        Object.assign(instances, {
            dateTime: {
                colKeys: [...precompute.colKeys, `${prefix}year`],
                colKeySizes: {
                    ...precompute.colKeySizes,
                    [`${prefix}year`]: (currentYear - startYear) + 1
                }
                ,startYear
            }
        })

        const { colKeys } = instances.dateTime

        // choose your ctor, fill-value and type-name once
        const ctor     = oneHot ? Array     : Int16Array
        const fillVal  = oneHot ? null      : NaN
        const typeName = oneHot ? 'Array'   : 'Int16Array'

        // single loop instead of three
        for (const key of colKeys) {
        // 1) set the arrayType
        arrayTypes[key] = typeName

        // 2) allocate and fill the backing array
        verticalOhlcv[key] = new ctor(len).fill(fillVal)

        // 3) mark as non-numeric
        notNumberKeys.add(key)
        }

        // finally, apply lag once
        if (lag > 0) {
        main.lag(colKeys, lag)
        }
    }

    const {colKeySizes, startYear} = instances.dateTime

    const currDate = verticalOhlcv.date[index]

    const dateInfo = getDateInfo(currDate, oneHot, colKeySizes, prefix, startYear)

    for(const [key, value] of Object.entries(dateInfo))
    {
        main.pushToMain({index, key, value})
    }
}



const getDateInfo = (date, oneHot, colKeySizes, prefix, startYear) => {

    const encode = (value, size) => (oneHot) ? oneHotEncode(value, size) : value

    const output = {
        [`${prefix}year`]: date.getUTCFullYear(),
        [`${prefix}month`]: date.getUTCMonth(),
        [`${prefix}hour`]: date.getUTCHours(),
        [`${prefix}minute`]: date.getUTCMinutes(),
        [`${prefix}day_of_the_week`]: date.getUTCDay(),
        [`${prefix}day_of_the_month`]: date.getUTCDate() - 1,
    }

    for(const [key, size] of Object.entries(colKeySizes))
    {
        const value = (key === `${prefix}year`) ? output[key] - startYear: output[key]
        output[key] = encode(value, size)
    }

    return output
}

