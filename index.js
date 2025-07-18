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
    validateInputParams,
    validateString
} from './src/utilities/validators.js'
import { verticalToHorizontal } from './src/utilities/verticalToHorizontal.js'
import { pushToMain } from './src/core-functions/pushToMain.js'
import { assignTypes } from './src/utilities/assignTypes.js'
import { buildArray, getArrayType } from './src/utilities/assignTypes.js'
import { dateOutputFormaters } from './src/utilities/dateUtilities.js'
import { defaultMapColsCallback } from './src/studies/mapCols.js'
import { getOrderFromArray } from './src/utilities/order.js'

import {
    defaultYCallback,
    validRegressors,
    validClassifiers,
    exportTrainedModels
} from './src/machine-learning/ml-config.js'

import { normalizeMinMax } from './src/machine-learning/ml-utilities.js'

/**
 * Class OHLCV_INDICATORS
 *
 * This class provides methods for calculating and managing technical indicators 
 * on financial OHLCV (Open, High, Low, Close, Volume) data. It enables users 
 * to parallel compute various technical indicators in 1 single loop for standard indicators and a second loop for ML regressors and classifier.
 * OHLCV datasets.
 */

export default class OHLCV_INDICATORS {
    constructor({input, ticker = null, inputParams = null, chunkProcess = 2000, ML = {}}) {

        validateArray(input, 'input', (ticker !== null) ? `contructor ${ticker}` : 'constuctor')
        if(input.length === 0) throw Error('input OHLCV must not be empty: ' + ticker)

        validateNumber(chunkProcess, {min: 100, max: 50000, allowDecimals: false}, 'chunkProcess', 'constructor')
        validateObject(ML, 'ML', 'constructor')

        this.chunkProcess = chunkProcess
        
        this.input = [...input]
        this.len = this.input.length
        this.firstRow = this.input[0]
        
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

        this.utilities = {
            correlation
        }

        this.invalidValueIndex = -1
        this.scaledGroups = {}
        this.isAlreadyComputed = new Set()

        const {classes: mlClasses} = ML

        if(typeof mlClasses !== 'undefined') validateObject(mlClasses, 'ML.classes', 'constructor')

        this.ML = {
            models: {},
            classes: mlClasses,
            metrics: {},
            featureCols: {}
        }
        this.processSecondaryLoop = false

        this.pushToMain = ({index, key, value}) => pushToMain({main: this, index, key, value})
        
        if(inputParams !== null)
        {
            validateInputParams(inputParams, this.len)
            this.inputParams = inputParams
            this.compute()
        }
        else
        {
            this.inputParams = []
        }

        
        
        return this 
    }


    getDataAsCols(options = {}) {
        this.compute();

        const {skipNull = true, dateFormat = 'string'} = options

        validateArrayOptions(Object.keys(dateOutputFormaters), dateFormat, 'dateFormat', 'getDataAsCols')
        validateObject(options, 'options', 'getDataAsCols')
      
        const {
          len,
          invalidValueIndex,
          verticalOhlcv,
          verticalOhlcvTempCols,
        } = this
        const result = {}

        const startIndex = skipNull ? invalidValueIndex + 1 : 0
        const newLen = len - startIndex
      
        for (const [key, arr] of Object.entries(verticalOhlcv)) {

            if(verticalOhlcvTempCols.has(key)) continue

            const thisArrType = getArrayType(key, verticalOhlcv[key])

            result[key] = buildArray(thisArrType, newLen)

            for (let x = startIndex; x < len; x++)
            {
                if(key === 'date')
                {
                    result[key][x] = dateOutputFormaters[dateFormat](arr[x])
                }
                else{
                    result[key][x] = arr[x]
                }
            }

        }
      
        return result;
      }
      

    getData(options = {}) {

        //getData method returns the last object (row) of the new OHLCV with indicators: {open, high, low, close, rsi_14, bollinger_bands_upper}
        this.compute()

        const {skipNull = true, dateFormat = 'string'} = options

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

        const {dateFormat = 'string'} = options
        
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

        const {limit = 125, oneHot = false} = options
        
        validateNumber(limit, {min: 2, max: this.len}, 'options.limit', methodName)
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

        const order = getOrderFromArray(orderArr, methodName)

        this.inputParams.push({key: methodName, order, params: [arr, {limit, oneHot}]})
        
        return this
    }


