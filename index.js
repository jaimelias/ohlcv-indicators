import {crossPairs} from './src/studies/findCrosses.js'
import { parseOhlcvToVertical, defaultStudyOptions } from './src/utilities/parsing-utilities.js'
import { correlation } from './src/studies/correlation.js'
import { setIndicatorsFromInputParams } from './src/utilities/setIndicatorsFromInputParams.js'

export default class OHLCV_INDICATORS {
    constructor({input, ticker = null, studyOptions = null}) {

        if(!Array.isArray(input)) throw Error('input ohlcv must be an array: ' + ticker)
        if(input.length === 0) throw Error('input ohlcv must not be empty: ' + ticker)
        if(!input[0].hasOwnProperty('close')) throw Error('input ohlcv array objects require at least close property: ' + ticker)

        this.input = input
        this.priceBased = ['open', 'high', 'low', 'close', 'mid_price_open_close', 'mid_price_high_low']
        this.len = input.length
        this.studyOptions = (studyOptions === null) ? defaultStudyOptions : studyOptions
        this.instances = {}
        this.autoCrossPairsList = []
        this.verticalOhlcv = {}

        this.inputParams = {
            crossPairs: null,
            lag: null,
            relativeVolume: null,
            ema: null,
            sma: null,
            macd: null,
            bollingerBands: null,
            rsi: null,
            donchianChannels: null,
            candlesStudies: null,
            volumeOscillator: null,
        }

        
        this.studies = {}
        this.utilities = {
            correlation
        }


        this.setIndicatorsFromInputParams = setIndicatorsFromInputParams
    
        return this 
    }
    
    getData() {

        this.compute()

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

        parseOhlcvToVertical(this.input, this)

        return this
    }
    

    crossPairs(arr)
    {

        this.compute()

        const crossList = [...this.autoCrossPairsList, ...arr]
        this.inputParams.crossPairs ??= []
        this.inputParams.crossPairs.push([crossList])

        const {x, c} = crossPairs(this, crossList)
        Object.assign(this.verticalOhlcv, x)
        Object.assign(this.studies, c)

        return this
    }

    lag(colKeys = ['close'], lags = 1) {

        this.inputParams.lag ??= []
        this.inputParams.lag.push([colKeys, lags])

        for(let x = 0; x < colKeys.length; x++)
        {
            const key = colKeys[x]

            if(this.priceBased.find(v => key.startsWith(v)))
            {
                this.priceBased.push(key)
            }
        }
        
        return this;
    }
    
    relativeVolume(size) {

        this.inputParams.relativeVolume ??= []
        this.inputParams.relativeVolume.push([size])
 
        return this
    }

    ema(size) {

        this.inputParams.ema ??= []
        this.inputParams.ema.push([size])
        this.priceBased.push(`ema_${size}`)

        return this
    }
    sma(size) {

        this.inputParams.sma ??= []
        this.inputParams.sma.push([size])
        this.priceBased.push(`sma_${size}`)

        return this 
    }
    macd(fastLine, slowLine, signalLine) {

        this.inputParams.macd ??= []
        this.inputParams.macd.push([fastLine, slowLine, signalLine])
        
        return this

    }
    bollingerBands(size = 20, times = 2, bollingerBandsStudies) {
        // Validate size and times
        if (typeof size !== 'number' || size <= 0) {
            throw new Error('Invalid parameter: "size" must be a positive number in bollingerBands.');
        }
        if (typeof times !== 'number' || times <= 0) {
            throw new Error('Invalid parameter: "times" must be a positive number in bollingerBands.');
        }
    
        this.inputParams.bollingerBands ??= [];
        this.inputParams.bollingerBands.push([size, times, bollingerBandsStudies]);
        this.priceBased.push('bollinger_bands_middle', 'bollinger_bands_upper', 'bollinger_bands_lower');
    
        return this;
    }
    
    rsi(size)
    {
        // Validate size and times
        if (typeof size !== 'number' || size <= 0) {
            throw new Error('Invalid parameter: "size" must be a positive number in rsi.');
        }

        this.inputParams.rsi ??= []
        this.inputParams.rsi.push([size])

        return this
    }
    donchianChannels(size = 20, offset = 0)
    {
        if (typeof size !== 'number' || size <= 0) {
            throw new Error('The "size" must be a positive number or 0 in donchianChannels.');
        }
    
        if (typeof offset !== 'number' || offset <= 0) {
            throw new Error('The "offset" must be a positive number or 0 in donchianChannels.');
        }

        this.inputParams.donchianChannels ??= []
        this.inputParams.donchianChannels.push([size, offset])
        this.priceBased.push('donchian_channel_upper', 'donchian_channel_lower', 'donchian_channel_basis')

        return this       
    }
    candlesStudies(size = 20, classify = true, classificationLevels)
    {

        if (typeof size !== 'number' || size <= 0) {
            throw new Error('The "size" must be a positive number or 0 in candlesStudies.');
        }

        if (typeof classify !== 'boolean') {
            throw new Error('The "classify" must be a true or false in candlesStudies.');
        }

        this.inputParams.candlesStudies ??= []
        this.inputParams.candlesStudies.push([size, classify, classificationLevels])
        return this       
    }

    volumeOscillator(fastSize, slowSize)
    {
        this.inputParams.volumeOscillator ??= []
        this.inputParams.volumeOscillator.push([fastSize, slowSize])
        return this           
    }
}