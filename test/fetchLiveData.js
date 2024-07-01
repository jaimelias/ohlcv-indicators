
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


export const fetchIntraday = async () => {


    const response = await fetch("https://charting.nasdaq.com/data/charting/intraday?symbol=NVDA&mostRecent=1&includeLatestIntradayData=1&", {
        headers: {
          accept: "application/json",
          "accept-language": "es-ES,es;q=0.9,en;q=0.8",
          priority: "u=1, i",
          "sec-ch-ua": "\"Not/A)Brand\";v=\"8\", \"Chromium\";v=\"126\", \"Google Chrome\";v=\"126\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"macOS\"",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin"
        },
        referrer: "https://charting.nasdaq.com/dynamic/chart.html",
        referrerPolicy: "strict-origin-when-cross-origin",
        body: null,
        method: "GET",
        mode: "cors",
        credentials: "include"
      })

      const data = await response.json()

      return data

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
