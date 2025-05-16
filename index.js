import { mainLoop } from './src/core-functions/mainLoop.js'
import { correlation } from './src/studies/correlation.js'
import { 
    isAlreadyComputed, 
    validateArray, 
    validateObject, 
    validateArrayOptions, 
    validateBoolean, 
    validateNumber, 
    validateArrayOfRanges,
    validateInputParams
} from './src/utilities/validators.js'
import { verticalToHorizontal } from './src/utilities/verticalToHorizontal.js'
import { pushToMain } from './src/core-functions/pushToMain.js'
import { assignTypes } from './src/utilities/assignTypes.js'
import { calcPrecisionMultiplier } from './src/utilities/precisionMultiplier.js'
import { buildArray } from './src/utilities/assignTypes.js'

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
        
        const {inputTypes, arrayTypes} = assignTypes(this.firstRow)

        this.inputTypes = inputTypes
        this.arrayTypes = arrayTypes
        if(!this.firstRow.hasOwnProperty('close')) throw Error(`input OHLCV array objects require at least "close" property: ${ticker}`)

        this.dateType = this.inputTypes.date ? this.inputTypes.date : null;
        this.isComputed = false
        this.input = input
        this.priceBased = new Set(['open', 'high', 'low', 'close'])
        this.len = input.length
        this.instances = {}
        this.crossPairsList = []
        this.verticalOhlcv = {}
        this.verticalOhlcvKeyNames = []
        this.verticalOhlcvTempCols = new Set()

        this.utilities = {
            correlation
        }

        this.invalidValueIndex = -1
        this.precision = precision
        this.precisionMultiplier = calcPrecisionMultiplier(this, this.firstRow)
        this.scaledGroups = {}

        this.pushToMain = ({index, key, value}) => pushToMain({main: this, index, key, value})
        
        if(inputParams !== null)
        {
            validateInputParams(inputParams, this.len)
            this.inputParams = inputParams
            this.compute()
        }
        {
            this.inputParams = []
        }

        
        
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
          priceBased,
          arrayTypes,
          verticalOhlcvTempCols
        } = this
        const result = {}
        const startIndex = skipNull ? invalidValueIndex + 1 : 0
        const newLen = len - startIndex
      
        for (const [key, arr] of Object.entries(verticalOhlcv)) {

            if(verticalOhlcvTempCols.has(key)) continue

            const shouldApplyPrecision = priceBased.has(key) && precision
            result[key] = buildArray(arrayTypes[key], newLen)

            for (let x = startIndex; x < len; x++)
            {
                result[key][x] =  (shouldApplyPrecision) 
                    ? arr[x] / precisionMultiplier 
                    : arr[x]
            }

        }
      
        return result;
      }
      

    getData(skipNull = true) {

        //getData method returns the last object (row) of the new OHLCV with indicators: {open, high, low, close, rsi_14, bollinger_bands_upper}
        this.compute()

        return verticalToHorizontal(skipNull, this, 0)
    }
    
    
    getLastValues(){

        this.compute()

        return verticalToHorizontal(false, this, this.len - 1)[0]
    }

    compute() {

        // If we've already computed, bail out immediately
        if (this.isComputed) {
          return this;
        }
      
        // Mark as “in progress”
        this.isComputed = false;
      
        // Figure out whether there’s a date field in the inputs
        
      
        // Only run the full loop once (or when new data appears later,
        // if you extend this to reset isComputed elsewhere)
        if (this.len > 0) {
          mainLoop(this.input, this);
          this.isComputed = true;

          //flushing after mainLoop
          this.input = []
          this.instances = {}
          this.firstRow = []
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

        for(const key of colKeys)
        {
            if(this.priceBased.has(key))
            {
                this.priceBased.add(key);
            }
        }
        
        return this;
    }
    
    relativeVolume(size = 10, options = {}) {

        const methodName = 'relativeVolume'

        if(!this.inputTypes.hasOwnProperty('volume')) {
            throw new Error('If "relativeVolume" is called the input ohlcv must contain valid volume properties.')
        }

        isAlreadyComputed(this)

        validateNumber(size, {min:1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)

        const { lag = 0} = options;

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

        this.inputParams.push({key: methodName, params: [size, {lag}]})
 
        return this
    }

    ema(size = 5, options = {}) {

        const methodName = 'ema'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)

        const {target = 'close', lag = 0} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

        this.inputParams.push({key: methodName, params: [methodName, size, {target, lag}]})

        return this
    }
    sma(size = 5, options = {}) {

        const methodName = 'sma'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)

        const {target = 'close', lag = 0} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

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
        
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

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


        validateArray(range, 'options.range', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(height, 'options.height', methodName)
    
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

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

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
      
        validateArray(range, 'options.range', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(height, 'options.height', methodName)
      
        this.inputParams.push({ key: methodName, params: [size, offset, { height, range, lag }] });
      
        return this;
    }
      

    volumeOscillator(fastSize = 5, slowSize = 10, options = {})
    {
        const methodName = 'volumeOscillator'

        if(!this.inputTypes.hasOwnProperty('volume')) {
            throw new Error('If "volumeOscillator" is called the input ohlcv must contain valid volume properties.')
        }

        isAlreadyComputed(this)

        validateNumber(fastSize, {min: 1, max: this.len, allowDecimals: false}, 'fastSize', methodName)
        validateNumber(slowSize, {min: fastSize, max: this.len, allowDecimals: false}, 'slowSize', methodName)
        validateObject(options, 'options', methodName)

        const {lag = 0} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

        this.inputParams.push({key: methodName, params: [fastSize, slowSize, {lag}]})
        return this           
    }
    dateTime(options = {})
    {

        const methodName = 'dateTime'

        isAlreadyComputed(this)

        validateObject(options, 'options', methodName)

        const {lag = 0} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

        this.inputParams.push({key: methodName, params: [{lag}]})
        return this           
    }

    scaler(size, colKeys = [], options = {})
    {
        const methodName = 'scaler'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateArray(colKeys, 'colKeys', methodName)

        const {group = false, range = [0, 1], lag = 0, type = 'minmax'} = options

        validateBoolean(group, 'options.group', methodName)
        validateArrayOfRanges(range, 'options.range', methodName)
        validateArrayOptions(['minmax', 'zscore'], type, 'options.type', methodName)

        const groupKey = (group) ? `${type}_${size}_group_${colKeys.join('_')}` : ''
        const groupKeyLen = colKeys.length
        const precomputed = {groupKey, groupKeyLen}

        this.inputParams.push({key: methodName, params: [size, colKeys, {type, group, range, lag, precomputed}]})
        return this
    }
}