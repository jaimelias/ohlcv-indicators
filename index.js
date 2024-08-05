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

        this.promises = []
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

    async computePromises()
    {
        const resolvePromises = async (main, promiseName) => {

            Promise.all(main[promiseName]).then(thisPromise => {

                if(Array.isArray(thisPromise))
                {
                    for(let x = 0; x < thisPromise.length; x++)
                    {                    
                        for(const [key, arr] of Object.entries(thisPromise[x]))
                        {
                            this.addColumn(`${key}`.toLowerCase(), arr)
                        }
                    }
                }
            })
        }

        await resolvePromises(this, 'promises')
        await crossPairs(this, this.crossPairsArr)

        return this.ohlcv
    }

    async getData() {

        await this.computePromises()
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
    async getLastValues(){
        await this.computePromises()
        const output = {}

        for (const [k, arr] of Object.entries(this.ohlcv)) {
            let value = arr[arr.length - 1]
            output[k] = (value instanceof Big) ? value.toNumber(): value;
        }

        return output
    }

    addColumn(key, arr) {

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
        this.crossPairsArr = arr

        return this
    }

    ema(size) {

        this.promises.push(
            Promise.resolve(ema(this, size))
        )

        return this
    }
    sma(size) {

        this.promises.push(
            Promise.resolve(sma(this, size))
        )
        
        return this
    }
    macd(fastLine, slowLine, signalLine) {

        this.promises.push(
            Promise.resolve(macd(this, fastLine, slowLine, signalLine))
        )
        
        return this
    }
    bollingerBands(data, size, times)
    {

        this.promises.push(
            Promise.resolve(bollingerBands(this, data, size, times))
        )

        
        return this
    }
    rsi(period, movingAverage, movingAveragePeriod)
    {
        this.promises.push(Promise.resolve(rsi(this, period, movingAverage, movingAveragePeriod)))
        
        return this
    }
    candles()
    {

        this.promises.push(
            Promise.resolve(candles(this))
        )

        
        return this
    }
    volumeProfile(numBins, daysBack, targetDateKey)
    {

        this.promises.push(
            Promise.resolve(volumeProfile(this, numBins, daysBack, targetDateKey))
        )

        return this
    }
}