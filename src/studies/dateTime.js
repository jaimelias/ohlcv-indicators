import {oneHotEncode} from '../machine-learning/ml-utilities.js'

export const dateTime = (main, index, {lag, oneHot, precompute}) => {

    

    const {instances, verticalOhlcv} = main
    const {prefix} = precompute

    if(index === 0)
    {
        const {len, dateType} = main
        if(!dateType) throw Error('dateTime method found and invalid "date" in input ohlcv')

        Object.assign(instances, {
            dateTime: {
                colKeys: [...precompute.colKeys, `${prefix}year`],
                colKeySizes: {
                    ...precompute.colKeySizes
                }
            }
        })

        const { colKeys } = instances.dateTime

        // choose your ctor, fill-value and type-name once
        const ctor     = oneHot ? Array     : Int16Array
        const fillVal  = oneHot ? null      : NaN

        // single loop instead of three
        for (const key of colKeys) {

            verticalOhlcv[key] = new ctor(len).fill(fillVal)

        }

        // finally, apply lag once
        if (lag > 0) {
        main.lag(colKeys, lag)
        }
    }

    const {colKeySizes} = instances.dateTime

    const currDate = verticalOhlcv.date[index]

    const dateInfo = getDateInfo(currDate, oneHot, colKeySizes)

    for(const [key, value] of Object.entries(dateInfo))
    {
        main.pushToMain({index, key, value})
    }
}



const getDateInfo = (date, oneHot, colKeySizes) => {


  const year = date.getFullYear();

  //start with 0 values
  const month = date.getMonth();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate() - 1; // keep same offset

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
