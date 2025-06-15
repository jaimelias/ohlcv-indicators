export const validClassifiers = {
    'KNN': 'knn',
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
    classifierArgs,
    precompute,
    predictions
  }
) => {
  const { lookbackAbs, prefix, useTrainMethod } = precompute
  const { verticalOhlcv, len, instances, scaledGroups } = main

  // ─── INITIALIZATION ───────────────────────────────────────────────
  if (index === 0) {
    // build featureCols
    const featureCols = [...trainingCols]
    findGroups.forEach((group, gi) => {
      const key = `${group.type}_${group.size}`
      if (!scaledGroups[key]) {
        throw new Error(
          `Scaled group not found for classifier.options.findGroups[${gi}]: ${JSON.stringify(
            group
          )}`
        )
      }
      featureCols.push(...scaledGroups[key])
    });

    if (featureCols.length === 0) {
      throw new Error(`No featureCols available in classifier "${type}"`);
    }
    // sanity‐check that all features exist
    featureCols.forEach((col) => {
      if (!(col in verticalOhlcv)) {
        throw new Error(
          `Feature column "${col}" not found in verticalOhlcv for classifier "${type}"`
        )
      }
    })

    // prepare instance storage
    if (!instances.classifier) instances.classifier = {}
    // compute flattened feature‐length (expanding one-hots)
    let flatFeaturesColLen = 0
    featureCols.forEach((key) => {
      if (key.startsWith("one_hot_")) {
        const cp = instances.crossPairs?.[key]
        if (!cp) {
          throw new Error(`Missing crossPairs metadata for "${key}"`);
        }
        const { oneHotCols, uniqueValues } = cp;
        const size = uniqueValues.size
        flatFeaturesColLen +=
          typeof oneHotCols === "number" ? oneHotCols : size;
      } else {
        flatFeaturesColLen++
      }
    });

    instances.classifier[prefix] = {
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
      `Initialized classifier "${type}" with ${flatFeaturesColLen} features:\n${JSON.stringify(
        featureCols
      )}`
    )
  }

  const {
    featureCols,
    flatFeaturesColLen,
    X: Xrows,
    Y: Yrows,
    isTrained,
    retrainOnEveryIndex
  } = instances.classifier[prefix]

  // ─── EARLY EXIT IF NOT ENOUGH HISTORY ─────────────────────────────
  if (index < lookbackAbs) return

  // ─── BUILD TRAINING X ──────────────────────────────────────────────
  const slots = []
  featureCols.forEach((key) => {
    if (key.startsWith("one_hot_")) {
      const cp = instances.crossPairs[key]
      const { oneHotCols, uniqueValues } = cp
      const size = uniqueValues.size
      const colSize = typeof oneHotCols === "number" ? oneHotCols : size
      for (let bit = 0; bit < colSize; bit++) slots.push({ key, bit })
    } else {
      slots.push({ key })
    }
  })
  if (slots.length !== flatFeaturesColLen) {
    throw new Error(
      `slots (${slots.length}) ≠ flatFeaturesColLen (${flatFeaturesColLen}) in classifier "${type}" at index ${index}`
    )
  }
  let shouldExit = false
  const trainX = new Array(flatFeaturesColLen * lookbackAbs)

  for (let lag = 0; lag < lookbackAbs; lag++) {

    const tIdx = index - lag

    for (let s = 0; s < slots.length; s++) {

      const { key, bit } = slots[s]
      const cell = verticalOhlcv[key][tIdx]
      const value = bit != null ? cell[bit] : cell
      if (!Number.isFinite(value)){
          shouldExit = true // skip if any feature is NaN
          break
      }
      trainX[lag * flatFeaturesColLen + s] = value
      
    }
    if (shouldExit) break
  }

   if (shouldExit) return


  // ─── PREDICT WITH EXISTING MODEL ───────────────────────────────────
  if (main.models.hasOwnProperty(prefix)) {
    const model = main.models[prefix]

    const futureRow = model.predict([trainX])[0]   

    if (!Array.isArray(futureRow) || futureRow.length < predictions) {
      throw new Error(
        `Model.predict returned invalid output for classifier "${type}" at index ${index}`
      );
    }

    futureRow.forEach((val, i) => {
      main.pushToMain({
        index,
        key: `${prefix}_${i + 1}`,
        value: val,
      })
    })
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
      model = new main.ML[type](classifierArgs)
      
      model.train(Xrows, Yrows)
    } else {

      model = new main.ML[type](Xrows, Yrows, {k: 2})
    }
    main.models[prefix] = model
    instances.classifier[prefix].isTrained = true
  }
}
