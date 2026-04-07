import { mainLoop } from './src/core-functions/mainLoop.js'
import { 
    isAlreadyComputed, 
    validateArray, 
    validateObject, 
    validateArrayOptions, 
    validateBoolean, 
    validateNumber, 
    validateArrayOfRanges,
    validateInputParams,
    validateString
} from './src/utilities/validators.js'
import { verticalToHorizontal } from './src/utilities/verticalToHorizontal.js'
import { pushToMain } from './src/core-functions/pushToMain.js'
import { assignTypes } from './src/utilities/assignTypes.js'
import { dateOutputFormaters } from './src/utilities/dateUtilities.js'
import { defaultMapColsCallback } from './src/studies/mapCols.js'
import { calcPrecisionMultiplier } from './src/utilities/precisionMultiplier.js'

import { normalizeMinMax } from './src/machine-learning/ml-utilities.js'

/**
 * Class OHLCV_INDICATORS
 *
 * This class provides methods for calculating and managing technical indicators 
 * on financial OHLCV (Open, High, Low, Close, Volume) data. It enables users
 * OHLCV datasets.
 */

export default class OHLCV_INDICATORS {
    constructor({input, ticker = null, inputParams = null, chunkProcess = 2000, precision = false}) {

        validateArray(input, 'input', (ticker !== null) ? `contructor ${ticker}` : 'constuctor')
        if(input.length === 0) throw Error('input OHLCV must not be empty: ' + ticker)

        validateNumber(chunkProcess, {min: 100, max: 50000, allowDecimals: false}, 'chunkProcess', 'constructor')
        validateBoolean(precision, 'precision', 'contructor')

        this.chunkProcess = chunkProcess
        
        this.input = [...input]
        this.len = this.input.length
        this.firstRow = this.input[0]
        this.precision = precision

        const initialPriceBasedArr = ['open', 'high', 'low', 'close']
        this.initialPriceBased = new Set(initialPriceBasedArr)
        this.priceBased = new Set(initialPriceBasedArr)
        this.precisionMultiplier = calcPrecisionMultiplier(this)

        const {inputTypes, arrayTypes} = assignTypes(this)

        this.inputTypes = inputTypes
        this.arrayTypes = arrayTypes

        if(!this.firstRow.hasOwnProperty('close')) throw Error(`input OHLCV array objects require at least "close" property: ${ticker}`)

        this.dateType = this.inputTypes.date ? this.inputTypes.date : null;
        this.isComputed = false

        this.instances = {}
        this.verticalOhlcv = {}
        this.verticalOhlcvKeyNames = []
        this.verticalOhlcvTempCols = new Set()
        this.utilities = {}

        this.invalidValueIndex = -1
        this.scaledGroups = {}
        this.isAlreadyComputed = new Set()

        this.pushToMain = ({index, key, value}) => pushToMain({main: this, index, key, value})
        
        if(inputParams !== null)
        {
            validateInputParams(inputParams, this.len)
            this.inputParams = inputParams.sort((a, b) => a.order - b.order)
            this.compute()
        }
        else
        {
            this.inputParams = []
        }

        
        
        return this 
    }


    getData(options = {}) {

        //getData method returns the last object (row) of the new OHLCV with indicators: {open, high, low, close, rsi_14, bollinger_bands_upper}
        this.compute()

        const {skipNull = true, dateFormat = 'milliseconds'} = options

        validateArrayOptions(Object.keys(dateOutputFormaters), dateFormat, 'dateFormat', 'getData')
        validateObject(options, 'options', 'getData')
 
        return verticalToHorizontal({
            main: this, 
            skipNull, 
            startIndex: 0,
            dateFormat
        })
    }
    
    
    getLastValues(options = {}){

        this.compute()

        const {dateFormat = 'milliseconds'} = options
        
        validateArrayOptions(Object.keys(dateOutputFormaters), dateFormat, 'dateFormat', 'getData')

        return verticalToHorizontal({
            skipNull: false, 
            main: this, 
            startIndex: this.len - 1,
            dateFormat
        })[0]
    }

