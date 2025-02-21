export const dateTime = (main, index) => {

    if(index === 0)
    {

        if(!main.isValidDate) throw Error('dateTime method found and invalid "date" in input ohlcv')

        const index0DateStr = main.verticalOhlcv.date[0].slice(0, 10)

        Object.assign(main.instances, {
            dateTime: {
                prevDateStr: index0DateStr,
                sessionDailyIndexCount: 0,
                sessionIntradayIndexCount: 0,
                cachedDayInfo: index0DateStr
            }
        })

        Object.assign(main.verticalOhlcv, {
            day_of_the_week: [...main.nullArray],
            day_of_the_month: [...main.nullArray],
            week_of_the_month: [...main.nullArray],
            hour: [...main.nullArray],
            month: [...main.nullArray],
            year: [...main.nullArray],
            session_daily_index: [...main.nullArray],
            session_intraday_index: [...main.nullArray],
        })
    }

    const currDate = main.verticalOhlcv.date[index]
    const {
        day_of_the_week,
        day_of_the_month,
        week_of_the_month,
        month,
        year,
        hour,
    } = getDateInfo(currDate)


    const currDateStr = currDate.slice(0, 10)

    if(currDateStr !== main.instances.dateTime.prevDateStr)
    {
        main.instances.dateTime.prevDateStr = currDateStr
        main.instances.dateTime.sessionDailyIndexCount++
        main.instances.dateTime.sessionIntradayIndexCount = 0
    }

    main.pushToMain({index, key: 'session_daily_index', value:  main.instances.dateTime.sessionDailyIndexCount})
    main.pushToMain({index, key: 'session_intraday_index', value: main.instances.dateTime.sessionIntradayIndexCount})
    main.pushToMain({index, key: 'day_of_the_week', value: day_of_the_week})
    main.pushToMain({index, key: 'day_of_the_month', value: day_of_the_month})
    main.pushToMain({index, key: 'week_of_the_month', value: week_of_the_month})
    main.pushToMain({index, key: 'month', value: month})
    main.pushToMain({index, key: 'year', value: year})
    main.pushToMain({index, key: 'hour', value: hour})

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