    lag(colKeys = ['close'], lookback = 1) {

        const methodName = 'lag'

        isAlreadyComputed(this)
        validateArray(colKeys, 'colKeys', methodName)
        validateNumber(lookback, {min:1, max: this.len, allowDecimals: false}, 'lookback', methodName)

        const order = getOrderFromArray(colKeys, methodName)
        this.inputParams.push({key: methodName, order, params: [colKeys, lookback]})
        
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

        const order = getOrderFromArray([target], methodName)

        this.inputParams.push({key: methodName, order, params: [methodName, size, {target, lag}]})

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

        const order = getOrderFromArray([target], methodName)

        this.inputParams.push({key: methodName, order, params: [methodName, size, {target, lag}]})

        return this
    }

    heikenAshi(smoothLength = 10, afterSmoothLength = 10, options = {}) {
        const methodName = 'heikenAshi'

        isAlreadyComputed(this)

        validateNumber(smoothLength, {min: 1, max: this.len, allowDecimals: false}, 'smoothLength', methodName)
        validateNumber(afterSmoothLength, {min: 1, max: this.len, allowDecimals: false}, 'afterSmoothLength', methodName)
        validateObject(options, 'options', methodName)

        const {lag = 0} = options

        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

        const order = 0

        this.inputParams.push({key: methodName, order, params: [smoothLength, afterSmoothLength, {lag}]})

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

        const order = getOrderFromArray([target], methodName)

        this.inputParams.push({key: methodName, order, params: [size, momentum, {target, lag}]})

        return this
    }

