import { getFeaturedKeys, computeFlatFeaturesLen, countUniqueLabels, logMlTraining } from "./ml-utilities.js"
import { buildTrainX } from "./trainX.js"
import { modelTrain } from "./train-utilities.js"



export const classifier = (
  main,
  index,
  trainingSplit,
  {
    yCallback,
    trainingCols,
    findGroups = [],
    retrain,
    type,
    modelArgs,
    precompute,
    predictions
  }
) => {
  const { lookbackAbs, prefix, useTrainMethod, flatY } = precompute
  const { verticalOhlcv, len, instances, scaledGroups, invalidValueIndex, ML } = main
  const allModels = ML.models
  
  // ─── INITIALIZATION ───────────────────────────────────────────────
  if((index + 1) === (invalidValueIndex + 1)) {
    // build featureCols
    const featureCols = getFeaturedKeys({trainingCols, findGroups, verticalOhlcv, scaledGroups, type})

    // prepare instance storage
    if (!instances.hasOwnProperty('classifier')) instances.classifier = {}
    if(!instances.classifier.hasOwnProperty(prefix)) instances.classifier[prefix] = {}

    // compute flattened feature‐length (expanding one-hots)
    const flatFeaturesColLen = computeFlatFeaturesLen(featureCols, instances, type)

    const usable = (len - invalidValueIndex) - predictions
    const trainingSize = Math.floor(usable * trainingSplit)

    const expectedLoops = (flatY) ? predictions : 1 //

    instances.classifier[prefix] = {

      expectedLoops,
      isTrained: new Array(expectedLoops).fill(false),
      uniqueLabels: new Array(expectedLoops).fill(0),
      trainingSize,
      retrainOnEveryIndex: retrain,
      featureCols,
      flatFeaturesColLen,
      X: [],
      Y: Array.from({ length: expectedLoops }, () => []),
    }

    // create NaN‐filled output arrays
    for (let i = 0; i < predictions; i++) {
      const outKey = `${prefix}_${i + 1}`
      verticalOhlcv[outKey] = new Float64Array(len).fill(NaN)
    }

    logMlTraining({featureCols, flatFeaturesColLen, type, trainingSize})
  }

  // ─── EARLY EXIT IF NOT ENOUGH HISTORY ─────────────────────────────
  if (index < lookbackAbs) return

  const dataSetInstance = instances.classifier[prefix]

  const {
    uniqueLabels,
    expectedLoops,
    trainingSize,
    featureCols,
    flatFeaturesColLen,
    retrainOnEveryIndex,
    X: xRows
  } = dataSetInstance

  const trainX = buildTrainX({
    featureCols,
    instances,
    flatFeaturesColLen,
    type,
    index,
    lookbackAbs,
    verticalOhlcv
  })

  if(!trainX) return 

   //if univariable Y (flatY) a model is created for each prediction
  const trainY = yCallback(index, verticalOhlcv)

  if (trainY !== null && (!Array.isArray(trainY) || trainY.length !== predictions)) {

    throw new Error(`trainY must be null or an array with ${predictions} items, got "${JSON.stringify(trainY)}" at index ${index} for ${type}`);
  }

  for(let loopIdx = 0; loopIdx < expectedLoops; loopIdx++)
  {
    const modelKey = `${prefix}_${(loopIdx+1)}`
    const yRows = dataSetInstance.Y[loopIdx]
    const currTrainY =  (flatY) ? (trainY === null) ? null : trainY[loopIdx] : trainY
    const isTrained = dataSetInstance.isTrained[loopIdx]

    //predicts using previously saved models even if current currTrainY is not available
    if(allModels.hasOwnProperty(modelKey))
    {
      const futureRow = allModels[modelKey].predict([trainX])[0]

      if(flatY)
      {
        if(Number.isNaN(futureRow)) throw new Error(`Prediction of ${type} at index ${index} was expecting a number.`)

        main.pushToMain({index, key: modelKey, value: futureRow})
      }
      else {

        if (!Array.isArray(futureRow) || futureRow.length !== predictions) {
          throw new Error(
            `Prediction output of "${type}" at index ${index} was expecting an array of values.`
          )
        }

        for(let preIdx = 0; preIdx < predictions; preIdx++) {
          main.pushToMain({index, key: `${prefix}_${(preIdx+1)}`, value: futureRow[preIdx]})
        }
      }
    }

    if((index + predictions + 1) > len) continue 
    if(currTrainY === null) continue // future not defined

    if(flatY)
    {
        if (typeof currTrainY !== 'number' || Number.isNaN(currTrainY))
        {
            throw new Error(`currTrainY must return number, got ${typeof currTrainY} at index ${index}`)
        }
    } else {

        if ((currTrainY.length !== predictions)) {

          throw new Error(
            `The number of label columns returned (${currTrainY.length}) doesn’t match the options.predictions (${predictions}) setting for the "${type}" classifier. ` +
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

    const shouldTrainModel = retrainOnEveryIndex || !isTrained

    if (shouldTrainModel && xRows.length === trainingSize && yRows.length === trainingSize) {

      if(isTrained === false)
      {
        uniqueLabels[loopIdx] = countUniqueLabels(yRows)

        if(uniqueLabels[loopIdx] < 2)
        {
          throw new Error(`Invalid number or labels in ${type}. Check the logic of your "yCallback" function.`)
        }
      }

      allModels[modelKey] = modelTrain({main, type, xRows, yRows, useTrainMethod, modelArgs, algo: 'classifier', uniqueLabels: uniqueLabels[loopIdx]})
      dataSetInstance.isTrained[loopIdx] = true
    }
  }
}
