import {oneHotEncode} from '../machine-learning/ml-utilities.js'
import { initializeColumns } from '../core-functions/initializeColumns.js'

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const dateTime = (main, index, {lag, oneHot, precompute}) => {

    

    const {instances, verticalOhlcv} = main
    const {prefix} = precompute

    if(index === 0)
    {
        const {dateType} = main
        if(!dateType) throw Error('dateTime method found and invalid "date" in input ohlcv')

        Object.assign(instances, {
            dateTime: {
                formatter: new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
                    timeZone: main.timeZone,
                    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
                    hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
                }),
                colKeys: [...precompute.colKeys, `${prefix}year`].filter(v => v !== 'one_hot_year'),
                colKeySizes: {
                    ...precompute.colKeySizes
                }
            }
        })

        const { colKeys } = instances.dateTime

        initializeColumns(main, colKeys.map(key => ({
            key,
            type: oneHot ? 'Array' : 'Int16Array',
            fill: oneHot ? null : 0
        })), { lag })
    }

    const {colKeySizes, formatter} = instances.dateTime

    const currDate = verticalOhlcv.date[index]

    let yearPart, monthPart, hourPart, minutePart, weekdayPart, dayPart
    for (const part of formatter.formatToParts(currDate)) {
        switch (part.type) {
            case 'year': yearPart = part.value; break
            case 'month': monthPart = part.value; break
            case 'hour': hourPart = part.value; break
            case 'minute': minutePart = part.value; break
            case 'weekday': weekdayPart = part.value; break
            case 'day': dayPart = part.value; break
        }
    }
    const year = Number(yearPart)
    const month = Number(monthPart) - 1
    const hour = Number(hourPart)
    const minute = Number(minutePart)
    const dayOfWeek = weekdays.indexOf(weekdayPart)
    const dayOfMonth = Number(dayPart) - 1

    if (!oneHot) {
        main.pushToMain({ index, key: 'year', value: year })
        main.pushToMain({ index, key: 'month', value: month + 1 })
        main.pushToMain({ index, key: 'hour', value: hour })
        main.pushToMain({ index, key: 'minute', value: minute })
        main.pushToMain({ index, key: 'day_of_the_week', value: ((dayOfWeek + 6) % 7) + 1 })
        main.pushToMain({ index, key: 'day_of_the_month', value: dayOfMonth + 1 })
        return
    }

    // Build a fresh vector for every field and row before writing.
    const oneHotMonth = oneHotEncode(month, colKeySizes.one_hot_month)
    const oneHotHour = oneHotEncode(hour, colKeySizes.one_hot_hour)
    const oneHotMinute = oneHotEncode(minute, colKeySizes.one_hot_minute)
    const oneHotWeekday = oneHotEncode(dayOfWeek, colKeySizes.one_hot_day_of_the_week)
    const oneHotDay = oneHotEncode(dayOfMonth, colKeySizes.one_hot_day_of_the_month)

    main.pushToMain({ index, key: 'one_hot_month', value: oneHotMonth })
    main.pushToMain({ index, key: 'one_hot_hour', value: oneHotHour })
    main.pushToMain({ index, key: 'one_hot_minute', value: oneHotMinute })
    main.pushToMain({ index, key: 'one_hot_day_of_the_week', value: oneHotWeekday })
    main.pushToMain({ index, key: 'one_hot_day_of_the_month', value: oneHotDay })
}
