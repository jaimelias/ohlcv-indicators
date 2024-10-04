import {ema} from './src/moving-averages/ema.js'
import {sma} from './src/moving-averages/sma.js'
import {macd} from './src/moving-averages/macd.js'
import {bollingerBands} from './src/moving-averages/bollingerBands.js'
import { rsi } from './src/oscillators/rsi.js'
import {crossPairs} from './src/studies/findCrosses.js'
import { orb } from './src/studies/orb.js'
import { donchianChannels } from './src/moving-averages/donchianChannel.js'
import {Big} from 'trading-signals';
import { parseOhlcvToVertical } from './src/utilities/parsing-utilities.js'
import { candlesStudies } from './src/studies/candleStudies.js'

export default class OHLCV_INDICATORS {
    constructor({input, precision = false, ticker = 'undefined'}) {

        if(!Array.isArray(input)) throw Error('input ohlcv must be an array: ' + ticker)
        if(input.length === 0) throw Error('input ohlcv must not be empty: ' + ticker)
        if(!input[0].hasOwnProperty('close')) throw Error('input ohlcv array objects require at least close property: ' + ticker)

        const big = num => (this.precision) ? new Big(num) : num

        this.len = input.length
        this.precision = precision
        this.big = big
        this.crossPairsArr = []
        this.inputOhlcv = input
        this.verticalOhlcv = parseOhlcvToVertical(input, this.len, big)
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
        const {verticalOhlcv, precision, len} = this
        const output = {}

        for (const [k, arr] of Object.entries(verticalOhlcv)) {
            let value = arr[len - 1]

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
            if(!this.verticalOhlcv.hasOwnProperty(key))
            {
                addColumn(key, arr)
            }
            else
            {
                delete this.indicators[key]
            }
        }

        return true
    }

    addColumn(key, arr) {
        const {len} = this
        key = key.toLowerCase();
    
        if (arr.length > len) {
            throw new Error(`Invalid column data: The length of the new column exceeds the length of the OHLCV data`);
        }
    
        if (arr.length < len) {
            const nanCount = len - arr.length
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

        this.computeIndicators()   

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
    orb()
    {
        const result = orb(this)
        Object.assign(this.indicators, result)

        return this       
    }
    donchianChannels(period, offset)
    {
        const result = donchianChannels(this, period, offset)
        Object.assign(this.indicators, result)

        return this       
    }
    candlesStudies(period)
    {
        const result = candlesStudies(this, period)
        Object.assign(this.indicators, result)

        return this       
    }   
}