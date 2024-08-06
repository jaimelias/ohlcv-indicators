import {ema} from './src/moving-averages/ema.js'
import {sma} from './src/moving-averages/sma.js'
import {macd} from './src/moving-averages/macd.js'
import {bollingerBands} from './src/moving-averages/bollingerBands.js'
import { rsi } from './src/oscillators/rsi.js'
import { volumeProfile } from './src/studies/volumeProfile.js'
import {crossPairs} from './src/studies/findCrosses.js'
import { candles } from './src/studies/candles.js'
import ChartPatterns from './src/studies/chart.js'
import {Big} from 'trading-signals';

export default class OHLCV_INDICATORS {
    constructor() {
        this.ChartPatterns = ohlcv => new ChartPatterns(ohlcv).init()
    }

    init(ohlcv) {

        this.crossPairsArr = []
        this.ohlcv = ohlcv.reduce((acc, { open, high, low, close, volume, ...rest }) => {
            acc.open.push(new Big(open))
            acc.high.push(new Big(high))
            acc.low.push(new Big(low))
            acc.close.push(new Big(close))
            acc.volume.push(new Big(volume))
            for (const key of Object.keys(rest)) {
                if (!acc[key]) acc[key] = [];
                acc[key].push(rest[key]);
            }
            return acc;
        }, { open: [], high: [], low: [], close: [], volume: [] })
        
        
        return this
    }

    getData() {

        
        const {ohlcv} = this
        const keys = Object.keys(ohlcv)
        const keysLength = keys.length

        return ohlcv.open.map((_, i) => {

            const row = {}

            for(let x = 0; x < keysLength; x++)
            {
                const header = keys[x]
                const value = ohlcv[header][i]


                row[header] = (value instanceof Big) ? value.toNumber() : value
            }

            return row
        })
    }
    getLastValues(){


        const output = {}

        for (const [k, arr] of Object.entries(this.ohlcv)) {
            let value = arr[arr.length - 1]
            output[k] = (value instanceof Big) ? value.toNumber(): value;
        }

        return output
    }

    addObjectColumns(obj) {

        for(const [key, arr] of Object.entries(obj))
        {
            this.addColumn(key, arr)
        }
    }

    addColumn(key, arr) {

        key = key.toLowerCase()
        const ohlcvLength = this.ohlcv.open.length;

        if (arr.length > ohlcvLength) {
            throw new Error(`Invalid column data: The length of the new column exceeds the length of the OHLCV data`);
        }
        
        // Use Array.prototype.unshift to add null elements efficiently
        const nanArray = new Array(ohlcvLength - arr.length).fill(null)
        arr = [...nanArray, ...arr]

        this.ohlcv[key] = arr
    }

    crossPairs(arr)
    {
        crossPairs(this, arr)

        return this
    }

    ema(size) {

        this.addObjectColumns(ema(this, size))

        return this
    }
    sma(size) {

        this.addObjectColumns(sma(this, size))
        
        return this
    }
    macd(fastLine, slowLine, signalLine) {

        this.addObjectColumns(macd(this, fastLine, slowLine, signalLine))
        
        return this
    }
    bollingerBands(data, size, times)
    {
        this.addObjectColumns(bollingerBands(this, data, size, times))

        return this
    }
    rsi(period, movingAverage, movingAveragePeriod)
    {

        this.addObjectColumns(rsi(this, period, movingAverage, movingAveragePeriod))
        
        return this
    }
    candles()
    {

        this.addObjectColumns(candles(this))
                
        
        return this
    }
    volumeProfile(numBins, daysBack, targetDateKey)
    {
        this.addObjectColumns(volumeProfile(this, numBins, daysBack, targetDateKey))

        return this
    }
}