export const defaultYCallback = (index, verticalOhlcv, horizon) => {

    //this function will be executed inside a secondary loop after most of the indicates are calculated
    //use the "verticalOhlcv" object to access desired indicators

    if(horizon !== 2) throw new Error(`The default "yCallback" function in this classifier requires that "options.horizon" and "options.predictions" are set to "2".`)

    const currClose =  verticalOhlcv.close[index]
    const nextCloseArr = Array.from({length: horizon}, (_, i) => verticalOhlcv.close[i + 1 + index])

    if(nextCloseArr.some(v => typeof v === 'undefined')) return null

    const [nextClose, nextNextClose] = nextCloseArr

  
    //the total length of item is this output must be equal to "options.yColumns" property
    return [Number(nextClose > currClose), Number(nextNextClose > nextClose)]
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
      exportModel: m => m.toJSON(),
      train: ({modelClass, xRows, yRows, modelArgs}) => new modelClass(xRows, yRows, modelArgs),
      unsupervised: false
    },
    'FeedForwardNeuralNetworks': {
      shortName: 'feed_forward',
      flatY: false,
      exportModel: m => m.toJSON(),
      train: ({modelClass, xRows, yRows, modelArgs, uniqueLabels}) => {

        if(!modelArgs) modelArgs = {}

        modelArgs = {
          ...modelArgs, 
          activation: (uniqueLabels === 2) ? 'logistic' : 'identity'
        }
        
        const m = new modelClass(modelArgs)
        m.train(xRows, yRows)
        return m
      },
      unsupervised: false
    },
    'GaussianNB': {
      shortName: 'naive_bayes',
      flatY: true,
      exportModel: m => m.toJSON(),
      train: ({modelClass, xRows, yRows, modelArgs}) => {
        const m = new modelClass(modelArgs)
        m.train(xRows, yRows)
        return m
      },
      unsupervised: false
    },
    'MultinomialNB': {
      shortName: 'naive_bayes',
      flatY: true,
      exportModel: m => m.toJSON(),
      train: ({modelClass, xRows, yRows, modelArgs}) => {
        const m = new modelClass(modelArgs)
        m.train(xRows, yRows)
        return m
      },
      unsupervised: false
    },
    'DecisionTreeClassifier': {
      shortName: 'decision_tree',
      flatY: true,
      exportModel: m => m.toJSON(),
      train: ({modelClass, xRows, yRows, modelArgs}) => {
        const m = new modelClass(modelArgs)
        m.train(xRows, yRows)
        return m
      },
      unsupervised: false
    },
    'RandomForestClassifier': {
      shortName: 'random_forest',
      flatY: true,
      exportModel: m => m.toJSON(),
      train: ({modelClass, xRows, yRows, modelArgs}) => {
        const m = new modelClass(modelArgs)
        m.train(xRows, yRows)
        return m
      }
    },
    unsupervised: false
}

export const validRegressors = {
    'ARIMA': {
        shortName: 'arima',
        flatX: true,
        flatY: false,
        exportModel: m => m,
        train: ({modelClass, xRows, modelArgs}) => {

          if(!modelArgs) modelArgs = {}

          modelArgs = { ...modelArgs, p: 2, d: 1, q: 2, P: 0, D: 0, Q: 0, S: 0, verbose: false }

          const m = new modelClass(modelArgs)
          m.train(xRows)
          return m
        },
        unsupervised: true
    }, 
    'SimpleLinearRegression': {
        shortName: 'linear',
        flatX: true,
        flatY: true,
  
        exportModel: m => m.toJSON(),
        train: ({modelClass, xRows, yRows, modelArgs}) => new modelClass(xRows, yRows, modelArgs),
        unsupervised: false
    }, 
    'PolynomialRegression': {
        shortName: 'polynomial',
        flatX: true,
        flatY: true,
  
        exportModel: m => m.toJSON(),
        train: ({modelClass, xRows, yRows, modelArgs}) => new modelClass(xRows, yRows, modelArgs),
        unsupervised: false
    },
    'MultivariateLinearRegression': {
        shortName: 'multivariable',
        flatX: false,
        flatY: false,
  
        exportModel: m => m.toJSON(),
        train: ({modelClass, xRows, yRows, modelArgs}) => new modelClass(xRows, yRows, modelArgs),
        unsupervised: false
    }, 
    'DecisionTreeRegression': {
        shortName: 'decision_tree',
        flatX: false,
        flatY: true,
        exportModel: m => m.toJSON(),
        train: ({modelClass, xRows, yRows, modelArgs}) => {
          const m = new modelClass(modelArgs)
          m.train(xRows, yRows)
          return m
        },
        unsupervised: false
    },
    'RandomForestRegression': {
        shortName: 'random_forest',
        flatX: false,
        flatY: true,
        exportModel: m => m.toJSON(),
        train: ({modelClass, xRows, yRows, modelArgs}) => {
          const m = new modelClass(modelArgs)
          m.train(xRows, yRows)
          return m
        },
        unsupervised: false
    },
    'FeedForwardNeuralNetworks': {
        shortName: 'feed_forward',
        flatX: false,
        flatY: false,
        exportModel: m => m.toJSON(),
        train: ({modelClass, xRows, yRows, modelArgs}) => {

          if(!modelArgs) modelArgs = {}

          modelArgs = {
            ...modelArgs, 
            activation: 'identity'
          }
          
          const m = new modelClass(modelArgs)
          m.train(xRows, yRows)
          return m
        },
        unsupervised: false
    }
}