import {oneHotEncode} from '../machine-learning/ml-utilities.js'
import { initializeColumns } from '../core-functions/initializeColumns.js'

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

    const dateInfo = getDateInfo(currDate, oneHot, colKeySizes, formatter)

    for(const [key, value] of Object.entries(dateInfo))
    {
        main.pushToMain({index, key, value})
    }
}



const getDateInfo = (date, oneHot, colKeySizes, formatter) => {


  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  const year = Number(parts.year);
  const month = Number(parts.month) - 1;
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const dayOfMonth = Number(parts.day) - 1;

  if (!oneHot) {
    return {
      year: year,
      month: month + 1,  //iso month
      hour: hour,
      minute: minute,
      day_of_the_week: ((dayOfWeek + 6) % 7) + 1, //iso date of the week
      day_of_the_month: dayOfMonth + 1,  //iso date of the month
    };
  }

  return {
    one_hot_month: oneHotEncode(month, colKeySizes.one_hot_month),
    one_hot_hour: oneHotEncode(hour, colKeySizes.one_hot_hour),
    one_hot_minute: oneHotEncode(minute, colKeySizes.one_hot_minute),
    one_hot_day_of_the_week: oneHotEncode(dayOfWeek, colKeySizes.one_hot_day_of_the_week),
    one_hot_day_of_the_month: oneHotEncode(dayOfMonth, colKeySizes.one_hot_day_of_the_month),
  };
};
