import { getFeaturedKeys, computeFlatFeaturesLen, logMlTraining, updateClassifierMetrics, findGroupsFunc } from "./ml-utilities.js"
import { buildTrainX } from "./trainX.js"
import { areKeyValuesValid } from "../core-functions/pushToMain.js"
import { countUniqueLabels, oversampleXY } from "./balancing.js"

const algo = 'classifier'

class Store {
  constructor(args = {}) {
    Object.entries(args).forEach(([k, v]) => { this[k] = v })
  }

  // internal helpers
  _unwrap = v => Array.isArray(v) ? v[0] : v
  _num = (v, def = 0) => {
    const n = Number(this._unwrap(v))
    return Number.isFinite(n) ? n : def
  }

  // set: supports value OR updater function
  // if you pass a function, we feed it the current *numeric* value
  set = (key, valueOrFn) => {
    if (typeof valueOrFn === 'function') {
      const next = valueOrFn(this._num(this[key], 0))
      this[key] = next               // <- change to [next] if you want to keep the array wrapper
      return next
    } else {
      this[key] = valueOrFn          // <- change to [valueOrFn] if you want to keep the array wrapper
      return valueOrFn
    }
  }

  // convenience numerics
  inc = (key, delta = 1) => this.set(key, v => v + delta)
  add = (key, delta = 0) => this.inc(key, delta) // alias
  getNum = (key, def = 0) => this._num(this[key], def)

  get = (key) => this._unwrap(this[key])
  getAll = () => {

    const output = {}
    
    for(const [key, valueOrFn] of Object.entries(this)) {
      if(typeof valueOrFn === 'function') continue
      output[key] = valueOrFn
    }


    return {...output}
  }  // shallow clone of data-only fields
}

