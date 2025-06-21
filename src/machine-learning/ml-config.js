export const defaultYCallback = (index, verticalOhlcv) => {

    //this function will be executed inside a secondary loop after most of the indicates are calculated
    //use the "verticalOhlcv" object to access desired indicators

    const nextClose = verticalOhlcv.close[index + 1]
    const nextOpen = verticalOhlcv.open[index + 1]

    if(typeof nextClose === 'undefined') return null //return null if the future value is undefined

    const nextNextClose = verticalOhlcv.close[index + 2]
    const nextNextOpen = verticalOhlcv.open[index + 2]

    if(typeof nextNextClose === 'undefined') return null //return null if the future value is undefined

    //the total length of item is this output must be equal to "options.yColumns" property
    return [Number(nextClose > nextOpen), Number(nextNextClose > nextNextOpen)]
}

export const exportTrainedModels = main => {

  const {ML, inputParams} = main
  const allModels = ML.models
  const output = {}

  for (const { key, params } of inputParams) {

    if(key !== 'classifier' && key !== 'regressor') continue

    const [_, {type, predictions, precompute}] = params
    const {flatY, prefix} = precompute
    const expectedLoops = (flatY) ? predictions : 1

    let exportModel

    if(key === 'regressor')
    {
      exportModel = validRegressors[type].exportModel
    }
    else if (key === 'classifier')
    {
      exportModel = validClassifiers[type].exportModel
    }

    for(let loopIdx = 0; loopIdx < expectedLoops; loopIdx++)
    {
      const modelKey = `${prefix}_${(loopIdx+1)}`
      output[modelKey] = exportModel(allModels[modelKey])
    }

  }

  return output
}

export const validClassifiers = {
    'KNN': {
      shortName: 'knn',
      flatY: true,
      useTrainMethod: false,
      exportModel: m => m.toJSON()
    },
    'FeedForwardNeuralNetworks': {
      shortName: 'feed_forward',
      flatY: false,
      useTrainMethod: true,
      exportModel: m => m.toJSON()
    },
    'GaussianNB': {
      shortName: 'naive_bayes',
      flatY: true,
      useTrainMethod: true,
      exportModel: m => m.toJSON()
    },
    'MultinomialNB': {
      shortName: 'naive_bayes',
      flatY: true,
      useTrainMethod: true,
      exportModel: m => m.toJSON()
    },
    'DecisionTreeClassifier': {
      shortName: 'decision_tree',
      flatY: true,
      useTrainMethod: true,
      exportModel: m => m.toJSON()
    },
    'RandomForestClassifier': {
      shortName: 'random_forest',
      flatY: true,
      useTrainMethod: true,
      exportModel: m => m.toJSON()
    },
}

export const validRegressors = {
    'SimpleLinearRegression': {
        shortName: 'linear',
        flatX: true,
        flatY: true,
        useTrainMethod: false,
        exportModel: m => m.toJSON()
    }, 
    'PolynomialRegression': {
        shortName: 'polynomial',
        flatX: true,
        flatY: true,
        useTrainMethod: false,
        exportModel: m => m.toJSON()
    },
    'MultivariateLinearRegression': {
        shortName: 'multivariable',
        flatX: false,
        flatY: false,
        useTrainMethod: false,
        exportModel: m => m.toJSON()
    }, 
    'DecisionTreeRegression': {
        shortName: 'decision_tree',
        flatX: false,
        flatY: true,
        useTrainMethod: true,
        exportModel: m => m.toJSON()
    },
    'RandomForestRegression': {
        shortName: 'random_forest',
        flatX: false,
        flatY: true,
        useTrainMethod: true,
        exportModel: m => m.toJSON()
    },
    'FeedForwardNeuralNetworks': {
        shortName: 'feed_forward',
        flatX: false,
        flatY: false,
        useTrainMethod: true,
        exportModel: m => m.toJSON()
    }
}