import { parseOhlcvToVertical } from './src/utilities/parsing-utilities.js'
import { correlation } from './src/studies/correlation.js'
import { validateDate } from './src/utilities/validators.js'
import { isAlreadyComputed } from './src/utilities/validators.js'
import { divideByMultiplier } from './src/utilities/numberUtilities.js'
import { getMovingAveragesParams } from './src/moving-averages/movingAverages.js'
import { verticalToHorizontal } from './src/utilities/dataParsingUtilities.js'
import { pushToMain } from './src/utilities/pushToMain.js'

/**
 * Class OHLCV_INDICATORS
 *
 * This class provides methods for calculating and managing technical indicators 
 * on financial OHLCV (Open, High, Low, Close, Volume) data. It enables users 
 * to parallel compute various technical indicators in 1 single loop.
 * OHLCV datasets.
 */

const validMagnitudeValues = [0.001, 0.002, 0.0025, 0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.20, 0.25, 0.5, 1, 2, 2.5, 5, 10]

export default class OHLCV_INDICATORS {
    constructor({input, ticker = null, precision = true, inputParams = null}) {

        if(!Array.isArray(input)) throw Error('input OHLCV must be an array: ' + ticker)
        if(input.length === 0) throw Error('input OHLCV must not be empty: ' + ticker)
        if(!input[0].hasOwnProperty('close')) throw Error('input OHLCV array objects require at least close property: ' + ticker)
        this.hasVolume = ((typeof input[0].volume === 'number' && input[0].volume > 0) || (typeof input[0].volume === 'string' && input[0].volume)) ? true : false

        this.isComputed = false
        this.lastComputedIndex = 0
        this.input = input
        this.inputTypes = (this.hasVolume) ? {open: '', high: '', low: '', close: '', volume: ''} : {open: '', high: '', low: '', close: ''}
        this.priceBased = ['open', 'high', 'low', 'close']
        this.len = input.length
        this.lastIndexReplace = false 
        this.instances = {}
        this.crossPairsList = []
        this.verticalOhlcv = {}

        this.studies = {}
        this.utilities = {
            correlation
        }

        this.invalidValueIndex = -1

        this.precision = precision
        this.precisionMultiplier = (this.precision === true) ? 0 : 1
        this.minMaxRanges = {}   
        
        
        if(Array.isArray(inputParams))
        {
            this.inputParams = inputParams
            this.compute()
        }
        {
            this.inputParams = []
        }

        this.pushToMain = ({index, key, value}) => pushToMain({main: this, index, key, value})
        

        return this 
    }


    getDataAsCols(skipNull = true) {
        this.compute();
      
        const {
          precisionMultiplier,
          precision,
          invalidValueIndex,
          len,
          verticalOhlcv,
          priceBased
        } = this;
        const result = {};
        const shouldSlice = invalidValueIndex >= 0 && skipNull;
        const sliceLength = len - (invalidValueIndex + 1);
      

        for (const [key, arr] of Object.entries(verticalOhlcv)) {
          // If slicing is needed, create a sliced copy, otherwise re-use the array.
          let newArr = shouldSlice ? arr.slice(-sliceLength) : arr;
      
          // If this key is price based and precision is enabled, map over the array.
          if (precision && priceBased.includes(key)) {
            newArr = newArr.map(v => (v == null ? null : v / precisionMultiplier));
          }
          result[key] = newArr;
        }
      
        return result;
      }
      

    getData(skipNull = true) {

        //getData method returns the last object (row) of the new OHLCV with indicators: {open, high, low, close, rsi_14, bollinger_bands_upper}
        this.compute()

        const {precisionMultiplier, priceBased, precision, verticalOhlcv, invalidValueIndex} = this

        return verticalToHorizontal(verticalOhlcv, skipNull, precision, precisionMultiplier, priceBased, invalidValueIndex)
    }
    
    
    getLastValues(){

        this.compute()

        const {precisionMultiplier, priceBased, precision, verticalOhlcv, len} = this
        const keyNames = Object.keys(verticalOhlcv)
        const row = {}

        for(const key of keyNames)
        {
            row[key] = verticalOhlcv[key][len - 1]
        }
     
        return (precision) ? divideByMultiplier({row, precisionMultiplier, priceBased}) : row
    }

