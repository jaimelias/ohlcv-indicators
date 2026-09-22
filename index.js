import { mainLoop } from './src/core-functions/mainLoop.js'
import { 
    isAlreadyComputed, 
    validateArray, 
    validateObject, 
    validateArrayOptions, 
    validateBoolean, 
    validateNumber, 
    validateInputParams,
    validateString
} from './src/utilities/validators.js'
import { verticalToHorizontal } from './src/utilities/verticalToHorizontal.js'
import { assignTypes } from './src/utilities/assignTypes.js'
import { dateOutputFormaters } from './src/utilities/dateUtilities.js'
import { calcPrecisionMultiplier } from './src/utilities/precisionMultiplier.js'
import { CONFIG_VERSION, copyConfig, freezeConfig } from './src/utilities/config.js'

/**
 * Class OHLCV_INDICATORS
 *
 * This class provides methods for calculating and managing technical indicators 
 * on financial OHLCV (Open, High, Low, Close, Volume) data. It enables users
 * OHLCV datasets.
 */

export default class OHLCV_INDICATORS {
    constructor({input, ticker = null, chunkProcess = 2000, config = {}}) {

        if (config === null || Array.isArray(config) || typeof config !== 'object') {
            throw new TypeError('Constructor "config" must be a plain object.')
        }
        const savedConfig = copyConfig(config)
        const configKeys = ['schemaVersion', 'precision', 'useFullNames', 'inputParams', 'dateFormat', 'skipNull', 'timeZone']
        for (const key of Object.keys(savedConfig)) {
            if (!configKeys.includes(key)) throw new Error(`Unknown configuration option "${key}".`)
        }
        const {
            schemaVersion = CONFIG_VERSION,
            precision = false,
            useFullNames = false,
            inputParams = null,
            dateFormat = 'milliseconds',
            skipNull = true,
            timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
        } = savedConfig

        if (schemaVersion !== CONFIG_VERSION) throw new Error(`Unsupported configuration schemaVersion: ${schemaVersion}.`)
        validateBoolean(skipNull, 'config.skipNull', 'constructor')
        validateString(dateFormat, 'config.dateFormat', 'constructor')
        validateArrayOptions(Object.keys(dateOutputFormaters), dateFormat, 'config.dateFormat', 'constructor')
        validateString(timeZone, 'config.timeZone', 'constructor')
        const resolvedTimeZone = new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone
        this.config = Object.freeze({ schemaVersion, precision, useFullNames, dateFormat, skipNull, timeZone: resolvedTimeZone })
        this.timeZone = resolvedTimeZone

        validateArray(input, 'input', (ticker !== null) ? `contructor ${ticker}` : 'constuctor')
        if(input.length === 0) throw Error('input OHLCV must not be empty: ' + ticker)

        validateNumber(chunkProcess, {min: 100, max: 50000, allowDecimals: false}, 'chunkProcess', 'constructor')
        validateBoolean(precision, 'precision', 'contructor')
        validateBoolean(useFullNames, 'config.useFullNames', 'constructor')

        this.chunkProcess = chunkProcess
        
        this.input = [...input]
        this.len = this.input.length
        this.firstRow = this.input[0]
        this.precision = precision
        this.useFullNames = useFullNames

        const initialPriceBasedArr = ['open', 'high', 'low', 'close', 'mid_price']
        this.initialPriceBased = new Set(initialPriceBasedArr)
        this.priceBased = new Set(initialPriceBasedArr)
        this.precisionMultiplier = calcPrecisionMultiplier(this)

        const {inputTypes, arrayTypes} = assignTypes(this)

        this.inputTypes = inputTypes
        this.arrayTypes = arrayTypes

        if(!this.firstRow.hasOwnProperty('close')) throw Error(`input OHLCV array objects require at least "close" property: ${ticker}`)

        this.dateType = this.inputTypes.date ? this.inputTypes.date : null;
        this.isComputed = false
        this.isComputing = false
        this.executionParams = []

        this.instances = {}
        this.verticalOhlcv = {}
        this.verticalOhlcvKeyNames = []
        this.verticalOhlcvTempCols = new Set()
        this.utilities = {}

        this.invalidValueIndex = -1
        this.scaledGroups = {}
        this.isAlreadyComputed = new Set()

        this.pushToMain = ({index, key, value}) => {
            this.verticalOhlcv[key][index] = value
        }
        
        if(inputParams !== null)
        {
            validateInputParams(inputParams, this.len)
            this.inputParams = freezeConfig(copyConfig(inputParams))
            this.compute()
        }
        else
        {
            this.inputParams = Object.freeze([])
        }

        
        
        return this 
    }


