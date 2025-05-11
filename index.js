import { mainLoop } from './src/core-functions/mainLoop.js'
import { correlation } from './src/studies/correlation.js'
import { isAlreadyComputed, validateArray, validateObject, validateArrayOptions, validateBoolean, validateNumber } from './src/utilities/validators.js'
import { divideByMultiplier } from './src/utilities/numberUtilities.js'
import { verticalToHorizontal } from './src/utilities/verticalToHorizontal.js'
import { pushToMain } from './src/core-functions/pushToMain.js'
import { assignTypes } from './src/utilities/assignTypes.js'
import { calcPrecisionMultiplier } from './src/utilities/precisionMultiplier.js'
import { selectDateFormatter, dateFormaters } from './src/utilities/dateUtilities.js'

/**
 * Class OHLCV_INDICATORS
 *
 * This class provides methods for calculating and managing technical indicators 
 * on financial OHLCV (Open, High, Low, Close, Volume) data. It enables users 
 * to parallel compute various technical indicators in 1 single loop.
 * OHLCV datasets.
 */

export default class OHLCV_INDICATORS {
    constructor({input, ticker = null, precision = true, inputParams = null}) {

        validateArray(input, 'input', (ticker !== null) ? `contructor ${ticker}` : 'constuctor')
        if(input.length === 0) throw Error('input OHLCV must not be empty: ' + ticker)

        validateBoolean(precision, 'precision', 'constructor')

        this.firstRow = input[0]
        
        this.inputCols = Object.keys(this.firstRow)

        const {inputTypes, arrayTypes} = assignTypes(this.firstRow)
        
        this.inputTypes = inputTypes
        this.arrayTypes = arrayTypes

        if(!this.firstRow.hasOwnProperty('close')) throw Error(`input OHLCV array objects require at least "close" property: ${ticker}`)

        this.isComputed = false
        this.lastComputedIndex = 0
        this.input = input
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
        this.precisionMultiplier = calcPrecisionMultiplier(this, this.firstRow)
        this.ScaledGroups = {}
        
        
        if(inputParams !== null)
        {
            validateArray(inputParams, 'inputParams', 'constructor')
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

        //if change is a valid object and change.date is after the last row in this.input[this.input.length - 1].date pushes change to this.input using the mainLoop function.


        //stops the compute if compute is called from getData, getDataAsCols or getLastValues an isComputed is false
        if(this.isComputed === true && !change)
        {
            return this
        }
        else{
            this.isComputed = false
        }

        //checks if the date property has been added to input
        this.dateType = this.inputTypes.hasOwnProperty('date') && this.inputTypes.date ? this.inputTypes.date : null

         //compute method can be used to process indicators if no arguments are provided
         //compute method can be called to access the .verticalOhlcv object
         //compute method is called automatically if getLastValues or getDate methods are called
        if (this.len > this.lastComputedIndex && !change) {
            mainLoop(this.input, this, 0);
        }        

        //compute method can be used to add new or update the last datapoints if a new OHLCV object is passed with a valid date property
        //valid date properties: "2024-12-16 15:45:00" or "2024-12-16"
        if (change && typeof change === 'object') {

            if (!this.inputCols.every(f => Object.keys(change).includes(f))) {
                throw Error(`Invalid OHLCV object sent in "compute". Correct usage: .compute(${JSON.stringify(this.firstRow)})`);
            }            
            else if(this.dateType === null)
            {
                throw Error('All the OHLCV rows require a valid "date" property to access the compute change method.')
            }
            else if(!change.hasOwnProperty('date') || selectDateFormatter(change.date) !== this.dateType)
            {
                throw Error(`The "date" property added to the ohlcv object in the compute method is not available or invalid. Correct format for date property is ${this.dateType}.`)
            }

            const changeDate = dateFormaters[this.dateType](change.date)
            const lastIndex = this.len - 1;
            const lastDate = this.verticalOhlcv.date[lastIndex];

            console.log({changeDate, lastDate})

    
            //fallback if .compute(change) is triggered before .compute() alone
            if (this.lastComputedIndex === 0) {
                this.compute()
                return this
            } else{
                this.isComputed = false
            }

            if (changeDate > lastDate) {
                // Add new item
                this.len++
                this.input.push(change)
                mainLoop(this.input, this, this.len)
            } else {
                // Modify the last item
                this.input[lastIndex] = change
                mainLoop(this.input, this, lastIndex)
            }

        }
    

    
        return this;
    }
    
    

    crossPairs(arr = [])
    {

        const methodName = 'crossPairs'

        isAlreadyComputed(this)

        validateArray(arr, 'arr', methodName)

        this.crossPairsList = [...this.crossPairsList, ...arr]
        this.inputParams.push({key: methodName, params: [this.crossPairsList]})
        
        return this
    }


    lag(colKeys = ['close'], lookback = 1) {

        const methodName = 'lag'

        isAlreadyComputed(this)

        validateArray(colKeys, 'colKeys', methodName)
        validateNumber(lookback, {min:1, max: this.len, allowDecimals: false}, 'lookback', methodName)

        this.inputParams.push({key: methodName, params: [colKeys, lookback]})

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
    
    relativeVolume(size = 10, options = {}) {

        const methodName = 'relativeVolume'

        if(!this.inputCols.includes('volume')) {
            throw new Error('If "relativeVolume" is called the input ohlcv must contain valid volume properties.')
        }

        isAlreadyComputed(this)

        validateNumber(size, {min:1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)

        const { lag = 0} = options;

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'lag', methodName)

        this.inputParams.push({key: methodName, params: [size, {lag}]})
 
        return this
    }

    ema(size = 5, options = {}) {

        const methodName = 'ema'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)

        const {target = 'close', lag = 0} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'lag', methodName)

        this.inputParams.push({key: methodName, params: [methodName, size, {target, lag}]})

        return this
    }
    sma(size = 5, options = {}) {

        const methodName = 'sma'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)

