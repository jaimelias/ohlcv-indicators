export const dateTime = (main, index, {lag}) => {

    const {instances, verticalOhlcv} = main
 
    if(index === 0)
    {
        const {len, dateType, arrayTypes} = main
        if(!dateType) throw Error('dateTime method found and invalid "date" in input ohlcv')

        Object.assign(instances, {
            dateTime: {
                prevDateStr: verticalOhlcv.date[0],
                sessionDailyIndexCount: 0,
                sessionIntradayIndexCount: 0,
                cachedDayInfo: verticalOhlcv.date[0]
            }
        })

        const colKeys = ['day_of_the_week', 'day_of_the_month', 'week_of_the_month', 'minute', 'hour', 'month', 'year', 'session_daily_index', 'session_intraday_index']

        for(const key of colKeys)
        {
            arrayTypes[key] = 'Int32Array'
        }

        Object.assign(verticalOhlcv, {...Object.fromEntries(colKeys.map(k => [k, new Int32Array(len).fill(NaN)]))})

        if(lag > 0)
        {
            main.lag(colKeys, lag)
        }
    }


    const currDate = verticalOhlcv.date[index]

    const {
        day_of_the_week,
        day_of_the_month,
        week_of_the_month,
        month,
        year,
        hour,
        minute
    } = getDateInfo(currDate)


    const currDateStr = currDate

    if(currDateStr !== instances.dateTime.prevDateStr)
    {
        instances.dateTime.prevDateStr = currDateStr
        instances.dateTime.sessionDailyIndexCount++
        instances.dateTime.sessionIntradayIndexCount = 0
    }

    

    main.pushToMain({index, key: 'session_daily_index', value:  instances.dateTime.sessionDailyIndexCount})
    main.pushToMain({index, key: 'session_intraday_index', value: instances.dateTime.sessionIntradayIndexCount})
    main.pushToMain({index, key: 'day_of_the_week', value: day_of_the_week})
    main.pushToMain({index, key: 'day_of_the_month', value: day_of_the_month})
    main.pushToMain({index, key: 'week_of_the_month', value: week_of_the_month})
    main.pushToMain({index, key: 'month', value: month})
    main.pushToMain({index, key: 'year', value: year})
    main.pushToMain({index, key: 'hour', value: hour})
    main.pushToMain({index, key: 'minute', value: minute})


    instances.dateTime.sessionIntradayIndexCount++

}



const getDateInfo = date => {
    const month = date.getMonth()
    const year = date.getFullYear()
    const hour = date.getHours()
    const minute = date.getMinutes()
    const day_of_the_week = date.getDay();
    const day_of_the_month = date.getDate();
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const dayOffset = firstDayOfMonth.getDay();
    const week_of_the_month = Math.ceil((day_of_the_month + dayOffset) / 7)

    return {
        month,
        year,
        hour,
        minute,
        day_of_the_week,
        day_of_the_month,
        week_of_the_month,
    }
}