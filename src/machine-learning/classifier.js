import { getFeaturedKeys, computeFlatFeaturesLen, countKnnLabels } from "./ml-utilities.js"
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
  const { lookbackAbs, prefix, useTrainMethod } = precompute
  const { verticalOhlcv, len, instances, scaledGroups, invalidValueIndex } = main
  const mlClass = main.ML.classes[type]
  const allModels = main.models

  // ─── INITIALIZATION ───────────────────────────────────────────────
  if (index === 0) {
    // build featureCols
    const featureCols = getFeaturedKeys({trainingCols, findGroups, verticalOhlcv, scaledGroups, type})

    // prepare instance storage
    if (!instances.hasOwnProperty('classifier')) instances.classifier = {}
    if(!instances.classifier.hasOwnProperty(prefix)) instances.classifier[prefix] = {}

    // compute flattened feature‐length (expanding one-hots)
    const flatFeaturesColLen = computeFlatFeaturesLen(featureCols, instances, type)

    instances.classifier[prefix] = {
      trainingSize: Math.floor((len - invalidValueIndex) * trainingSplit),
      isTrained: false,
      retrainOnEveryIndex: retrain,
      featureCols,
      flatFeaturesColLen,
      X: [],
      Y: [],
    }

    // create NaN‐filled output arrays
    for (let i = 0; i < predictions; i++) {
      const outKey = `${prefix}_${i + 1}`
      verticalOhlcv[outKey] = new Float64Array(len).fill(NaN)
    }

    console.log(
      `---\n\nInitialized classifier "${type}" with ${flatFeaturesColLen} features: \n${JSON.stringify(featureCols)}\n\n---`
    )
  }

  const {
    trainingSize,
    featureCols,
    flatFeaturesColLen,
    X: Xrows,
    Y: Yrows,
    isTrained,
    retrainOnEveryIndex
  } = instances.classifier[prefix]

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

  // ─── PREDICT WITH EXISTING MODEL ───────────────────────────────────
  if (allModels.hasOwnProperty(prefix)) {
    const model = allModels[prefix]

    const futureRow = model.predict([trainX])[0]   

    if (!Array.isArray(futureRow) || futureRow.length < predictions) {
      throw new Error(
        `Model.predict returned invalid output for classifier "${type}" at index ${index}`
      );
    }

    for (let i = 0; i < futureRow.length; i++) {
      const val = futureRow[i];
      main.pushToMain({index, key: `${prefix}_${i + 1}`, value: val});
    }
  }


  // ─── BUILD TRAINING Y VIA CALLBACK ─────────────────────────────────
  const trainY = yCallback(index, verticalOhlcv)

  if (trainY == null) return // future not defined

  if (!Array.isArray(trainY)) {
    throw new Error(
      `yCallback must return an array, got ${typeof trainY} at index ${index}`
    )
  }
   if (trainY.length !== predictions) {
    throw new Error(
      `yCallback length (${trainY.length}) ≠ predictions (${predictions}) for classifier "${type}"`
    )
  }

  // enqueue
  Xrows.push(trainX)
  Yrows.push(trainY)
  
  if (Xrows.length > trainingSize) Xrows.shift()
  if (Yrows.length > trainingSize) Yrows.shift()

  const shouldTrainModel = retrainOnEveryIndex || retrainOnEveryIndex === false && isTrained === false

  // ─── TRAIN WHEN READY ───────────────────────────────────────────────
  if (shouldTrainModel && Xrows.length === trainingSize && Yrows.length === trainingSize) {
    let model
    if (useTrainMethod) {
      model = new mlClass(classifierArgs)
      
      model.train(Xrows, Yrows)

    } else {


      if(type === 'KNN')
      {
        if(isTrained === false)
        {
          instances.classifier[prefix].numberOfKnnLabels = countKnnLabels(Yrows)
        }
        
        classifierArgs = {
          ...classifierArgs, 
          k: instances.classifier[prefix].numberOfKnnLabels
        }
      }

      model = new mlClass(Xrows, Yrows, classifierArgs)
    }

    allModels[prefix] = model
    instances.classifier[prefix].isTrained = true
  }
}