        const {target = 'close', lag = 0} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'lag', methodName)

        this.inputParams.push({key: methodName, params: [methodName, size, {target, lag}]})

        return this
    }

    
    macd(fast = 12, slow = 26, signal = 9, options = {}) {

        const methodName = 'macd'

        isAlreadyComputed(this)

        validateNumber(fast, {min: 1, max: this.len, allowDecimals: false}, 'fast', methodName)
        validateNumber(slow, {min: 1, max: this.len, allowDecimals: false}, 'slow', methodName)
        validateNumber(signal, {min: 1, max: this.len, allowDecimals: false}, 'signal', methodName)
        validateObject(options, 'options', methodName)

        const {target = 'close', lag = 0} = options
        
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'lag', methodName)

        this.inputParams.push({key: methodName, params: [fast, slow, signal, {target, lag}]})
        
        return this

    }
    bollingerBands(size = 20, stdDev = 2, options = {}) {

        const methodName = 'bollingerBands'

        isAlreadyComputed(this)
        
        validateNumber(size, {min:1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateNumber(stdDev, {min: 0.01, max: 50, allowDecimals: true}, 'stdDev', methodName)
        validateObject(options, 'options', methodName)

        const {target = 'close', height = false, range = [],  lag = 0} = options


        validateArray(range, 'range', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'lag', methodName)
        validateBoolean(height, 'height', methodName)
    
        this.inputParams.push({key: methodName, params: [size, stdDev, {target, height, range, lag}]});
    
        return this;
    }
    
    rsi(size = 14, options = {})
    {
        const methodName = 'rsi'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)
        
        const {target = 'close', lag = 0} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'lag', methodName)

        this.inputParams.push({key: methodName, params: [size, {target, lag}]})

        return this
    }
    donchianChannels(size = 20, offset = 0, options = {}) {

        const methodName = 'donchianChannels'

        isAlreadyComputed(this)

        
        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateNumber(offset, {min: 0, max: this.len, allowDecimals: false}, 'offset', methodName)
      
        validateObject(options, 'options', methodName)
        const { height = false, range = [], lag = 0} = options;
      
        validateArray(range, 'range', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'lag', methodName)
        validateBoolean(height, 'height', methodName)
      
        this.inputParams.push({ key: methodName, params: [size, offset, { height, range, lag }] });
      
        return this;
    }
      

    volumeOscillator(fastSize = 5, slowSize = 10, options = {})
    {
        const methodName = 'volumeOscillator'

        if(!this.inputCols.includes('volume')) {
            throw new Error('If "volumeOscillator" is called the input ohlcv must contain valid volume properties.')
        }

        isAlreadyComputed(this)

        validateNumber(fastSize, {min: 1, max: this.len, allowDecimals: false}, 'fastSize', methodName)
        validateNumber(slowSize, {min: fastSize, max: this.len, allowDecimals: false}, 'slowSize', methodName)
        validateObject(options, 'options', methodName)

        const {lag = 0} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'lag', methodName)

        this.inputParams.push({key: methodName, params: [fastSize, slowSize, {lag}]})
        return this           
    }
    dateTime(options = {})
    {

        const methodName = 'dateTime'

        isAlreadyComputed(this)

        validateObject(options, 'options', methodName)

        const {lag = 0} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'lag', methodName)

        this.inputParams.push({key: methodName, params: [{lag}]})
        return this           
    }

    Scaler(size, colKeys, options)
    {
        const methodName = 'Scaler'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateArray(colKeys, 'colKeys', methodName)

        const {group = false, range = [0, 1], lag = 0, type = 'minmax'} = options

        validateBoolean(group, 'group', methodName)
        validateArray(range, 'range', methodName)
        validateArrayOptions(['minmax', 'zscore'], type, 'type', methodName)

        this.inputParams.push({key: methodName, params: [size, colKeys, type, group, range, lag]})
        return this
    }
}