import { parseOhlcvToVertical } from './src/utilities/parsing-utilities.js'
import { correlation } from './src/studies/correlation.js'
import { setIndicatorsFromInputParams } from './src/utilities/setIndicatorsFromInputParams.js'
import { validateDate } from './src/utilities/validators.js'
import { isAlreadyComputed } from './src/utilities/validators.js'
import { divideByMultiplier } from './src/utilities/numberUtilities.js'
import { getMovingAveragesParams } from './src/moving-averages/movingAverages.js'

const validMagnitudeValues = [0.01, 0.02, 0.025, 0.05, 0.1, 0.20, 0.25, 0.5, 1]

export default class OHLCV_INDICATORS {
    constructor({input, ticker = null, precision = true}) {

        if(!Array.isArray(input)) throw Error('input OHLCV must be an array: ' + ticker)
        if(input.length === 0) throw Error('input OHLCV must not be empty: ' + ticker)
        if(!input[0].hasOwnProperty('close')) throw Error('input OHLCV array objects require at least close property: ' + ticker)

        this.isComputed = false
        this.lastComputedIndex = 0
        this.input = input
        this.inputTypes = {open: '', high: '', low: '', close: '', volume: ''}
        this.priceBased = ['open', 'high', 'low', 'close']
        this.len = input.length
        this.lastIndexReplace = false 
        this.instances = {}
        this.crossPairsList = []
        this.verticalOhlcv = {}
        this.horizontalOhlcv = Array.from({ length: this.len }, () => ({}))

        this.inputParams = []

        this.studies = {}
        this.utilities = {
            correlation
        }

        this.precision = precision
        this.precisionMultiplier = (this.precision === true) ? 0 : 1
        this.setIndicatorsFromInputParams = setIndicatorsFromInputParams
    
        return this 
    }

    pushToMain({index, key, value})
    {
        this.verticalOhlcv[key][index] = value
        this.horizontalOhlcv[index][key] = value
    }

    getDataAsCols(){

        this.compute()

        const {precisionMultiplier, precision} = this
        const verticalClone = {...this.verticalOhlcv}

        if(precision)
        {
            for(const [key, arr] of Object.entries(verticalClone))
            {
                if(this.priceBased.includes(key))
                {
                    if(this.precision)
                    {
                        verticalClone[key] = arr.map(v => v / precisionMultiplier)
                    }
                    else
                    {
                        verticalClone[key] = arr
                    }
                }
            }
        }


        return verticalClone

    }

    getData() {

        //getData method returns the last object (row) of the new OHLCV with indicators: {open, high, low, close, rsi_14, bollinger_bands_upper}
        this.compute()

        const {precisionMultiplier, priceBased, precision} = this

        if(precision)
        {
            return this.horizontalOhlcv
                .filter(row => !Object.values(row).some(value => value === undefined || value === null))
                .map(row => divideByMultiplier({row, precisionMultiplier, priceBased}))
        }
        else
        {
            return this.horizontalOhlcv.filter(row => !Object.values(row).some(value => value === undefined || value === null))           
        }

    }
    
    
    getLastValues(){

        this.compute()

        const {precisionMultiplier, priceBased, precision} = this

        if(precision)
        {
            return divideByMultiplier({
                row: this.horizontalOhlcv[this.horizontalOhlcv.length - 1],
                precisionMultiplier,
                priceBased
            })
        }
        else
        {
            return this.horizontalOhlcv[this.horizontalOhlcv.length - 1]
        }
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

        const {target = 'close', height = false, range = [], zScore = [], scale = null} = options

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
        if (!Array.isArray(zScore)) {
            throw new Error('If set, "zScore" must be a array of column names in bollingerBands.');
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


    
        this.inputParams.push({key: 'bollingerBands', params: [size, stdDev, {target, height, scale, range, zScore}]});
    
        return this;
    }
    
    rsi(size, options = {})
    {
        isAlreadyComputed(this)

        // Validate size and times
        if (typeof size !== 'number' || size <= 0) {
            throw new Error('"size" must be a positive number in rsi.');
        }

        const {scale = null, target = 'close'} = options

        if (typeof scale === 'number' && !validMagnitudeValues.includes(scale)) {

            throw new Error(`"scale" value in rsi must be any of the following numbers: ${validMagnitudeValues.join(', ')}`);
        }

        this.inputParams.push({key: 'rsi', params: [size, {scale, target}]})

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
      
        const { height = false, range = [], scale = null } = options;
      
        if (!Array.isArray(range)) {
          throw new Error('If set, "range" must be an array of column names in donchianChannels.');
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
      
        this.inputParams.push({ key: 'donchianChannels', params: [size, offset, { height, range, scale }] });
      
        return this;
    }
      

    candleStudies(size = 20, stdDev = 2, options = {}) {
        isAlreadyComputed(this);
      
        if (typeof size !== 'number' || size <= 0) {
          throw new Error('"size" must be a positive number greater than 0 in candleStudies.');
        }
      
        if (typeof stdDev !== 'number' || stdDev <= 0) {
          throw new Error('"stdDev" must be a positive number greater than 0 in candleStudies.');
        }
      
        const { lag = 0, scale = 0.05 } = options;


        if (typeof scale === 'number' && !validMagnitudeValues.includes(scale)) {

            throw new Error(`"scale" value in candleStudies must be any of the following numbers: ${validMagnitudeValues.join(', ')}`);
        }
      
        this.inputParams.push({ key: 'candleStudies', params: [size, stdDev, {lag, scale}] });
        return this;
      }
      

    volumeOscillator(fastSize = 5, slowSize = 10, options = {})
    {

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
    priceVariations()
    {
        isAlreadyComputed(this)

        this.inputParams.push({key: 'priceVariations', params: []})
        return this           
    }
}