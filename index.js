import { relativeVolume } from './src/moving-averages/relativeVolume.js'
import {ema} from './src/moving-averages/ema.js'
import {sma} from './src/moving-averages/sma.js'
import {macd} from './src/moving-averages/macd.js'
import {bollingerBands} from './src/moving-averages/bollingerBands.js'
import { rsi } from './src/oscillators/rsi.js'
import {crossPairs} from './src/studies/findCrosses.js'
import { orb } from './src/oscillators/orb.js'
import { donchianChannels } from './src/moving-averages/donchianChannel.js'
import { parseOhlcvToVertical, defaultStudyOptions } from './src/utilities/parsing-utilities.js'
import { candlesStudies } from './src/studies/candleStudies.js'
import { correlation } from './src/studies/correlation.js'
import { volumeOscillator } from './src/oscillators/volumeOscillator.js'
import { setIndicatorsFromInputParams } from './src/utilities/setIndicatorsFromInputParams.js'

export default class OHLCV_INDICATORS {
    constructor({input, ticker = null, studyOptions = null}) {

        if(!Array.isArray(input)) throw Error('input ohlcv must be an array: ' + ticker)
        if(input.length === 0) throw Error('input ohlcv must not be empty: ' + ticker)
        if(!input[0].hasOwnProperty('close')) throw Error('input ohlcv array objects require at least close property: ' + ticker)

        this.priceBased = ['open', 'high', 'low', 'close', 'mid_price_open_close', 'mid_price_high_low']
        this.len = input.length
        this.crossPairsArr = []
        this.inputOhlcv = input
        this.studyOptions = (studyOptions === null) ? defaultStudyOptions : studyOptions
        this.verticalOhlcv = parseOhlcvToVertical(input, this.len, this.studyOptions)
        this.indicators = {}
        this.studies = {}
        this.utilities = {
            correlation
        }
        this.inputParams = {
            crossPairs: null,
            lag: null,
            relativeVolume: null,
            ema: null,
            sma: null,
            macd: null,
            orb: null,
            bollingerBands: null,
            rsi: null,
            donchianChannels: null,
            candlesStudies: null,
            volumeOscillator: null,
        }

        this.setIndicatorsFromInputParams = setIndicatorsFromInputParams
    
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
    
                row[header] =  value
            }
    
            // If no null values were found, add row to result
            if (!isInvalidValue) {
                result.push(row);
            }
        }
    
        return result;
    }
    
    
    getLastValues(){

        return this.getData()[this.getData().length -1]
    
    }

    compute() {


        if(Object.keys(this.indicators).length === 0) return this


        const addColumn = this.addColumn.bind(this)

        for(const [key, arr] of Object.entries( this.indicators))
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

        this.inputParams.crossPairs ??= []
        this.inputParams.crossPairs.push([arr])
        
        this.compute()

        const {x, c} = crossPairs(this, arr)
        Object.assign(this.indicators, x)
        Object.assign(this.studies, c)

        this.compute()   

        return this
    }

    lag(colKeys = ['close'], lags = 1) {


        this.inputParams.lag ??= []
        this.inputParams.lag.push([colKeys, lags])

        this.compute();
        const {verticalOhlcv, priceBased} = this;
    
        for (let x = 0; x < colKeys.length; x++) {
            for (let lag = 1; lag <= lags; lag++) {
                // Create lagged column name and slice the array with the correct lag
                const key = `${colKeys[x]}_lag_${lag}`;
                const values = verticalOhlcv[colKeys[x]].slice(0, -(lag));
    
                Object.assign(this.indicators, {[key]: values})

                if(priceBased.find(v => key.startsWith(v)))
                {
                    this.priceBased.push(key)
                }
            }
        }

    
        this.compute();
        return this;
    }
    
    relativeVolume(size) {

        this.inputParams.relativeVolume ??= []
        this.inputParams.relativeVolume.push([size])

        const result = relativeVolume(this, size)
        Object.assign(this.indicators, result)

 
        return this
    }

    ema(size) {

        this.inputParams.ema ??= []
        this.inputParams.ema.push([size])

        const result = ema(this, size)
        Object.assign(this.indicators, result)

        this.priceBased.push(`ema_${size}`)

        return this
    }
    sma(size) {

        this.inputParams.sma ??= []
        this.inputParams.sma.push([size])

        const result = sma(this, size)
        Object.assign(this.indicators, result)

        this.priceBased.push(`sma_${size}`)

        return this 
    }
    macd(fastLine, slowLine, signalLine) {

        this.inputParams.macd ??= []
        this.inputParams.macd.push([fastLine, slowLine, signalLine])

        const result = macd(this, fastLine, slowLine, signalLine)
        Object.assign(this.indicators, result)
        
        return this

    }
    bollingerBands(size, times, bollingerBandsStudies)
    {

        this.inputParams.bollingerBands ??= []
        this.inputParams.bollingerBands.push([size, times, bollingerBandsStudies])

        const result = bollingerBands(this, size, times, bollingerBandsStudies)
        Object.assign(this.indicators, result)

        this.priceBased.push('bollinger_bands_middle', 'bollinger_bands_upper', 'bollinger_bands_lower')

        return this
    }
    rsi(period, movingAverage, movingAveragePeriod)
    {

        this.inputParams.rsi ??= []
        this.inputParams.rsi.push([period, movingAverage, movingAveragePeriod])

        const result = rsi(this, period, movingAverage, movingAveragePeriod)
        Object.assign(this.indicators, result)

        return this
    }
    orb()
    {

        this.inputParams.orb ??= []
        this.inputParams.orb.push([])

        const result = orb(this)
        Object.assign(this.indicators, result)

        this.priceBased.push('orb_high', 'orb_low')

        return this       
    }
    donchianChannels(period, offset)
    {

        this.inputParams.donchianChannels ??= []
        this.inputParams.donchianChannels.push([period, offset])

        const result = donchianChannels(this, period, offset)
        Object.assign(this.indicators, result)

        this.priceBased.push('donchian_channel_upper', 'donchian_channel_lower', 'donchian_channel_basis')

        return this       
    }
    candlesStudies(period, classify, classificationLevels)
    {

        this.inputParams.candlesStudies ??= []
        this.inputParams.candlesStudies.push([period, classify, classificationLevels])

        const result = candlesStudies(this, period, classify, classificationLevels)
        Object.assign(this.indicators, result)

        return this       
    }

    volumeOscillator(fastPeriod, slowPeriod)
    {


        this.inputParams.volumeOscillator ??= []
        this.inputParams.volumeOscillator.push([fastPeriod, slowPeriod])

        const result = volumeOscillator(this, fastPeriod, slowPeriod)
        Object.assign(this.indicators, result)

        return this           
    }
}