    compute() {

        // If we've already computed, bail out immediately
        if (this.isComputed) {
          return this;
        }

        this.inputParams = this.inputParams.sort((a, b) => a.order - b.order)
      
        // Mark as “in progress”
        this.isComputed = false;
      
        // Figure out whether there’s a date field in the inputs
        
      
        // Only run the full loop once (or when new data appears later,
        // if you extend this to reset isComputed elsewhere)
        if (this.len > 0) {
            mainLoop(this.input, this)

            this.isComputed = true;

            //flushing after mainLoop
            this.input = []
            this.instances = {}
            this.firstRow = []
        }
      
        return this;
    }      
    
    

    crossPairs(arr = [], options = {})
    {
        const methodName = 'crossPairs'

        isAlreadyComputed(this)
        validateArray(arr, 'arr', methodName)
        validateObject(options, 'options', methodName)

        const {limit = null, oneHot = false} = options
        
        if(limit !== null) validateNumber(limit, {min: 2, max: this.len}, 'options.limit', methodName)
        validateBoolean(oneHot, 'options.oneHot', methodName)
       
        const orderArr = []

        for (const {fast = '', slow = ''} of arr) {

            if (fast === '' || slow === '') {
                throw new Error(
                    `Invalid crossPairs[${fast}_${slow}]: Object property “fast” must be a non-null column name and “slow” must be a non-null column name or integer.`
                );
            }

            orderArr.push(fast.toString(), slow.toString())
        }

        if(this.isAlreadyComputed.has(methodName))
        {
            throw new Error(`You can only call the "${methodName}" method once.`)
        }

        this.isAlreadyComputed.add(methodName)

        this.inputParams.push({key: methodName, params: [arr, {limit, oneHot}]})
        
        return this
    }


    lag(colKeys = ['close'], lookback = 1) {

        const methodName = 'lag'

        isAlreadyComputed(this)
        validateArray(colKeys, 'colKeys', methodName)
        validateNumber(lookback, {min:1, max: this.len, allowDecimals: false}, 'lookback', methodName)

        this.inputParams.push({key: methodName, params: [colKeys, lookback]})
        
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

        this.inputParams.push({key: methodName, order: 0, params: [size, {lag}]})
 
        return this
    }

    volumeDelta(options = {}) {

        const methodName = 'volumeDelta'

        if(!this.inputTypes.hasOwnProperty('volume')) {
            throw new Error('If "volumeDelta" is called the input ohlcv must contain valid volume properties.')
        }

        isAlreadyComputed(this)

        validateObject(options, 'options', methodName)

        const { lag = 0} = options;

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

        this.inputParams.push({key: methodName, order: 0, params: [{lag}]})
 
        return this
    }

    atr(size = 14, options = {}) {

        const methodName = 'atr'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)

        const {lag = 0, percentage = false, upper = null, lower = null} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(percentage, 'options.percentage', 'atr')

        if(upper !== null) validateNumber(upper, {min: 0.001, max: 100, allowDecimals: true}, 'options.upper', 'atr')
        if(lower !== null) validateNumber(lower, {min: 0.001, max: 100, allowDecimals: true}, 'options.lower', 'atr')

        this.inputParams.push({key: methodName, order: 0, params: [size, {lag, percentage, upper, lower}]})

