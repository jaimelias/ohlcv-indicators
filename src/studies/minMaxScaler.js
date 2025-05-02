const normalize = (value, min, max, [validMin, validMax]) => {
    const clamped = Math.min(Math.max(value, min), max)
    return ((clamped - min) / (max - min)) * (validMax - validMin) + validMin
}

export const minMaxScaler = (main, index, size, colKeys, group, range, lag) => {

    const { verticalOhlcv, instances, lastIndexReplace } = main;
    const prefix = 'minmax'
    let groupKey = ''

    if(index === 0)
    {
        const { nullArray, priceBased } = main;
        groupKey = `${prefix}_group_${colKeys.join('_')}`

        instances.minMaxScaler = {
            groupKeyLen: colKeys.length,
            groupKey,
            ranges: {}
        }

        for(const target of colKeys)
        {
            const key = `${prefix}_${target}`

            if (!verticalOhlcv.hasOwnProperty(target)) {
                throw new Error(`Target property "${target}" not found in verticalOhlcv for "minMaxScaler".`);
            }

            if(group === true)
            {
                if(!instances.minMaxScaler.ranges.hasOwnProperty(groupKey))
                {
                    instances.minMaxScaler.ranges[groupKey] = []
                }
            }
            else
            {
                if(!instances.minMaxScaler.ranges.hasOwnProperty(target))
                {
                    instances.minMaxScaler.ranges[target] = []
                }
            }


            verticalOhlcv[key] = [...nullArray]
            priceBased.push(key)

            if(lag > 0)
            {
                main.lag([key], lag)
            }
        }
    }

    const {minMaxScaler} = instances
    groupKey = minMaxScaler.groupKey

    for(const target of colKeys)
    {
        const value = verticalOhlcv[target][index]
        let rangeLen

        if(group === true)
        {
            rangeLen = minMaxScaler.ranges[groupKey].length

            if(lastIndexReplace === true)
            {
                minMaxScaler.ranges[groupKey][rangeLen -1] = value
            }
            else
            {
                minMaxScaler.ranges[groupKey].push(value)

                if(rangeLen > (size * minMaxScaler.groupKeyLen))
                {
                    minMaxScaler.ranges[groupKey].shift()
                }
            }
        }
        else
        {
            rangeLen = minMaxScaler.ranges[target].length

            if(lastIndexReplace === true)
            {
                minMaxScaler.ranges[target][rangeLen] = value
            }
            else
            {
                minMaxScaler.ranges[target].push(value)

                if(rangeLen > size)
                {
                    minMaxScaler.ranges[target].shift()
                }
            }
        }
    }

    const indexOk = (index + 1) >= size

    for(const target of colKeys)
    {
        const value = verticalOhlcv[target][index]
        let min
        let max
        let normalizedValue = null
        let key = `${prefix}_${target}`

        if(indexOk)
        {
            if(group === true)
            {
                min = Math.min(...minMaxScaler.ranges[groupKey])
                max = Math.max(...minMaxScaler.ranges[groupKey])
            }
            else
            {
                min = Math.min(...minMaxScaler.ranges[target])
                max = Math.max(...minMaxScaler.ranges[target])           
            }

            normalizedValue = normalize(value, min, max, range)
        }
        

        main.pushToMain({ index, key, value: normalizedValue })
    }
}