import {ema} from './src/moving-averages/ema.js'
import {sma} from './src/moving-averages/sma.js'
import {macd} from './src/moving-averages/macd.js'
import {bollingerBands} from './src/moving-averages/bollingerBands.js'
import { rsi } from './src/oscillators/rsi.js'
import { volumeProfile } from './src/studies/volumeProfile.js'
import {crossPairs} from './src/studies/findCrosses.js'
import { candles } from './src/studies/candles.js'
import {Big} from 'trading-signals';
import { parseOhlcvToVertical } from './src/utilities/parsing-utilities.js'

export default class OHLCV_INDICATORS {
    constructor({input, precision = false, ticker = 'undefined'}) {

        if(!Array.isArray(input)) throw Error('input ohlcv must be an array: ' + ticker)
        if(input.length === 0) throw Error('input ohlcv must not be empty: ' + ticker)
        if(!input[0].hasOwnProperty('close')) throw Error('input ohlcv array objects require at least close property: ' + ticker)

        const big = num => (this.precision) ? new Big(num) : num

        this.precision = precision
        this.big = big
        this.crossPairsArr = []
        this.inputOhlcv = input
        this.verticalOhlcv = parseOhlcvToVertical(input, big)
        this.indicators = {}
        this.studies = {}
        this.isComputed = false       
        return this 
    }

    getData() {

        this.computeIndicators()
        const {verticalOhlcv, precision} = this
        const keys = Object.keys(verticalOhlcv)
        const keysLength = keys.length

        return verticalOhlcv.open.map((_, i) => {

            const row = {}

            for(let x = 0; x < keysLength; x++)
            {
                const header = keys[x]
                const value = verticalOhlcv[header][i]

                if(precision)
                {
                    row[header] = (value instanceof Big) ? value.toNumber() : value
                }
                else
                {
                    row[header] = value
                }
            }

            return row
        })
    }
    getLastValues(){

        this.computeIndicators()
        const {verticalOhlcv, precision} = this
        const output = {}

        for (const [k, arr] of Object.entries(verticalOhlcv)) {
            let value = arr[arr.length - 1]

            if(precision)
            {
                output[k] = (value instanceof Big) ? value.toNumber(): value
            }
            else
            {
                output[k] = value
            }
            
        }

        Object.assign(output, this.studies)

        return output
    }

    computeIndicators() {

        if(this.isComputed === true){
            return false
        }

        this.isComputed === true

        const indicators = this.indicators
        const addColumn = this.addColumn.bind(this)

        for(const [key, arr] of Object.entries(indicators))
        {
            addColumn(key, arr)
        }

        return true
    }

    addColumn(key, arr) {
        key = key.toLowerCase();
        const ohlcvLength = this.verticalOhlcv.open.length;
    
        if (arr.length > ohlcvLength) {
            throw new Error(`Invalid column data: The length of the new column exceeds the length of the OHLCV data`);
        }
    
        if (arr.length < ohlcvLength) {
            const nanCount = ohlcvLength - arr.length
            arr = new Array(nanCount).fill(null).concat(arr)
        }
    
        this.verticalOhlcv[key] = arr
    }
    

    crossPairs(arr)
    {
        
        this.computeIndicators()

        const {x, c} = crossPairs(this, arr)
        Object.assign(this.indicators, x)
        Object.assign(this.studies, c)

        return this
    }

    ema(size) {


       const result = ema(this, size)
       Object.assign(this.indicators, result)

        return this
    }
    sma(size) {

        const result = sma(this, size)
        Object.assign(this.indicators, result)

        return this 
    }
    macd(fastLine, slowLine, signalLine) {

        const result = macd(this, fastLine, slowLine, signalLine)
        Object.assign(this.indicators, result)
        
        return this

    }
    bollingerBands(size, times)
    {

        const result = bollingerBands(this, size, times)
        Object.assign(this.indicators, result)

        return this
    }
    rsi(period, movingAverage, movingAveragePeriod)
    {

        const result = rsi(this, period, movingAverage, movingAveragePeriod)
        Object.assign(this.indicators, result)

        return this
    }
    candles()
    {
        const result = candles(this)
        Object.assign(this.indicators, result)

        return this
    }
    volumeProfile(numBins, daysBack, targetDateKey)
    {

        const {verticalOhlcv} = this

        const result = volumeProfile(verticalOhlcv, numBins, daysBack, targetDateKey)
        Object.assign(this.indicators, result)

        return this
    }
}