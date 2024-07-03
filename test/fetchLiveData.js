
const apiRoot = 'https://nasdaq.jaimelias.workers.dev/api'
const convertCurrencyToFloat = str =>  parseFloat(str.replace(/[,$]/g, ''))

export const getOHLCV = async (symbol, limit) => {

    
    const oneDay = await (getOneDayOHLCV(symbol, limit))
    const latest = await getLatestOHLCV(symbol)

   return [...oneDay, ...latest]
}

const getOneDayOHLCV = async (symbol, limit) => {

    const {fromDate, toDate} = getDateRange(limit)
    const response = await fetch(`${apiRoot}/quote/${symbol}/chart?assetclass=stocks&fromdate=${fromDate}&todate=${toDate}`)
    const data = await response.json()
    const {chart} = data.data
    const ohlcv = chart.map(({z, x})=> ({
        open: convertCurrencyToFloat(z.open),
        high: convertCurrencyToFloat(z.high),
        low: convertCurrencyToFloat(z.low),
        close: convertCurrencyToFloat(z.close),
        volume: convertCurrencyToFloat(z.volume),
        ...convertNyMillisecondsToUtc(x) //{utcTimestamp, utcDate}
    }))

    return ohlcv
}

export const getLatestOHLCV = async (symbol) => {

    const response = await fetch(`${apiRoot}/quote/${symbol}/chart?assetClass=stocks`)
    const data = await response.json()
    const {chart, lastSalePrice, volume} = data.data
    const allValues = chart.map(o => convertCurrencyToFloat(o.z.value))

    return [{
        open: allValues[0],
        high: Math.max(...allValues),
        low: Math.min(...allValues),
        close: convertCurrencyToFloat(lastSalePrice),
        volume: convertCurrencyToFloat(volume),
        ...convertNyMillisecondsToUtc(chart[chart.length -1].x)
    }]
}

const getDateRange = limit => {
    const toDate = new Date().toISOString().slice(0, 10) // Get today's date in yyyy-mm-dd format

    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - limit)
    const fromDateFormatted = fromDate.toISOString().slice(0, 10) // Get the date limit number of days ago in yyyy-mm-dd format

    return { fromDate: fromDateFormatted, toDate }
};


export const fetchHistoricalOHLCV = async ({symbol, days}) => {

    //this function removes the lates "today result from output"

    const response = await fetch(`https://charting.nasdaq.com/data/charting/intraday?symbol=${symbol}&mostRecent=${days}&includeLatestIntradayData=1&`, {
        referrer: "https://charting.nasdaq.com/dynamic/chart.html"
      })

      const data = await response.json()
      const {marketData} = data


      const parsedData = marketData.map(o => ({
        value: o.Value,
        volume: o.Volume,
        data: o.Date,
        ...convertNYDateStringToUTC(o.Date)
      }))

      const lastItem = parsedData[parsedData.length - 1]
      const lastDay = new Date(lastItem.utcTimestamp);
      lastDay.setUTCHours(0, 0, 0, 0)
      const lastTimeStamp = lastDay.getTime()

      const filteredData = parsedData.filter(o => o.utcTimestamp < lastTimeStamp)

      return filteredData;
}


const convertNyMillisecondsToUtc = milliseconds => {
    // Create a new Date object using the milliseconds
    const nyDate = new Date(milliseconds);

    // Calculate the timezone offset in milliseconds (New York is UTC-5 or UTC-4 during Daylight Saving Time)
    const offset = nyDate.getTimezoneOffset() * 60000;

    // Create a new Date object in UTC by subtracting the offset
    const utcDate = new Date(milliseconds + offset);

    // Get the UTC milliseconds
    const utcMilliseconds = utcDate.getTime();

    // Get individual components of the date
    const year = utcDate.getUTCFullYear();
    const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0'); // Months are zero-indexed, so add 1
    const day = String(utcDate.getUTCDate()).padStart(2, '0');
    const hours = String(utcDate.getUTCHours()).padStart(2, '0');
    const minutes = String(utcDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(utcDate.getUTCSeconds()).padStart(2, '0');

    // Format the date string
    const utcDateString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    // Return the result as an object
    return {
        utcTimestamp: utcMilliseconds,
        utcDate: utcDateString
    };
}


function convertNYDateStringToUTC(dateString) {
    // Create a date object in the New York timezone
    const nyDate = new Date(dateString + ' GMT-0400');

    // Get the UTC date string
    const utcDateString = nyDate.toISOString().replace('T', ' ').substring(0, 19);

    // Get the UTC timestamp
    const utcTimestamp = nyDate.getTime();

    return {
        utcDateString: utcDateString,
        utcTimestamp: utcTimestamp
    };
}


export const convertToOHLCV = (data, intervalMinutes) => {
    const validMinuteIntervals = [5, 10, 15, 30, 45, 60, 120, 180, 240];
  
    if (!validMinuteIntervals.includes(intervalMinutes)) {
      const errMessage = `Invalid interval. Please use any of the following intervals: ${validMinuteIntervals.join(", ")}`;
      throw Error(errMessage);
    }
  
    const result = [];
    let tempGroup = [];
    let currentIntervalStart = null;
  
    data.forEach(item => {
      if (!currentIntervalStart) {
        currentIntervalStart = item.utcTimestamp;
      }
  
      if ((item.utcTimestamp - currentIntervalStart) < intervalMinutes * 60000) {
        tempGroup.push(item);
      } else {
        result.push(calculateOHLCV(tempGroup));
        tempGroup = [item];
        currentIntervalStart = item.utcTimestamp;
      }
    });
  
    if (tempGroup.length) {
      result.push(calculateOHLCV(tempGroup));
    }
  
    return result;
  };
  
  const calculateOHLCV = (group) => {
    const open = group[0].value;
    const close = group[group.length - 1].value;
    const high = Math.max(...group.map(item => item.value));
    const low = Math.min(...group.map(item => item.value));
    const volume = group[group.length - 1].volume;
    const utcDateString = group[group.length - 1].utcDateString;
    const utcTimestamp = group[group.length - 1].utcTimestamp;
  
    return { open, high, low, close, volume, utcDateString, utcTimestamp };
  };
  