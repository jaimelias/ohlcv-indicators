import { parseOhlcvToVertical } from './src/utilities/parsing-utilities.js'
import { correlation } from './src/studies/correlation.js'
import { setIndicatorsFromInputParams } from './src/utilities/setIndicatorsFromInputParams.js'
import { validateDate } from './src/utilities/validators.js'
import { isAlreadyComputed } from './src/utilities/validators.js'

export default class OHLCV_INDICATORS {
    constructor({input, ticker = null}) {

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
        this.horizontalOhlcv = new Array(this.len).fill({})

        this.inputParams = []

        this.studies = {}
        this.utilities = {
            correlation
        }

        this.precisionMultiplier = 0
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

        const {precisionMultiplier} = this
        const verticalClone = {...this.verticalOhlcv}

        for(const [key, arr] of Object.entries(verticalClone))
        {
            if(this.priceBased.includes(key))
            {
                verticalClone[key] = arr.map(v => v / precisionMultiplier)
            }
        }

        return verticalClone

    }

    getData() {

        //getData method returns the last object (row) of the new OHLCV with indicators: {open, high, low, close, rsi_14, bollinger_bands_upper}
        this.compute()
        return this.horizontalOhlcv.filter(row => 
            !Object.values(row).some(value => value === undefined || value === null)
        )
    }
    
    
    getLastValues(){

        this.compute()

        return this.horizontalOhlcv[this.horizontalOhlcv.length - 1]
    
    }

    compute(change) {


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

            if(this.priceBased.find(v => key.startsWith(v)))
            {
                this.priceBased.push(key)
            }
        }
        
        return this;
    }
    
    relativeVolume(size) {

        isAlreadyComputed(this)

        this.inputParams.push({key: 'relativeVolume', params: [size]})
 
        return this
    }

    ema(size, options = {}) {

        isAlreadyComputed(this)

        if(!options || typeof options !== 'object')
        {
            throw new Error('"options" must be an object in ema. eg: {target, height, range}');
        }

        const {target = 'close'} = options

        if (typeof size !== 'number' || size <= 0) {
            throw new Error('"size" must be a positive number in ema.');
        }

        this.inputParams.push({key: 'ema', params: [size, target]})
        this.priceBased.push(`ema_${size}`)

        return this
    }
    sma(size, options = {}) {

        isAlreadyComputed(this)

        if(!options || typeof options !== 'object')
        {
            throw new Error('"options" must be an object in sma. eg: {target, height, range}');
        }

        const {target = 'close'} = options

        if (typeof size !== 'number' || size <= 0) {
            throw new Error('"size" must be a positive number in sma.');
        }


        this.inputParams.push({key: 'sma', params: [size, target]})
        this.priceBased.push(`sma_${size}`)

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

        const {target = 'close', height = 0, range = [], zScore = []} = options

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
        if (typeof height !== 'number' || typeof height === 'number' && (height > 0 && height < size)) {
            throw new Error('"height" must be a "0" or any number greater than or equal to "size" in bollingerBands.');
        } 
    
        this.inputParams.push({key: 'bollingerBands', params: [size, stdDev, {target, height, range, zScore}]});
        this.priceBased.push('bollinger_bands_middle', 'bollinger_bands_upper', 'bollinger_bands_lower');
    
        return this;
    }
    
    rsi(size)
    {
        isAlreadyComputed(this)

        // Validate size and times
        if (typeof size !== 'number' || size <= 0) {
            throw new Error('"size" must be a positive number in rsi.');
        }

        this.inputParams.push({key: 'rsi', params: [size]})

        return this
    }
    donchianChannels(size = 20, offset = 0, options = {})
    {
        isAlreadyComputed(this)

        if (typeof size !== 'number' || size <= 0) {
            throw new Error('"size" must be a positive number or 0 in donchianChannels.');
        }
    
        if (typeof offset !== 'number' || offset <= 0) {
            throw new Error('"offset" must be a positive number or 0 in donchianChannels.');
        }

        const {height = false, range = false} = options

        this.inputParams.push({key: 'donchianChannels', params: [size, offset, {height, range}]})
        this.priceBased.push('donchian_channel_upper', 'donchian_channel_lower', 'donchian_channel_basis')

        return this       
    }
    candleStudies(size = 20, classify = true, classificationLevels)
    {

        isAlreadyComputed(this)

        if (typeof size !== 'number' || size <= 0) {
            throw new Error('"size" must be a positive number or 0 in candleStudies.');
        }

        if (typeof classify !== 'boolean') {
            throw new Error('"classify" must be a true or false in candleStudies.');
        }

        this.inputParams.push({key: 'candleStudies', params: [size, classify, classificationLevels]})
        return this       
    }

    volumeOscillator(fastSize = 5, slowSize = 10)
    {

        isAlreadyComputed(this)

        if (typeof fastSize !== 'number' || fastSize <= 0) {
            throw new Error('fastSize" must be a positive number in volumeOscillator.');
        }

        if (typeof slowSize !== 'number' || slowSize <= fastSize) {
            throw new Error('"slowSize" must be a positive number greater than the "fastSize" in volumeOscillator.');
        }

        this.inputParams.push({key: 'volumeOscillator', params: [fastSize, slowSize]})
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