        return this
    }

    ema(size = 5, options = {}) {

        const methodName = 'ema'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)

        const {target = 'close', lag = 0} = options

        validateString(target, 'options.target', methodName)
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

        validateString(target, 'options.target', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

        this.inputParams.push({key: methodName, params: [methodName, size, {target, lag}]})

        return this
    }

    heikenAshi(smoothLength = null, afterSmoothLength = null, options = {}) {
        const methodName = 'heikenAshi'

        isAlreadyComputed(this)

        const bothNull = smoothLength === null && afterSmoothLength === null;

        if(bothNull === false) {
            validateNumber(smoothLength, {min: 1, max: this.len, allowDecimals: false}, 'smoothLength', methodName)
            validateNumber(afterSmoothLength, {min: 1, max: this.len, allowDecimals: false}, 'afterSmoothLength', methodName)
        }

        validateObject(options, 'options', methodName)

        const {lag = 0} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

        const order = 0

        this.inputParams.push({key: methodName, order, params: [smoothLength, afterSmoothLength, {lag, bothNull}]})

        return this
    }

    vidya(size = 14, momentum = 20, options = {}) {

        const methodName = 'vidya'

        isAlreadyComputed(this)

        validateNumber(size, {min: 2, max: this.len, allowDecimals: false}, 'size', methodName)
        validateNumber(momentum, {min: 1, max: this.len, allowDecimals: false}, 'momentum', methodName)
        validateObject(options, 'options', methodName)

        const {target = 'close', lag = 0, atrLength = 200, bandDistance = 2, liquidityLookback = 20} = options

        validateString(target, 'options.target', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateNumber(bandDistance, {min: 0.01, max: 10, allowDecimals: true}, 'options.bandDistance', methodName)
        validateNumber(atrLength, {min: 2, max: this.len, allowDecimals: false}, 'options.atrLength', methodName)
        validateNumber(liquidityLookback, {min: 1, max: this.len, allowDecimals: false}, 'options.liquidityLookback', methodName)

        this.inputParams.push({key: methodName, params: [size, momentum, {target, lag}]})

        return this
    }

    stochastic(kPeriod = 14, kSlowingPeriod = 3, dPeriod = 3, options = {}){
        const methodName = 'stochastic'

        const {len: max} = this

        validateNumber(kPeriod, {min: 1, max, allowDecimals: false}, 'kPeriod', methodName)
        validateNumber(kSlowingPeriod, {min: 1, max, allowDecimals: false}, 'kSlowingPeriod', methodName)
        validateNumber(dPeriod, {min: 1, max, allowDecimals: false}, 'dPeriod', methodName)
        validateObject(options, 'options', methodName)

        const {lag = 0} = options

        validateNumber(lag, {min: 0, max, allowDecimals: false}, 'options.lag', methodName)

        this.inputParams.push({key: methodName, order: 0, params: [kPeriod, kSlowingPeriod, dPeriod, {lag}]})

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
        
        validateString(target, 'options.target', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

        const instanceKey = `${fast}_${slow}_${signal}${target === 'close' ? '' : `_${target}`}`
        const precomputed = {instanceKey}

        this.inputParams.push({key: methodName, params: [fast, slow, signal, {target, lag, precomputed}]})
        
        return this

    }
    bollingerBands(size = 20, stdDev = 2, options = {}) {

        const methodName = 'bollingerBands'

        isAlreadyComputed(this)
        
        validateNumber(size, {min:1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateNumber(stdDev, {min: 0.01, max: 50, allowDecimals: true}, 'stdDev', methodName)
        validateObject(options, 'options', methodName)

        const {target = 'close', height = false, range = [],  lag = 0} = options

        validateString(target, 'options.target', methodName)
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

        validateString(target, 'options.target', methodName)
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
      
        this.inputParams.push({ key: methodName, order: 0, params: [size, offset, { height, range, lag}] });
      
        return this;
    }
      

    volumeOscillator(fastsize = 5, slowsize = 10, options = {})
    {
        const methodName = 'volumeOscillator'

        if(!this.inputTypes.hasOwnProperty('volume')) {
            throw new Error('If "volumeOscillator" is called the input ohlcv must contain valid volume properties.')
        }

        isAlreadyComputed(this)

        validateNumber(fastsize, {min: 1, max: this.len, allowDecimals: false}, 'fastsize', methodName)
        validateNumber(slowsize, {min: fastsize, max: this.len, allowDecimals: false}, 'slowsize', methodName)
        validateObject(options, 'options', methodName)

        const {lag = 0} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

        this.inputParams.push({key: methodName, order: 0, params: [fastsize, slowsize, {lag}]})
        return this           
    }
    dateTime(options = {})
    {

        const methodName = 'dateTime'

        isAlreadyComputed(this)

        validateObject(options, 'options', methodName)

        const {lag = 0, oneHot = false} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(oneHot, 'options.oneHot', methodName)

        const prefix = (oneHot) ? 'one_hot_' : ''


        const colKeySizes = {
            [`${prefix}month`]: 12,
            [`${prefix}day_of_the_month`]: 31,
            [`${prefix}day_of_the_week`]: 7,
            [`${prefix}hour`]: 24,
            [`${prefix}minute`]: 60
        }

        const precompute = {
            prefix,
            colKeySizes,
            colKeys: Object.keys(colKeySizes)
        }

        this.inputParams.push({key: methodName, order: 0, params: [{lag, oneHot, precompute}]})
        return this           
    }

    priceFeatures(options = {}) {
        let methodName = 'priceFeatures'

        isAlreadyComputed(this)

        validateObject(options, 'options', methodName)

        const {lag = 0, colKeys = []} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateArray(colKeys, 'options.colKeys', methodName)


        this.inputParams.push({key: methodName, params: [{lag, colKeys}]})

        return this
    }

    scaler(type = 'zscore', size, options = {})
    {
        let methodName = 'scaler'

        isAlreadyComputed(this)

        validateArrayOptions(['minmax', 'zscore', 'byfeature'], type, 'options.type', methodName)
        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)

        const longName = `${methodName}(${type}, ${size}, options = {})`
        
        validateObject(options, 'options', longName)

        const {minMaxRange = null, lag = false,  colKeys = [], weights = {}, euclideanWeights = false, byFeatureRange = null, offset = 0} = options

         validateNumber(offset, {min: 0, max: this.len, allowDecimals: false}, 'offset', methodName)


        validateArray(colKeys, 'options.colKeys', longName)
        validateBoolean(lag, 'options.lag', longName)
        
        
        validateObject(weights, 'options.weights', longName)

        const lookback = lag ? size - 1 : 0

        if(colKeys.length === 0) {
            throw new Error(`The property "options.colKeys" must be an array with target keys in ${longName}.`)
        }



        for(const [key, arr] of Object.entries(weights)) {
            validateArray(arr, `options.weights.${key}`)

            if(!lag && arr.size > 0) {
                throw new Error(`If "options.lag" is set to false "options.weights.${key}" can only contain 1 item (float) in ${longName}.`)
            }

            if(arr.length > size) {
                throw new Error(`The length of the property "options.weights.${key}" can not be longer than "size" in ${longName}.`)
            }

            for(let x = 0; x < arr.length; x++) {
                const val = arr[x]
                validateNumber(val, {min: 0.01, max: 10, allowDecimals: true}, `options.weights.${key}[${x}]`, longName)
            }

        }

        if (type !== 'byfeature') {

            if(!byFeatureRange == null) {
                throw new Error('"options.byFeatureRange" is only valid when "type" is "byfeature".')
            }
        }
        else {
            validateArrayOfRanges(byFeatureRange, 'options.byFeatureRange', longName)
        }
        
        if(['minmax', 'byfeature'].includes(type)) {
            validateArrayOfRanges(minMaxRange, 'options.minMaxRange', longName)
        }

        this.inputParams.push({key: methodName, params: [size, colKeys, {type, minMaxRange, lookback, weights, euclideanWeights, byFeatureRange, offset}]})
        return this
    }

    mapCols(newCols = ['change'], callback = null, options = {}) {

        isAlreadyComputed(this)

        const methodName = 'mapCols'

        if(typeof callback === 'undefined' || callback === null)
        {
            callback = defaultMapColsCallback
        }

        validateObject(options, 'options', methodName)

        const {lag = 0, isPriceBased = false} = options

        validateArray(newCols, 'newCols', methodName)
        validateNumber(lag, {min: 0, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(isPriceBased, 'isPriceBased', 'mapCols')

        if(this.precision === false && isPriceBased) {
            throw new Error(`Invalid param: If "mapCols.options.isPriceBased" is true, the "constructor.precision" param must be also true.`)
        }

        this.inputParams.push({key: methodName, params: [newCols, callback, {lag, isPriceBased}]})

        return this
    }
}