    compute(change) {

        //if change is a valid object and change.date is after the last row in this.input[this.input.length - 1].date pushes change to this.input using the parseOhlcvToVertical function.


        //stops the compute if compute is called from getData, getDataAsCols or getLastValues an isComputed is false
        if(this.isComputed === true && !change)
        {
            return this
        }
        else{
            this.isComputed = false
        }

        //checks the first row in OHLCV input to verify if the date property is valid
        this.isValidDate = this.input[0].hasOwnProperty('date') && validateDate(this.input[0].date)

         //compute method can be used to process indicators if no arguments are provided
         //compute method can be called to access the .verticalOhlcv object
         //compute method is called automatically if getLastValues or getDate methods are called
        if (this.len > this.lastComputedIndex && !change) {
            parseOhlcvToVertical(this.input, this, 0);
        }        

        //compute method can be used to add new or update the last datapoints if a new OHLCV object is passed with a valid date property
        //valid date properties: "2024-12-16 15:45:00" or "2024-12-16"
        if (change && typeof change === 'object') {

            if (!['open', 'high', 'low', 'close', 'volume', 'date'].every(f => Object.keys(change).includes(f))) {
                throw Error('Invalid OHLCV object sent in "compute". Correct usage: .compute({open: 108.25, high: 108.410004, low: 108.25, close: 99999999, volume: 875903, date: "2024-12-16 15:45:00" || "2024-12-16"})');
            }            
            if(!this.isValidDate)
            {
                throw Error('All the OHLCV rows require a valid date property to access the compute change method. Correct date format: "2024-12-16 15:45:00" or "2024-12-16"')
            }
            if(!validateDate(change.date))
            {
                throw Error('The date in the new OHLCV row is invalid. Correct date format: "2024-12-16 15:45:00" or "2024-12-16"')
            }

            const { date: changeDate } = change;
            const lastIndex = this.len - 1;
            const inputDate = this.input[lastIndex]?.date;
    
            //fallback if .compute(change) is triggered before .compute() alone
            if (this.lastComputedIndex === 0) {
                this.compute()
            }


            if (inputDate !== changeDate) {
                // Add new item
                this.len++
                this.input.push(change)
                parseOhlcvToVertical(this.input, this, this.len)
            } else {
                // Modify the last item
                this.input[lastIndex] = change
                parseOhlcvToVertical(this.input, this, lastIndex)
            }

        }
    

    
        return this;
    }
    
    

    crossPairs(arr)
    {
        isAlreadyComputed(this)

        this.crossPairsList = [...this.crossPairsList, ...arr]
        this.inputParams.push({key: 'crossPairs', params: [this.crossPairsList]})
        
        return this
    }


    lag(colKeys = ['close'], lags = 1) {

        isAlreadyComputed(this)

        if(!Array.isArray(colKeys))
        {
            throw new Error('Param "colKeys" must be a valid array of keyNames in lag.')
        }
        if(typeof lags !== 'number' || !Number.isInteger(lags) || lags < 0)
        {
            throw new Error(`Param "lags" must be a integer greater or equal to 0: ${JSON.stringify(colKeys)}`)
        }


        this.inputParams.push({key: 'lag', params: [colKeys, lags]})

        for(let x = 0; x < colKeys.length; x++)
        {
            const key = colKeys[x]

            if(this.priceBased.find(v => key === v))
            {
                this.priceBased.push(key)
            }
        }
        
        return this;
    }
    