export const classifier = (
  main,
  index,
  trainingSize,
  {
    yCallback,
    trainingCols,
    findGroups = [],
    retrain,
    type,
    modelArgs,
    horizon,
    precompute,
    predictions,
    filterCallback,
    modelConfig,
    modelClass
  }
) => {
  const { lookbackAbs, prefix, flatY } = precompute
  const { verticalOhlcv, len, instances, scaledGroups, invalidValueIndex, ML } = main
  const allModels = ML.models
  const startIndex = (invalidValueIndex + 1)
  
  // ─── INITIALIZATION ───────────────────────────────────────────────
  if(index === startIndex) {

    // prepare instance storage
    if (!instances.hasOwnProperty(algo)) instances[algo] = {}
    if(!instances[algo].hasOwnProperty(prefix)) instances[algo][prefix] = {}

    const expectedLoops = (flatY) ? predictions : 1 //

    instances[algo][prefix] = {
      store: new Store({
        strategy: null,
        total: 0,
        win: 0,
        loss: 0,
        strategyGainLoss: 0,
        idx: 0,
        initialBalance: verticalOhlcv.close[index]
      }),
      expectedLoops,
      isTrained: new Array(expectedLoops).fill(false),
      uniqueLabels: new Array(expectedLoops).fill(0),
      shouldRetrain: retrain,
      featureCols: [],
      flatFeaturesColLen: 0,
      X: [],
      Y: Array.from({ length: expectedLoops }, () => []),
    }

    for (let i = 0; i < predictions; i++) {
      const predictionKey = `${prefix}_${i + 1}`

      verticalOhlcv[predictionKey] = (type === 'KNN') ? new Array(len).fill(null) : new Float32Array(len).fill(NaN)
      ML.metrics[predictionKey] = {accuracy: {}, total: 0, correct: 0, labels: {}}

      if(!allModels.hasOwnProperty(predictionKey))
      {
        allModels[predictionKey] = []
      }
    }
  } 
  else if(index < startIndex || index < lookbackAbs)
  {
    return
  }
  else if(filterCallback(verticalOhlcv, index, instances[algo][prefix].store) === false)
  {
      return
  }
  else if(index + 1 === len) 
  {

      if(instances[algo][prefix].featureCols.length === 0)
      {
        const inputFeatures = [...trainingCols, ...(findGroupsFunc(findGroups, scaledGroups))]

        throw new Error(`Some of the provided features in ${algo} "${prefix}" features where not found in "verticalOhlcv": ${JSON.stringify(inputFeatures)}`)
      }

      //last execution
      for(const featureKey of instances[algo][prefix].featureCols)
      {
          if(!verticalOhlcv.hasOwnProperty(featureKey)) throw new Error(`Feature "${featureKey}" not found in verticalOhlcv for ${prefix}.`)
      }

      if(instances[algo][prefix].X.length < trainingSize)
      {
        const requiredDatapoints = instances[algo][prefix].X.length - trainingSize
        throw new Error(`The current "trainingSize" at ${algo} "${prefix}" requires at least ${requiredDatapoints} more datapoints. Try adding more input ohlcv rows or reducing the "trainingSize" by ${requiredDatapoints}.`)
      }

  }

  const dataSetInstance = instances[algo][prefix]

  if(dataSetInstance.flatFeaturesColLen === 0)
  {
    dataSetInstance.featureCols = getFeaturedKeys({trainingCols, findGroups, verticalOhlcv, scaledGroups})

    if(areKeyValuesValid(main, index, dataSetInstance.featureCols))
    {
      dataSetInstance.flatFeaturesColLen = computeFlatFeaturesLen(dataSetInstance.featureCols, verticalOhlcv, index)

      logMlTraining({
        featureCols: dataSetInstance.featureCols, 
        flatFeaturesColLen: dataSetInstance.flatFeaturesColLen, 
        type, 
        trainingSize
      })
    } else {
      return
    }
  }

  if(dataSetInstance.flatFeaturesColLen === 0) return

  const {
    uniqueLabels,
    expectedLoops,
    featureCols,
    flatFeaturesColLen,
    shouldRetrain,
    X: xRows
  } = dataSetInstance

  const trainX = buildTrainX({
    featureCols,
    flatFeaturesColLen,
    type,
    index,
    lookbackAbs,
    main
  })

  if(!trainX) return 

   //if univariable Y (flatY) a model is created for each prediction
  const trainY = yCallback(index, verticalOhlcv, horizon, instances[algo][prefix].store)

  if (trainY !== null && (!Array.isArray(trainY) || trainY.length !== predictions)) {

    throw new Error(`trainY must be null or an array with ${predictions} items, got "${JSON.stringify(trainY)}" at index ${index} for ${type}`);
  }

  for(let loopIdx = 0; loopIdx < expectedLoops; loopIdx++)
  {
    const predictionKey = `${prefix}_${(loopIdx+1)}`
    const yRows = dataSetInstance.Y[loopIdx]
    const currTrainY =  (flatY) ? (trainY === null) ? null : trainY[loopIdx] : trainY
    const isTrained = dataSetInstance.isTrained[loopIdx]

    const shouldPredict = allModels.hasOwnProperty(predictionKey) && isTrained && (shouldRetrain === false || allModels[predictionKey].length === horizon)

    //predicts using previously saved models even if current currTrainY is not available
    if(shouldPredict)
    {
      const futureRow = allModels[predictionKey][0].predict([trainX])[0]

      if(flatY)
      {
        if(futureRow == null) throw new Error(`Prediction of ${prefix} at index ${index} was expecting a number.`)

        main.pushToMain({index, key: predictionKey, value: futureRow})

        if(currTrainY != null)
        {
          updateClassifierMetrics({
            metrics: ML.metrics[predictionKey], 
            trueLabel: currTrainY, 
            predictedLabel: futureRow
          })
        }
      }
      else {

        if (!Array.isArray(futureRow) || futureRow.length !== predictions) {
          throw new Error(
            `Prediction output of ${algo} "${prefix}" at index ${index} was expecting an array of values.`
          )
        }

        for(let preIdx = 0; preIdx < predictions; preIdx++) {
          main.pushToMain({index, key: `${prefix}_${(preIdx+1)}`, value: futureRow[preIdx]})

          if(Array.isArray(currTrainY) && currTrainY.length === predictions)
          {
            updateClassifierMetrics({
              metrics: ML.metrics[`${prefix}_${(preIdx+1)}`], 
              trueLabel: currTrainY[preIdx], 
              predictedLabel: futureRow[preIdx]
            })
          }

        }
      }
    }

    if((index + predictions + 1) > len) continue 
    if(currTrainY === null) continue // future not defined

    if(flatY)
    {
        if (typeof currTrainY === 'undefined' || currTrainY == null)
        {
            throw new Error(`currTrainY must return number, string or boolean got ${typeof currTrainY} at index ${index}`)
        }
    } else {

        if ((currTrainY.length !== predictions)) {

          throw new Error(
            `The number of label columns returned (${currTrainY.length}) doesn’t match the options.predictions (${predictions}) setting for the ${algo} "${prefix}" classifier. ` +
            `Please update your yCallback function so its output array items align with options.predictions.`
          );

        }           
    }

    // enqueue
    
    yRows.push(currTrainY)
    if (yRows.length > trainingSize) yRows.shift()

    if(loopIdx === 0)
    {
      xRows.push(trainX)
      if (xRows.length > trainingSize) xRows.shift()
    }

    const shouldTrainModel = shouldRetrain || !isTrained

    if (shouldTrainModel && xRows.length === trainingSize && yRows.length === trainingSize) {

      if(isTrained === false)
      {
        uniqueLabels[loopIdx] = countUniqueLabels(yRows)
        
        if(uniqueLabels[loopIdx] < 2)
        {
          throw new Error(`Invalid number or labels in ${prefix}. Check the logic of your "yCallback" function.`)
        }
      }


      const {train} = modelConfig

      const {X: overX, Y: overY} = oversampleXY(xRows, yRows)      

      const trainedModel = train({modelClass, xRows: overX, yRows: overY, modelArgs, uniqueLabels: uniqueLabels[loopIdx]})

      allModels[predictionKey].push(
       trainedModel
      )

      if(allModels[predictionKey].length > horizon)
      {
        allModels[predictionKey].shift()
      }

      dataSetInstance.isTrained[loopIdx] = true
    }
  }

  return true
}