    stochastic(kPeriod = 14, kSlowingPeriod = 3, dPeriod = 3, options = {}){
        const methodName = 'stochastic'

        const {len: max} = this

        validateNumber(kPeriod, {min: 1, max, allowDecimals: false}, 'kPeriod', methodName)
        validateNumber(kSlowingPeriod, {min: 1, max, allowDecimals: false}, 'kSlowingPeriod', methodName)
        validateNumber(dPeriod, {min: 1, max, allowDecimals: false}, 'dPeriod', methodName)
        validateObject(options, 'options', methodName)

        let parser = v => v
        let prefix = ''

        const {lag = 0} = options

        validateNumber(lag, {min: 0, max, allowDecimals: false}, 'options.lag', methodName)

        let minmax = options.minmax

        if(Array.isArray(minmax) || (typeof minmax === 'boolean' && minmax === true))
        {
            if(Array.isArray(minmax)){
                validateArrayOfRanges(minmax, 'options.minmax', methodName)
                parser = value => (minmax !== null) ? normalizeMinMax(value, 0, 100, minmax) : value
            } else
            {
                validateBoolean(minmax, 'options.minmax', methodName)
                minmax = [0, 1]
                parser = value => (minmax !== null) ? normalizeMinMax(value, 0, 100, minmax) : value
            }
            prefix = 'minmax_'
        }

        this.inputParams.push({key: methodName, order: 0, params: [kPeriod, kSlowingPeriod, dPeriod, {minmax, prefix, parser, lag}]})

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

        const order = getOrderFromArray([target], methodName)

        this.inputParams.push({key: methodName, order, params: [fast, slow, signal, {target, lag, precomputed}]})
        
        return this

    }
    bollingerBands(size = 20, stdDev = 2, options = {}) {

        const methodName = 'bollingerBands'

        isAlreadyComputed(this)
        
        validateNumber(size, {min:1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateNumber(stdDev, {min: 0.01, max: 50, allowDecimals: true}, 'stdDev', methodName)
        validateObject(options, 'options', methodName)

        const {target = 'close', height = false, range = [],  lag = 0, decimals = null} = options

        validateString(target, 'options.target', methodName)
        validateArray(range, 'options.range', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(height, 'options.height', methodName)
        if(decimals !== null) validateNumber(decimals, {min: 1, max: 15, allowDecimals: false}, 'decimals', methodName)
  
        const order = getOrderFromArray([target], methodName)

        this.inputParams.push({key: methodName, order, params: [size, stdDev, {target, height, range, lag, decimals}]});
    
        return this;
    }
    
    rsi(size = 14, options = {})
    {
        const methodName = 'rsi'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateObject(options, 'options', methodName)
        
        const {target = 'close', lag = 0} = options
        let minmax = options.minmax
        validateString(target, 'options.target', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)

        let parser = v => v
        let prefix = ''

        if(Array.isArray(minmax) || (typeof minmax === 'boolean' && minmax === true))
        {
            if(Array.isArray(minmax)){
                validateArrayOfRanges(minmax, 'options.minmax', methodName)
                parser = value => (minmax !== null) ? normalizeMinMax(value, 0, 100, minmax) : value
            } else
            {
                validateBoolean(minmax, 'options.minmax', methodName)
                minmax = [0, 1]
                parser = value => (minmax !== null) ? normalizeMinMax(value, 0, 100, minmax) : value
            }
            prefix = 'minmax_'
        }

        const order = getOrderFromArray([target], methodName)

        this.inputParams.push({key: methodName, order, params: [size, {target, lag, parser, prefix, minmax}]})

        return this
    }
    donchianChannels(size = 20, offset = 0, options = {}) {

        const methodName = 'donchianChannels'

        isAlreadyComputed(this)

        
        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateNumber(offset, {min: 0, max: this.len, allowDecimals: false}, 'offset', methodName)
      
        validateObject(options, 'options', methodName)
        const { height = false, range = [], lag = 0, decimals = null} = options;
      
        validateArray(range, 'options.range', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(height, 'options.height', methodName)
        if(decimals !== null) validateNumber(decimals, {min: 1, max: 15, allowDecimals: false}, 'decimals', methodName)
      
        this.inputParams.push({ key: methodName, order: 0, params: [size, offset, { height, range, lag, decimals}] });
      
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

    scaler(type = 'zscore', size, options = {})
    {
        let methodName = 'scaler'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        
        validateObject(options, 'options', methodName)

        const {group = false, range = [0, 1], lag = 0,  colKeys = []} = options

        validateArray(colKeys, 'options.colKeys', methodName)
        validateBoolean(group, 'options.group', methodName)
        validateArrayOfRanges(range, 'options.range', methodName)
        validateArrayOptions(['minmax', 'zscore'], type, 'options.type', methodName)

        const groupKey = `${type}_${size}`
        const groupKeyLen = colKeys.length
        const precomputed = {groupKey, groupKeyLen}

        let secondaryLoop = false

        const order = getOrderFromArray(colKeys, methodName)

        if(order >= 10)
        {
            secondaryLoop = true
        }

        this.inputParams.push({key: methodName, order, params: [size, colKeys, {type, group, range, lag, precomputed, secondaryLoop}]})
        return this
    }

    classifier(trainingSize = 200, options = {})
    {
        isAlreadyComputed(this)

        const methodName = 'classifier'
        validateNumber(trainingSize, {max: this.len, allowDecimals: false}, 'trainingSize', methodName)
        validateObject(options, 'options', methodName)

        const {
            retrain = false,
            trainingCols = [], 
            type = 'KNN',
            lookback = 0,
            findGroups = [],
            predictions = 2,
            horizon = 2,
            modelArgs = undefined,
            filterCallback = () => true
        } = options

        if (modelArgs !== undefined && (typeof modelArgs !== 'object' || modelArgs === null || Array.isArray(modelArgs))) throw new TypeError(`"modelArgs" must be either undefined or a plain object in ${type}`);

        const yCallback = options.yCallback ?? defaultYCallback

        if(typeof yCallback !== 'function')
        {
            throw new Error(`"yCallback" must be a function in the following format:\n\n---\n\nconst yCallback = ${defaultYCallback.toString()}\n\n---\n\n`)
        }

        validateArrayOptions(Object.keys(validClassifiers), type, 'options.type', methodName)

        if (!this.ML.classes.hasOwnProperty(type)) {
            throw new Error(
                `"${type}" isn’t available because its library wasn’t imported into OHLCV_INDICATORS.ML.`
            )
        }

        validateBoolean(retrain, 'options.retrain', methodName)
        validateArray(trainingCols, 'options.trainingCols', methodName)
        validateNumber(horizon, {min: 1, max: this.len, allowDecimals: false}, 'options.horizon', methodName)
        validateNumber(lookback, {max: 0, allowDecimals: false}, 'options.lookback', methodName)
        validateNumber(predictions, {min: 1, allowDecimals: false}, 'options.predictions', methodName)

        const orderArr = [...trainingCols]

        if(validateArray(findGroups, 'options.findGroups', 'scaler') && findGroups.length > 0)
        {
            for (const { type = '', size, groupName = '' } of findGroups) {

                if (!type || (!size && !groupName) || (size && groupName)) {
                    throw new Error(`If "options.findGroups" array is set, each item must be an object that includes the "type" (mandatory) and either "size" or "groupName" (choose 1) used to locate previously scaled (minmax or zscore) groups.`);
                }

                orderArr.push(type.toString(), groupName.toString());
            }
        }  else {
            if(trainingCols.length === 0)
            {
                throw new Error(`"trainingCols" array is empty in ${methodName}`)
            }
        }

        const {shortName, flatY} = validClassifiers[type]

        const prefix = `cla_${shortName}_${trainingSize}_prediction`

        if(this.isAlreadyComputed.has(prefix))
        {
            throw new Error(
            `Each classifier must have a unique pair of “type” and trainingSize.\n` +
            `This rule ensures that your output columns are labeled unambiguously.\n` +
            `You provided a duplicate: type="${type}" with trainingSize=${trainingSize}.`
            );
        }

        const precompute = {
            lookbackAbs: Math.abs(lookback) + 1,
            flatY,
            prefix
        }
        
        this.isAlreadyComputed.add(prefix)

        const order = getOrderFromArray(orderArr, methodName)

        const modelConfig = validClassifiers[type]
        const modelClass =  this.ML.classes[type]

        this.inputParams.push({key: methodName, order, params: [trainingSize, {yCallback, predictions, lookback, retrain, trainingCols, findGroups, horizon, type,  modelArgs, precompute, filterCallback, modelConfig, modelClass}]})


        return this
    }

    regressor(trainingSize = 200, options = {})
    {
        isAlreadyComputed(this)

        const methodName = 'regressor'
        

        validateNumber(trainingSize, {max: this.len, allowDecimals: false}, 'trainingSize', methodName)
        validateObject(options, 'options', methodName)

        const {
            retrain = false,
            target = 'close', 
            predictions =  1, 
            trainingCols = [], 
            type = 'SimpleLinearRegression', 
            lookback = 0,
            findGroups = [],
            modelArgs = undefined,
            filterCallback = () => true
        } = options

        validateArrayOptions(Object.keys(validRegressors), type, 'type', methodName)

        if (!this.ML.classes.hasOwnProperty(type)) {
            throw new Error(
                `"${type}" isn’t available because its library wasn’t imported into OHLCV_INDICATORS.ML.`
            )
        }
        
        //regressor
        validateBoolean(retrain, 'options.retrain', methodName)
        validateString(target, 'options.target', methodName)
        validateNumber(predictions, {min: 1, allowDecimals: false}, 'predictions', methodName)
        validateNumber(lookback, {max: 0, allowDecimals: false}, 'lookback', methodName)
        validateArray(trainingCols, 'options.trainingCols', methodName)

        const {shortName, flatX, flatY} = validRegressors[type]
        const prefix = `reg_${shortName}_${trainingSize}_${target}_prediction`
        const orderArr = [...trainingCols]

        if(validateArray(findGroups, 'options.findGroups', 'scaler') && findGroups.length > 0)
        {
            for (const { type = '', size, groupName = '' } of findGroups) {

                if (!type || (!size && !groupName) || (size && groupName)) {
                    throw new Error(`If "options.findGroups" array is set, each item must be an object that includes the "type" (mandatory) and either "size" or "groupName" (choose 1) used to locate previously scaled (minmax or zscore) groups.`);
                }

                orderArr.push(type.toString(), groupName.toString());
            }

        }  else {
            if(trainingCols.length === 0 && flatX === false)
            {
                throw new Error(`"trainingCols" array is empty in ${methodName} ${type}`)
            }
        }

        if(flatX) {
            if(trainingCols.length > 0)
            {
                throw new Error(`If regressor type is ${type} then leave "options.trainingCols" array empty.`)
            }
            if(lookback > 0)
            {
                throw new Error(`If regressor type is ${type} then "options.lookback" must be 0.`)
            }
            if(findGroups.length > 0)
            {
                throw new Error(`If regressor type is ${type} then "options.findGroups" must be null.`)
            }
            else {                
                trainingCols.push(target)
            }
        }

        if(this.isAlreadyComputed.has(prefix))
        {
            throw new Error(
            `Each regressor must have a unique "type", "trainingSize" and "target".\n` +
            `This rule ensures that your output columns are labeled unambiguously.\n` +
            `You provided a duplicate: type="${type}", trainingSize=${trainingSize} target=${target}.`
            );
        }

        const precompute = {
            lookbackAbs: Math.abs(lookback) + 1,
            flatX,
            flatY,
            prefix
        }

        this.isAlreadyComputed.add(prefix)


        const order = getOrderFromArray(orderArr, methodName)

        const modelConfig = validRegressors[type]
        const modelClass =  this.ML.classes[type]

        this.inputParams.push({key: methodName, order, params: [trainingSize, {target, predictions, retrain, lookback, trainingCols, findGroups, type,  modelArgs, precompute, filterCallback, modelConfig, modelClass}]})

        return this
    }

    pca(suffix, trainingSize, options = {})
    {
        const methodName = 'pca'
        validateNumber(trainingSize, {min: 1, max: this.len}, 'trainingSize', methodName)
        validateString(suffix, 'suffix', methodName)
        validateObject(options, 'options', methodName)

        const {
            findGroups = [], 
            trainingCols = [], 
            lookback = 0,
            filterCallback = () => true
        } = options

        
        validateArray(trainingCols, 'options.trainigCols', methodName)
        validateNumber(lookback, {min: 0, max: this.len, allowDecimals: false}, 'options.lookback', methodName)
        if(typeof options.modelArgs !== 'undefined') {
            validateObject(options.modelArgs, 'options.modelArgs', methodName)
        } else {
            options.modelArgs = {}
        }

        //modelArgs

        const modelArgs = {
            showSource: false,
            storeModel: false,
            isCovarianceMatrix: false,
            method: 'NIPALS', //SVD, covarianceMatrix or NIPALS
            center: true,
            scale: false,
            nCompNIPALS: 5,
            ignoreZeroVariance: false,
            ...options.modelArgs
        }

        validateBoolean(modelArgs.showSource, 'options.modelArgs.showSource', methodName)
        validateBoolean(modelArgs.storeModel, 'options.modelArgs.storeModel', methodName)
        validateBoolean(modelArgs.isCovarianceMatrix, 'options.modelArgs.isCovarianceMatrix', methodName)
        validateBoolean(modelArgs.center, 'options.modelArgs.center', methodName)
        validateBoolean(modelArgs.scale, 'options.modelArgs.scale', methodName)
        validateBoolean(modelArgs.ignoreZeroVariance, 'options.modelArgs.ignoreZeroVariance', methodName)
        validateArrayOptions(['SVD', 'NIPALS', 'covarianceMatrix'], modelArgs.method, 'options.modelArgs.method', methodName)
        validateNumber(modelArgs.nCompNIPALS, {min: 1}, 'options.modelArgs.nCompNIPALS', methodName)




        const orderArr = []

        if(validateArray(findGroups, 'options.findGroups', 'pca') && findGroups.length > 0)
        {
            
            for (const { type = '', size, groupName = '' } of findGroups) {

                if (!type || (!size && !groupName) || (size && groupName)) {
                    throw new Error(`If "options.findGroups" array is set, each item must be an object that includes the "type" (mandatory) and either "size" or "groupName" (choose 1) used to locate previously scaled (minmax or zscore) groups.`);
                }

                orderArr.push(type.toString(), groupName.toString())
            }
        }

        const order = getOrderFromArray(orderArr, methodName)
        const prefix = `pca_${suffix}_${trainingSize}`

        if(this.isAlreadyComputed.has(prefix)) {
            throw new Error(
            `Each regressor must have a unique "suffix" param.\n` +
            `This rule ensures that your output columns are labeled unambiguously.\n` +
            `You provided a duplicate: type="${suffix}".`
            )
        }

        const lookbackAbs =  Math.abs(lookback) + 1
        this.isAlreadyComputed.add(prefix)

        this.inputParams.push({key: methodName, order, params: [{prefix, trainingSize, findGroups, trainingCols, lookbackAbs, modelArgs, filterCallback}]})

        return this
    }

    exportTrainedModels()
    {
        return exportTrainedModels(this)
    }

    mapCols(newCols = ['change'], callback = null, options = {}) {

        isAlreadyComputed(this)

        const methodName = 'mapCols'

        if(typeof callback === 'undefined' || callback === null)
        {
            callback = defaultMapColsCallback
        }

        validateObject(options, 'options', methodName)

        const {lag = 0} = options

        validateArray(newCols, 'newCols', methodName)
        validateNumber(lag, {min: 0, allowDecimals: false}, 'options.lag', methodName)
        const order = getOrderFromArray(newCols, methodName)

        this.inputParams.push({key: methodName, order, params: [newCols, callback, {lag}]})

        return this
    }
}