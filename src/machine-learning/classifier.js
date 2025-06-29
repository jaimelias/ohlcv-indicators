import { getFeaturedKeys, computeFlatFeaturesLen, countUniqueLabels, logMlTraining, updateClassifierMetrics, findGroupsFunc } from "./ml-utilities.js"
import { buildTrainX } from "./trainX.js"
import { modelTrain } from "./train-utilities.js"
import { areKeyValuesValid } from "../core-functions/pushToMain.js"


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
    precompute,
    predictions
  }
) => {
  const { lookbackAbs, prefix, useTrainMethod, flatY } = precompute
  const { verticalOhlcv, len, instances, scaledGroups, invalidValueIndex, ML } = main
  const allModels = ML.models
  const startIndex = (invalidValueIndex + 1)
  
  // ─── INITIALIZATION ───────────────────────────────────────────────
  if(index === startIndex) {

    // prepare instance storage
    if (!instances.hasOwnProperty('classifier')) instances.classifier = {}
    if(!instances.classifier.hasOwnProperty(prefix)) instances.classifier[prefix] = {}

    const expectedLoops = (flatY) ? predictions : 1 //

    instances.classifier[prefix] = {

      expectedLoops,
      isTrained: new Array(expectedLoops).fill(false),
      uniqueLabels: new Array(expectedLoops).fill(0),
      retrainOnEveryIndex: retrain,
      featureCols: [],
      flatFeaturesColLen: 0,
      X: [],
      Y: Array.from({ length: expectedLoops }, () => []),
    }
  } 
  else if(index < startIndex || index < lookbackAbs)
  {
    return
  }
  else if(index + 1 === len) 
  {

      if(instances.classifier[prefix].featureCols.length === 0)
      {
        const inputFeatures = [...trainingCols, ...(findGroupsFunc(findGroups, scaledGroups))]

        throw new Error(`Some of the provided ${type} features where not found in "verticalOhlcv": ${JSON.stringify(inputFeatures)}`)
      }

      //last execution
      for(const featureKey of instances.classifier[prefix].featureCols)
      {
          if(!verticalOhlcv.hasOwnProperty(featureKey)) throw new Error(`Feature "${featureKey}" not found in verticalOhlcv for classifier ${type}.`)
      }
  }

  const dataSetInstance = instances.classifier[prefix]

  if(dataSetInstance.flatFeaturesColLen === 0)
  {
    dataSetInstance.featureCols = getFeaturedKeys({trainingCols, findGroups, verticalOhlcv, scaledGroups})

    if(areKeyValuesValid(main, index, dataSetInstance.featureCols))
    {
      dataSetInstance.flatFeaturesColLen = computeFlatFeaturesLen(dataSetInstance.featureCols, instances, type, verticalOhlcv, index)

      // create NaN‐filled output arrays
      for (let i = 0; i < predictions; i++) {
        const predictionKey = `${prefix}_${i + 1}`
        verticalOhlcv[predictionKey] = (type === 'KNN') ? new Array(len).fill(null) : new Float32Array(len).fill(NaN)
        ML.metrics[predictionKey] = {accuracy: {}, total: 0, correct: 0, labels: {}}
        ML.featureCols[predictionKey] = dataSetInstance.featureCols
      }

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
    retrainOnEveryIndex,
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
  const trainY = yCallback(index, verticalOhlcv)

  if (trainY !== null && (!Array.isArray(trainY) || trainY.length !== predictions)) {

    throw new Error(`trainY must be null or an array with ${predictions} items, got "${JSON.stringify(trainY)}" at index ${index} for ${type}`);
  }

  for(let loopIdx = 0; loopIdx < expectedLoops; loopIdx++)
  {
    const predictionKey = `${prefix}_${(loopIdx+1)}`
    const yRows = dataSetInstance.Y[loopIdx]
    const currTrainY =  (flatY) ? (trainY === null) ? null : trainY[loopIdx] : trainY
    const isTrained = dataSetInstance.isTrained[loopIdx]

    //predicts using previously saved models even if current currTrainY is not available
    if(allModels.hasOwnProperty(predictionKey))
    {
      const futureRow = allModels[predictionKey].predict([trainX])[0]

      if(flatY)
      {
        if(futureRow == null) throw new Error(`Prediction of ${type} at index ${index} was expecting a number.`)

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
            `Prediction output of "${type}" at index ${index} was expecting an array of values.`
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

      allModels[predictionKey] = modelTrain({main, type, xRows, yRows, useTrainMethod, modelArgs, algo: 'classifier', uniqueLabels: uniqueLabels[loopIdx]})
      dataSetInstance.isTrained[loopIdx] = true
    }
  }
}