    exportConfig() {
        return { ...this.config, inputParams: copyConfig(this.inputParams) }
    }

    _registerIndicator(job) {
        isAlreadyComputed(this)
        this.inputParams = Object.freeze([...this.inputParams, freezeConfig(copyConfig(job))])
        return this
    }

    getData(options = {}) {

        //getData method returns the last object (row) of the new OHLCV with indicators: {open, high, low, close, rsi_14, bollinger_bands_upper}
        this.compute()

        const {skipNull = this.config.skipNull, dateFormat = this.config.dateFormat} = options

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

        const {dateFormat = this.config.dateFormat} = options
        
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

        if (this.isComputing) throw new Error('Computation is already in progress.')

        this.executionParams = copyConfig(this.inputParams)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      
        // Mark as “in progress”
        this.isComputed = false;
      
        // Figure out whether there’s a date field in the inputs
        
      
        // Only run the full loop once (or when new data appears later,
        // if you extend this to reset isComputed elsewhere)
        if (this.len > 0) {
            this.isComputing = true
            try {
                mainLoop(this.input, this)
            } finally {
                this.isComputing = false
            }

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

        this._registerIndicator({key: methodName, params: [arr, {limit, oneHot}]})
        
        return this
    }


    lag(colKeys = ['close'], lookback = 1) {

        const methodName = 'lag'

        isAlreadyComputed(this)
        validateArray(colKeys, 'colKeys', methodName)

        const invalidItem = colKeys.find(v => typeof v !== 'string' || v === '')

        if(invalidItem !== undefined) {
            throw new Error(`Invalid item "${invalidItem}" (column name) in "colKeys" array param of "${methodName}()".`)
        }

        validateNumber(lookback, {min:1, max: this.len, allowDecimals: false}, 'lookback', methodName)

        this._registerIndicator({key: methodName, params: [colKeys, lookback]})
        
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

        const { lag = 0, retLogs = false } = options;

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(retLogs, 'options.retLogs', methodName)

        this._registerIndicator({key: methodName, order: 0, params: [size, {lag, retLogs}]})
 
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

        this._registerIndicator({key: methodName, order: 0, params: [{lag}]})
 
        return this
    }

    atr(size = 14, options = {}) {

        const methodName = 'atr'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)

        const {lag = 0, retLogs = false} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(retLogs, 'options.retLogs', methodName)


        this._registerIndicator({key: methodName, order: 0, params: [size, {lag, retLogs}]})

        return this
    }

    adx(size = 14, options = {}) {

        const methodName = 'adx'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)

        const {lag = 0, retLogs = false} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(retLogs, 'options.retLogs', methodName)


        this._registerIndicator({key: methodName, order: 0, params: [size, {lag, retLogs}]})

