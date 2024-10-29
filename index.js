import { relativeVolume } from './src/moving-averages/relativeVolume.js'
import {ema} from './src/moving-averages/ema.js'
import {sma} from './src/moving-averages/sma.js'
import {macd} from './src/moving-averages/macd.js'
import {bollingerBands} from './src/moving-averages/bollingerBands.js'
import { rsi } from './src/oscillators/rsi.js'
import {crossPairs, findDirectionCross, findLinearDirection} from './src/studies/findCrosses.js'
import { orb } from './src/oscillators/orb.js'
import { donchianChannels } from './src/moving-averages/donchianChannel.js'
import { parseOhlcvToVertical } from './src/utilities/parsing-utilities.js'
import { candlesStudies } from './src/studies/candleStudies.js'
import { correlation } from './src/studies/correlation.js'

export default class OHLCV_INDICATORS {
    constructor({input, ticker = 'undefined'}) {

        if(!Array.isArray(input)) throw Error('input ohlcv must be an array: ' + ticker)
        if(input.length === 0) throw Error('input ohlcv must not be empty: ' + ticker)
        if(!input[0].hasOwnProperty('close')) throw Error('input ohlcv array objects require at least close property: ' + ticker)

        this.len = input.length
        this.crossPairsArr = []
        this.inputOhlcv = input
        this.verticalOhlcv = parseOhlcvToVertical(input, this.len)
        this.indicators = {}
        this.studies = {}
        this.utilities = {
            correlation
        }
        return this 
    }
    
    getData() {
        this.compute();
        const {verticalOhlcv} = this
        const keys = Object.keys(verticalOhlcv);
        const len = verticalOhlcv[keys[0]].length;
        const keysLength = keys.length;
    
        // Pre-allocate array to improve memory efficiency
        const result = [];
    
        // Iterate over the rows
        for (let i = 0; i < len; i++) {
            const row = {};
            let isInvalidValue = false;  // Flag to track if any null value is found
    
            // Loop over keys to fill row data
            for (let x = 0; x < keysLength; x++) {
                const header = keys[x];
                const value = verticalOhlcv[header][i];
    
                // If value is null, mark the row to be skipped and break
                if (value === null || typeof value === 'undefined') {
                    isInvalidValue = true;
                    break;
                }
    
                row[header] = value
            }
    
            // If no null values were found, add row to result
            if (!isInvalidValue) {
                result.push(row);
            }
        }
    
        return result;
    }
    
    
    getLastValues(){

        this.compute()
        const {verticalOhlcv, len} = this
        const output = {}

        for (const [k, arr] of Object.entries(verticalOhlcv)) {
            let value = arr[len - 1]

            output[k] = value
            
        }

        Object.assign(output, this.studies)

        return output
    }

    compute() {

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

        return this
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
        
        this.compute()

        const {x, c} = crossPairs(this, arr)
        Object.assign(this.indicators, x)
        Object.assign(this.studies, c)

        this.compute()   

        return this
    }

    lag(colKeys = ['close'], lags = 1) {
        this.compute();
        const {verticalOhlcv} = this;
    
        for (let x = 0; x < colKeys.length; x++) {
            for (let lag = 1; lag <= lags; lag++) {
                // Create lagged column name and slice the array with the correct lag
                const key = `${colKeys[x]}_lag_${lag}`;
                const values = verticalOhlcv[colKeys[x]].slice(0, -(lag));
    
                Object.assign(this.indicators, {[key]: values})
            }
        }
    
        this.compute();
        return this;
    }
    
    relativeVolume(size) {


        const result = relativeVolume(this, size)
        Object.assign(this.indicators, result)
 
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

    findDirectionCross(keyNames = ['close', 'low'])
    {
        this.compute()

        for(let x = 0; x < keyNames.length; x++)
        {
            const keyName = keyNames[x]
            const result = findDirectionCross(this, keyName)
            Object.assign(this.indicators, {[`${keyName}_direction_cross`]: result})
        }

        this.compute()
        return this
    }

    findLinearDirection(keyNames = ['close', 'low'])
    {
        this.compute()

        for(let x = 0; x < keyNames.length; x++)
        {
            const keyName = keyNames[x]
            const result = findLinearDirection(this, keyName)
            Object.assign(this.indicators, {[`${keyName}_linear_direction`]: result})
        }

        this.compute()
        return this
    }
    gt(arr = [{a: 'high', b: 'low'}])
    {
        this.compute()

        const {verticalOhlcv} = this

        for(let x = 0; x < arr.length; x++)
        {
            const {a, b} = arr[x]
            let bArr
            
            if(typeof b === 'string')
            {
                bArr = verticalOhlcv[b]
            }
            else if(typeof b === 'number')
            {
                bArr = new Array(verticalOhlcv[a].length).fill(b)
            }

            const result = verticalOhlcv[a].map((v, i) => (v > bArr[i]) ? 1 : 0)
            Object.assign(this.indicators, {[`${a}_gt_${b}`]: result})
        }

        this.compute()

        return this
    }
}