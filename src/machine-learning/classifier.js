import { getFeaturedKeys, computeFlatFeaturesLen, countUniqueLabels, logMlTraining } from "./ml-utilities.js"
import { buildTrainX } from "./trainX.js"

export const validClassifiers = {
    'KNN': 'knn',
    'FeedForwardNeuralNetworks': 'feed_forward',
    'GaussianNB': 'naive-bayes',
    'MultinomialNB': 'naive-bayes',
}

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
    classifierArgs,
    precompute,
    predictions
  }
) => {
  const { lookbackAbs, prefix, useTrainMethod, flatY } = precompute
  const { verticalOhlcv, len, instances, scaledGroups, invalidValueIndex } = main
  const mlClass = main.ML.classes[type]
  const allModels = main.models

  // ─── INITIALIZATION ───────────────────────────────────────────────
  if((index + 1) === (invalidValueIndex + 1)) {
    // build featureCols
    const featureCols = getFeaturedKeys({trainingCols, findGroups, verticalOhlcv, scaledGroups, type})

    // prepare instance storage
    if (!instances.hasOwnProperty('classifier')) instances.classifier = {}
    if(!instances.classifier.hasOwnProperty(prefix)) instances.classifier[prefix] = {}

    // compute flattened feature‐length (expanding one-hots)
    const flatFeaturesColLen = computeFlatFeaturesLen(featureCols, instances, type)

    const trainingSize = Math.floor((len - invalidValueIndex) * trainingSplit)

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

  const dataSetInstance = instances.classifier[prefix]

  const {
    expectedLoops,
    trainingSize,
    featureCols,
    flatFeaturesColLen,
    retrainOnEveryIndex,
    X: Xrows
  } = dataSetInstance


  // ─── EARLY EXIT IF NOT ENOUGH HISTORY ─────────────────────────────
  if (index < lookbackAbs) return

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

  // ─── BUILD TRAINING Y VIA CALLBACK ─────────────────────────────────
  const trainY = yCallback(index, verticalOhlcv)

  for(let loopIdx = 0; loopIdx < expectedLoops; loopIdx++)
  {
    const modelKey = `${prefix}_${(loopIdx+1)}`
    const Yrows = dataSetInstance.Y[loopIdx]
    const currTrainY =  (flatY) ? (trainY === null) ? null : [trainY[loopIdx]] : trainY
    const isTrained = dataSetInstance.isTrained[loopIdx]

    //train using previously saved models even if current currTrainY is null
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
          main.pushToMain({index, key: `${prefix}_${(preIdx+1)}`, value: futureRow[loopIdx]})
        }
      }
    }

    if (currTrainY == null) continue // future not defined

    if (!Array.isArray(currTrainY)) {
      throw new Error(
        `yCallback must return an array, got ${typeof currTrainY} at index ${index}`
      )
    }

    if ((currTrainY.length !== predictions && flatY === false) || (currTrainY.length !== 1 && flatY === true)) {

      throw new Error(
        `yCallback length (${currTrainY.length}) ≠ "options.predictions" (${predictions}) for classifier "${type}"`
      )
    }

    // enqueue
    Xrows.push(trainX)
    Yrows.push(currTrainY)

    if (Xrows.length > trainingSize) Xrows.shift()
    if (Yrows.length > trainingSize) Yrows.shift()

    const shouldTrainModel = retrainOnEveryIndex || retrainOnEveryIndex === false && isTrained === false

    if (shouldTrainModel && Xrows.length === trainingSize && Yrows.length === trainingSize) {

      let model

      if(isTrained === false)
      {
        dataSetInstance.uniqueLabels = countUniqueLabels(Yrows)
      }

      if (useTrainMethod) {
        model = new mlClass()
        model.train(Xrows, Yrows)

      } else {

        if(type === 'KNN')
        {
          classifierArgs = {
            ...classifierArgs, 
            k: dataSetInstance.uniqueLabels
          }
        }

        model = new mlClass(Xrows, Yrows)
      }

      allModels[modelKey] = model
      dataSetInstance.isTrained[loopIdx] = true
    }
  }
}