    relativeVolume(size, options = {}) {

        if(this.hasVolume === false) {
            throw new Error('If "relativeVolume" is called the input ohlcv must contain valid volume properties.')
        }

        isAlreadyComputed(this)

        const {scale = null} = options

        if (typeof scale === 'number' && !validMagnitudeValues.includes(scale)) {

            throw new Error(`"scale" value in relativeVolume must be any of the following numbers: ${validMagnitudeValues.join(', ')}`);
        }

        this.inputParams.push({key: 'relativeVolume', params: [size, {scale}]})
 
        return this
    }

    ema(size, options = {}) {

        isAlreadyComputed(this)

        const optionArgs = getMovingAveragesParams('ema', size, options, validMagnitudeValues)

        this.inputParams.push({key: 'movingAverages', params: ['ema', size, optionArgs]})

        return this
    }
    sma(size, options = {}) {

        isAlreadyComputed(this)

        const optionArgs = getMovingAveragesParams('sma', size, options, validMagnitudeValues)

        this.inputParams.push({key: 'movingAverages', params: ['sma', size, optionArgs]})

        return this
    }

    
    macd(fast = 12, slow = 26, signal = 9, options = {}) {

        isAlreadyComputed(this)

        if (typeof fast !== 'number' || fast <= 0) {
            throw new Error('"fast" must be a positive number in macd.');
        }
        if (typeof slow !== 'number' || slow <= fast) {
            throw new Error('"slow" must be a positive number greater than "fast" in macd.');
        }
        if (typeof signal !== 'number' || signal <= 0) {
            throw new Error('"signal" must be a positive number in macd.');
        }

        if(typeof options !== 'object')
        {
            throw new Error('"options" must be an object in macd. eg: {target}');
        }

        const {target = 'close'} = options

        this.inputParams.push({key: 'macd', params: [fast, slow, signal, {target}]})
        
        return this

    }
    bollingerBands(size = 20, stdDev = 2, options = {}) {

        isAlreadyComputed(this)

        if(!options || typeof options !== 'object')
        {
            throw new Error('"options" must be an object in bollingerBands. eg: {target, height, range}');
        }

        const {target = 'close', height = false, range = [],  scale = null, lag = 0} = options

        // Validate size and times
        if (typeof size !== 'number' || size <= 0) {
            throw new Error('"size" must be a positive number in bollingerBands.');
        }
        if (typeof stdDev !== 'number' || stdDev <= 0) {
            throw new Error('"stdDev" must be a positive number in bollingerBands.');
        }
        if (!Array.isArray(range)) {
            throw new Error('If set, "range" must be a array of column names in bollingerBands.');
        }
        if (typeof lag !== 'number') {

            throw new Error(`"lag" value must be a number in bollingerBands.`);
        }
    
        if (typeof height !== 'boolean') {
            throw new Error('"height" must be a boolean in bollingerBands.');
        }
        else
        {
            if (typeof scale === 'number' && !validMagnitudeValues.includes(scale)) {

                throw new Error(`"scale" value in bollingerBands must be any of the following numbers: ${validMagnitudeValues.join(', ')}`);
            }           
        }
    
        this.inputParams.push({key: 'bollingerBands', params: [size, stdDev, {target, height, scale, range, lag}]});
    
        return this;
    }
    
