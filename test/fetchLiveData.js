
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
        volume: convertCurrencyToFloat(z.volume)
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
        volume: convertCurrencyToFloat(volume)
    }]
}

const getDateRange = limit => {
    const toDate = new Date().toISOString().slice(0, 10) // Get today's date in yyyy-mm-dd format

    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - limit)
    const fromDateFormatted = fromDate.toISOString().slice(0, 10) // Get the date limit number of days ago in yyyy-mm-dd format

    return { fromDate: fromDateFormatted, toDate }
}