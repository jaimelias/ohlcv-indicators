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
import { calcPrecisionMultiplier } from './src/utilities/precisionMultiplier.js'
import { buildArray } from './src/utilities/assignTypes.js'
import { dateOutputFormaters } from './src/utilities/dateUtilities.js'

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
    constructor({input, ticker = null, precision = true, inputParams = null, chunkProcess = 2000, ML = {}}) {

        validateArray(input, 'input', (ticker !== null) ? `contructor ${ticker}` : 'constuctor')
        if(input.length === 0) throw Error('input OHLCV must not be empty: ' + ticker)

        validateBoolean(precision, 'precision', 'constructor')
        validateNumber(chunkProcess, {min: 100, max: 50000, allowDecimals: false}, 'chunkProcess', 'constructor')
        validateObject(ML, 'ML', 'constructor')

        this.notNumberKeys = new Set()
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
        this.isAlreadyComputed = new Set()

        const {classes: mlClasses} = ML

        if(typeof mlClasses !== 'undefined') validateObject(mlClasses, 'ML.classes', 'constructor')

        this.ML = {
            models: {},
            classes: mlClasses
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
          precisionMultiplier,
          precision,
          invalidValueIndex,
          len,
          verticalOhlcv,
          arrayTypes,
          verticalOhlcvTempCols,
          notNumberKeys
        } = this
        const result = {}
        const startIndex = skipNull ? invalidValueIndex + 1 : 0
        const newLen = len - startIndex
      
        for (const [key, arr] of Object.entries(verticalOhlcv)) {

            if(verticalOhlcvTempCols.has(key)) continue

            const shouldApplyPrecision = precision && !notNumberKeys.has(key)
            result[key] = buildArray(arrayTypes[key], newLen)

            for (let x = startIndex; x < len; x++)
            {
                if(shouldApplyPrecision)
                {
                    result[key][x] = arr[x] / precisionMultiplier 
                }
                else if(key === 'date')
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
          mainLoop(this.input, this);
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

        const {oneHot = false} = options

        if(typeof oneHot !== 'boolean' && typeof oneHot !== 'number')
        {
            throw new Error(`"options.oneHot" must be a boolean or an integer with exact number of one-hot cols.`)
        }

        const oneHotCols = (typeof oneHot === 'number' && Number.isNaN(oneHot) === false && Number.isInteger(oneHot)) ? oneHot : null

        for (const [i, pair] of arr.entries()) {
            const { fast, slow } = pair || {};
            if (fast == null || slow == null) {
                throw new Error(
                    `Invalid crossPairs[${i}]: Object property “fast” must be a non-null column name and “slow” must be a non-null column name or integer.`
                );
            }
        }

        this.crossPairsList = [...this.crossPairsList, ...arr]

        if(this.crossPairsList.some(({fast, slow}) => 
            
            `${fast}`.includes('_prediction_') || `${slow}`.includes('_prediction_')
            `${fast}`.includes('_zscore_') || `${slow}`.includes('_zscore_')
            `${fast}`.includes('_minmax_') || `${slow}`.includes('_minmax_')
            `${fast}`.includes('_x_') || `${slow}`.includes('_x_')))
        {
            throw new Error(`"${methodName}" can not be used with the the following strings: ${JSON.stringify(invalidKeyStrings)}`)
        }

        const prefix = (oneHot) ? 'one_hot_' : ''

        if(this.isAlreadyComputed.has(methodName))
        {
            throw new Error(`You can only call the "${methodName}" method once.`)
        }

        this.isAlreadyComputed.add(methodName)

        this.inputParams.push({key: methodName, params: [this.crossPairsList, {oneHot, oneHotCols, prefix}]})
        
        return this
    }


    lag(colKeys = ['close'], lookback = 1) {

        let methodName = 'lag'

        isAlreadyComputed(this)

        validateArray(colKeys, 'colKeys', methodName)
        validateNumber(lookback, {min:1, max: this.len, allowDecimals: false}, 'lookback', methodName)

        let secondaryLoop = false

        if(colKeys.some(v => v.includes('_prediction_')))
        {
            methodName += 'Secondary'
            secondaryLoop = true
        }

        this.inputParams.push({key: methodName, params: [colKeys, lookback, {secondaryLoop}]})
        
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

        this.inputParams.push({key: methodName, params: [size, {lag, percentage, upper, lower}]})

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

        const {target = 'close', height = false, range = [],  lag = 0, decimals = null} = options

        validateString(target, 'options.target', methodName)
        validateArray(range, 'options.range', methodName)
        validateNumber(lag, {min: 0, max: this.len, allowDecimals: false}, 'options.lag', methodName)
        validateBoolean(height, 'options.height', methodName)
        if(decimals !== null) validateNumber(decimals, {min: 1, max: 15, allowDecimals: false}, 'decimals', methodName)
    
        this.inputParams.push({key: methodName, params: [size, stdDev, {target, height, range, lag, decimals}]});
    
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

        let parseRsi = v => v
        let prefix = ''

        if(minmax !== null)
        {
            if(Array.isArray(minmax)){
                validateArrayOfRanges(minmax, 'options.minmax', methodName)
                parseRsi = value => (minmax !== null) ? normalizeMinMax(value, 0, 100, minmax) : value
            } else
            {
                validateBoolean(minmax, 'options.minmax', methodName)
                minmax = [0, 1]
                parseRsi = value => (minmax !== null) ? normalizeMinMax(value, 0, 100, minmax) : value
            }
            prefix = 'minmax_'
        }

        this.inputParams.push({key: methodName, params: [size, {target, lag, parseRsi, prefix, minmax}]})

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
      
        this.inputParams.push({ key: methodName, params: [size, offset, { height, range, lag, decimals}] });
      
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

        this.inputParams.push({key: methodName, params: [fastsize, slowsize, {lag}]})
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

        this.inputParams.push({key: methodName, params: [{lag, oneHot, precompute}]})
        return this           
    }

    scaler(size, colKeys = [], options = {})
    {
        let methodName = 'scaler'

        isAlreadyComputed(this)

        validateNumber(size, {min: 1, max: this.len, allowDecimals: false}, 'size', methodName)
        validateArray(colKeys, 'colKeys', methodName)
        validateObject(options, 'options', methodName)

        const {group = false, range = [0, 1], lag = 0, type = 'zscore', decimals = null, pca = null} = options

        validateBoolean(group, 'options.group', methodName)
        if(pca !== null) validateObject(pca, 'options.pca', methodName)
        validateArrayOfRanges(range, 'options.range', methodName)
        validateArrayOptions(['minmax', 'zscore'], type, 'options.type', methodName)

        if(decimals !== null) validateNumber(decimals, {min: 1, max: 15, allowDecimals: false}, 'decimals', methodName)

        const groupKey = (group) ? `${type}_${size}` : ''
        const groupKeyLen = colKeys.length
        const precomputed = {groupKey, groupKeyLen}

        let secondaryLoop = false

        if(colKeys.some(v => v.includes('_prediction_')))
        {
            methodName += 'Secondary'
            secondaryLoop = true
        }

        this.inputParams.push({key: methodName, params: [size, colKeys, {type, group, range, lag, precomputed, decimals, pca, secondaryLoop}]})
        return this
    }

    classifier(trainingSplit = 0.8, options = {})
    {
        isAlreadyComputed(this)

        const methodName = 'classifier'

        validateNumber(trainingSplit, {min: 0.001, max: 0.999, allowDecimals: true}, 'trainingSplit', methodName)
        validateObject(options, 'options', methodName)

        const {
            retrain = false,
            trainingCols = [], 
            type = 'KNN',
            lookback = 0,
            findGroups = [],
            predictions = 2,
            modelArgs = undefined
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
        validateNumber(lookback, {max: 0, allowDecimals: false}, 'lookback', methodName)
        validateNumber(predictions, {min: 1, allowDecimals: false}, 'options.predictions', methodName)

        if(validateArray(findGroups, 'options.findGroups', 'scaler') && findGroups.length > 0)
        {
            if(findGroups.some(o => !o.hasOwnProperty('size') || !o.hasOwnProperty('type'))) throw new Error(`If "options.findGroups" array is set, each item must be an object that includes the "size" and "type" properties used to locate previously scaled (minmax or zscore) groups.`)
        }  else {
            if(trainingCols.length === 0)
            {
                throw new Error(`"trainingCols" array is empty in ${methodName}`)
            }
        }

        const {shortName, flatY, useTrainMethod} = validClassifiers[type]

        const prefix = `cla_${shortName}_${trainingSplit}_prediction`

        if(this.isAlreadyComputed.has(prefix))
        {
            throw new Error(
            `Each classifier must have a unique pair of “type” and trainingSplit.\n` +
            `This rule ensures that your output columns are labeled unambiguously.\n` +
            `You provided a duplicate: type="${type}" with trainingSplit=${trainingSplit}.`
            );
        }

        const precompute = {
            lookbackAbs: Math.abs(lookback) + 1,
            flatY,
            prefix,
            useTrainMethod
        }
        
        this.isAlreadyComputed.add(prefix)

        this.inputParams.push({key: methodName, params: [trainingSplit, {yCallback, predictions, lookback, retrain, trainingCols, findGroups, type,  modelArgs, precompute}]})


        return this
    }

    regressor(trainingSplit = 0.80, options = {})
    {
        isAlreadyComputed(this)

        const methodName = 'regressor'
        

        validateNumber(trainingSplit, {min: 0.001, max: 0.999, allowDecimals: true}, 'trainingSplit', methodName)
        validateObject(options, 'options', methodName)

        const {
            retrain = false,
            target = 'close', 
            predictions =  1, 
            trainingCols = [], 
            type = 'SimpleLinearRegression', 
            lookback = 0,
            findGroups = [],
            modelArgs = undefined
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
        validateArray(findGroups, 'options.findGroups', methodName)

        const {shortName, flatX, flatY, useTrainMethod} = validRegressors[type]
        const prefix = `reg_${shortName}_${trainingSplit}_${target}_prediction`

        if(findGroups.length > 0)
        {
            if(findGroups.some(o => !o.hasOwnProperty('size') || !o.hasOwnProperty('type'))) throw new Error(`If "options.findGroups" array is set, each item must be an object that includes the "size" and "type" properties used to locate previously scaled (minmax or zscore) groups.`)
        } else
        {
            if(trainingCols.length === 0 && flatX === false)
            {
                throw new Error(`"trainingCols" array is empty in ${methodName}`)
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
            `Each regressor must have a unique "type", "trainingSplit" and "target".\n` +
            `This rule ensures that your output columns are labeled unambiguously.\n` +
            `You provided a duplicate: type="${type}", trainingSplit=${trainingSplit} target=${target}.`
            );
        }

        const precompute = {
            lookbackAbs: Math.abs(lookback) + 1,
            flatX,
            flatY,
            prefix,
            useTrainMethod
        }

        this.isAlreadyComputed.add(prefix)

        this.inputParams.push({key: methodName, params: [trainingSplit, {target, predictions, retrain, lookback, trainingCols, findGroups, type,  modelArgs, precompute}]})

        return this
    }

    exportTrainedModels()
    {
        return exportTrainedModels(this)
    }
}