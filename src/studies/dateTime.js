export const dateTime = (main, index) => {

    const {instances, verticalOhlcv} = main
 
    if(index === 0)
    {
        const {nullArray, isValidDate} = main
        if(!isValidDate) throw Error('dateTime method found and invalid "date" in input ohlcv')

        const index0DateStr = verticalOhlcv.date[0].slice(0, 10)

        Object.assign(instances, {
            dateTime: {
                prevDateStr: index0DateStr,
                sessionDailyIndexCount: 0,
                sessionIntradayIndexCount: 0,
                cachedDayInfo: index0DateStr
            }
        })

        Object.assign(verticalOhlcv, {
            day_of_the_week: [...nullArray],
            day_of_the_month: [...nullArray],
            week_of_the_month: [...nullArray],
            hour: [...nullArray],
            month: [...nullArray],
            year: [...nullArray],
            session_daily_index: [...nullArray],
            session_intraday_index: [...nullArray],
        })
    }

    const currDate = verticalOhlcv.date[index]
    const {
        day_of_the_week,
        day_of_the_month,
        week_of_the_month,
        month,
        year,
        hour,
    } = getDateInfo(currDate)


    const currDateStr = currDate.slice(0, 10)

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


    instances.dateTime.sessionIntradayIndexCount++

}



const getDateInfo = dateString => {
    const date = new Date(dateString)
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