    rsi(size, options = {})
    {
        isAlreadyComputed(this)

        // Validate size and times
        if (typeof size !== 'number' || size <= 0) {
            throw new Error('"size" must be a positive number in rsi.');
        }

        const {scale = null, target = 'close', lag = 0} = options

        if (typeof scale === 'number' && !validMagnitudeValues.includes(scale)) {

            throw new Error(`"scale" value in rsi must be any of the following numbers: ${validMagnitudeValues.join(', ')}`);
        }

        if (typeof lag !== 'number') {

            throw new Error(`"lag" value in rsi must be a number in rsi.`);
        }

        this.inputParams.push({key: 'rsi', params: [size, {scale, target, lag}]})

        return this
    }
    donchianChannels(size = 20, offset = 0, options = {}) {
        isAlreadyComputed(this);
      
        if (typeof size !== 'number' || size <= 0) {
          throw new Error('"size" must be a positive number greater than 0 in donchianChannels.');
        }
      
        if (typeof offset !== 'number' || offset < 0) {
          throw new Error('"offset" must be a number greater than or equal to 0 in donchianChannels.');
        }
      
        const { height = false, range = [], scale = null, lag = 0} = options;
      
        if (!Array.isArray(range)) {
          throw new Error('If set, "range" must be an array of column names in donchianChannels.');
        }

        if (typeof lag !== 'number') {
            throw new Error(`"lag" value in rsi must be a number in donchianChannels.`);
        }
      
        if (typeof height !== 'boolean') {
          throw new Error('"height" must be a boolean in donchianChannels.');
        }
        else
        {

            if (typeof scale === 'number' && !validMagnitudeValues.includes(scale)) {

                throw new Error(`"scale" value in donchianChannels must be any of the following numbers: ${validMagnitudeValues.join(', ')}`);
            }        
        }
      
        this.inputParams.push({ key: 'donchianChannels', params: [size, offset, { height, range, scale, lag }] });
      
        return this;
    }
      

    candleVectors(size = 200, options = {}) {
        isAlreadyComputed(this);
      
        if (typeof size !== 'number' || size <= 0) {
          throw new Error('"size" must be a positive number greater than 0 in candleVectors.');
        }
      
        const { stdDev = 1, lag = 0, scale = 0.001, patternSize = 0, center = 'lower'} = options;


        if (typeof stdDev !== 'number' || stdDev <= 0) {
            throw new Error('"stdDev" must be a positive number greater than 0 in candleVectors.');
        }

        if (typeof scale === 'number' && !validMagnitudeValues.includes(scale)) {

            throw new Error(`"scale" value in candleVectors must be any of the following numbers: ${validMagnitudeValues.join(', ')}`);
        }

        if (typeof patternSize !== 'number' || !Number.isInteger(patternSize) || patternSize < 0 ) {

            throw new Error(`"patternSize" value in candleVectors must be a positive integer.`);
        }

        if(typeof center !== 'string' || !['lower', 'middle'].includes(center))
        {
            throw new Error(`"center" value must be "lower" or "middle" in candleVectors`);
        }

        this.inputParams.push({ key: 'candleVectors', params: [size, {stdDev, patternSize, lag, scale, center}] });
        return this;
      }
      

    volumeOscillator(fastSize = 5, slowSize = 10, options = {})
    {

        if(this.hasVolume === false) {
            throw new Error('If "volumeOscillator" is called the input ohlcv must contain valid volume properties.')
        }

        isAlreadyComputed(this)

        if (typeof fastSize !== 'number' || fastSize <= 1) {
            throw new Error('fastSize" must be a positive number greater than 1 in volumeOscillator.');
        }

        if (typeof slowSize !== 'number' || slowSize <= fastSize) {
            throw new Error('"slowSize" must be a positive number greater than the "fastSize" in volumeOscillator.');
        }

        const {scale = null} = options

        if (typeof scale === 'number' && !validMagnitudeValues.includes(scale)) {

            throw new Error(`"scale" value in volumeOscillator must be any of the following numbers: ${validMagnitudeValues.join(', ')}`);
        }

        this.inputParams.push({key: 'volumeOscillator', params: [fastSize, slowSize, {scale}]})
        return this           
    }
    dateTime()
    {
        isAlreadyComputed(this)

        this.inputParams.push({key: 'dateTime', params: []})
        return this           
    }

    minMaxScaler(size, colKeys, options)
    {
        isAlreadyComputed(this)

        const {group = false, range = {min: 0, max: 1}, lag = 0} = options

        this.inputParams.push({key: 'minMaxScaler', params: [size, colKeys, group, range, lag]})
        return this
    }
}