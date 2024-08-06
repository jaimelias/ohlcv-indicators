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
        const {ohlcv} = this
        const result = crossPairs(ohlcv, arr)

        if(result)
        {
            this.addObjectColumns(result)
        }    

        return this
    }

    ema(size) {

        const {close} = this.ohlcv

       const result = ema(close, size)

        if(result)
        {
            this.addObjectColumns(result)
        }      

        return this
    }
    sma(size) {

        const {close} = this.ohlcv

        const result = sma(close, size)

        if(result)
        {
            this.addObjectColumns(result)
        }

        return this 
    }
    macd(fastLine, slowLine, signalLine) {

        const {close} = this.ohlcv

        const result = macd(close, fastLine, slowLine, signalLine)

        if(result)
        {
            this.addObjectColumns(result)
        }   
        
        return this

    }
    bollingerBands(size, times)
    {

        const {close} = this.ohlcv

        const result = bollingerBands(close, size, times)

        if(result)
        {
            this.addObjectColumns(result)
        }

        return this
    }
    rsi(period, movingAverage, movingAveragePeriod)
    {
        const {close} = this.ohlcv

        const result = rsi(close, period, movingAverage, movingAveragePeriod)
        
        if(result)
        {
            this.addObjectColumns(result)
        }

        return this
    }
    candles()
    {

        const {ohlcv} = this

        const result = candles(ohlcv)
                
        if(result)
        {
            this.addObjectColumns(result)
        }

        return this
    }
    volumeProfile(numBins, daysBack, targetDateKey)
    {

        const {ohlcv} = this

        const result = volumeProfile(ohlcv, numBins, daysBack, targetDateKey)

        if(result)
        {
            this.addObjectColumns(result)
        }

        return this
    }
}