        return this
    }

    ema(size = 5, options = {}) {

        const methodName = 'ema'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)

        const {target = 'close', lag = 0, retLogs = false} = options

        validateString(target, 'options.target', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(retLogs, 'options.retLogs', methodName)

        this._registerIndicator({key: methodName, params: [methodName, size, {target, lag, retLogs}]})

        return this
    }
    sma(size = 5, options = {}) {

        const methodName = 'sma'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)

        const {target = 'close', lag = 0, retLogs = false} = options

        validateString(target, 'options.target', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(retLogs, 'options.retLogs', methodName)

        this._registerIndicator({key: methodName, params: [methodName, size, {target, lag, retLogs}]})

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

        const {lag = 0, retLogs = false} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(retLogs, 'option.retLogs', methodName)

        const order = 0

        this._registerIndicator({key: methodName, order, params: [smoothLength, afterSmoothLength, {lag, bothNull, retLogs}]})

        return this
    }

    stochastic(kPeriod = 14, kSlowingPeriod = 3, dPeriod = 3, options = {}){
        const methodName = 'stochastic'

        isAlreadyComputed(this)

        const {len: max} = this

        validateNumber(kPeriod, {min: 1, max, allowDecimals: false}, 'kPeriod', methodName)
        validateNumber(kSlowingPeriod, {min: 1, max, allowDecimals: false}, 'kSlowingPeriod', methodName)
        validateNumber(dPeriod, {min: 1, max, allowDecimals: false}, 'dPeriod', methodName)
        validateObject(options, 'options', methodName)

        const {lag = 0, retLogs} = options

        validateNumber(lag, {min: 0, max, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(retLogs, 'retLogs', methodName)

        this._registerIndicator({key: methodName, params: [kPeriod, kSlowingPeriod, dPeriod, {lag, retLogs}]})

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

        this._registerIndicator({key: methodName, params: [fast, slow, signal, {target, lag, precomputed}]})
        
        return this

    }
    bollingerBands(size = 20, stdDev = 2, options = {}) {

        const methodName = 'bollingerBands'

        isAlreadyComputed(this)
        
        validateNumber(size, {min:1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateNumber(stdDev, {min: 0.01, max: 50, allowDecimals: true}, 'stdDev', methodName)
        validateObject(options, 'options', methodName)

        const { lag = 0, retLogs = false } = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(retLogs, 'options.retLogs', methodName)
  
        this._registerIndicator({key: methodName, params: [size, stdDev, {lag, retLogs}]});
    
        return this;
    }
    
    rsi(size = 14, options = {})
    {
        const methodName = 'rsi'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)
        
        const {target = 'close', lag = 0, retLogs =  false} = options

        validateString(target, 'options.target', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(retLogs, 'retLogs', methodName)

        this._registerIndicator({key: methodName, params: [size, {target, lag, retLogs}]})

        return this
    }
    mfi(size = 14, options = {}) {
        const methodName = 'mfi'

        isAlreadyComputed(this)
        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)

        const {lag = 0, retLogs = false} = options
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(retLogs, 'options.retLogs', methodName)

        this._registerIndicator({key: methodName, params: [size, {lag, retLogs}]})
        return this
    }

    donchianChannels(size = 20, offset = 0, options = {}) {

        const methodName = 'donchianChannels'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateNumber(offset, {min: 0, max: this.len, allowDecimals: false}, 'offset', methodName)
      
        validateObject(options, 'options', methodName)
        const { lag = 0, retLogs = false } = options;
      
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(retLogs, 'options.retLogs', methodName)
      
        this._registerIndicator({ key: methodName, order: 0, params: [size, offset, {lag, retLogs}] });
      
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

        const {lag = 0, retLogs = false} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(retLogs, 'retLogs', methodName)

        this._registerIndicator({key: methodName, order: 0, params: [fastsize, slowsize, {lag, retLogs}]})
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

        this._registerIndicator({key: methodName, order: 0, params: [{lag, oneHot, precompute}]})
        return this           
    }

    candleFeatures(options = {}) {
        let methodName = 'candleFeatures'

        isAlreadyComputed(this)

        validateObject(options, 'options', methodName)

        const {lag = 0, colKeys = [], retLogs = false} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateArray(colKeys, 'options.colKeys', methodName)
        validateBoolean(retLogs, 'retLogs', methodName)


        this._registerIndicator({key: methodName, params: [{lag, colKeys, retLogs}]})

        return this
    }

}
