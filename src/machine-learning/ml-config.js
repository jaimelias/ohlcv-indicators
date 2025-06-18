export const defaultYCallback = (index, verticalOhlcv) => {

    //this function will be executed inside a secondary loop after most of the indicates are calculated
    //use the "verticalOhlcv" object to access desired indicators

    const nextClose = verticalOhlcv.close[index + 1]
    const nextOpen = verticalOhlcv.open[index + 1]

    if(typeof nextClose === 'undefined') return [] //return empty array if the future value is undefined

    const nextNextClose = verticalOhlcv.close[index + 2]
    const nextNextOpen = verticalOhlcv.open[index + 2]

    if(typeof nextNextClose === 'undefined') return [] //return empty array if the future value is undefined

    //the total length of item is this output must be equal to "options.yColumns" property
    return [Number(nextClose > nextOpen), Number(nextNextClose > nextNextOpen)]
}

export const validClassifiers = {
    'KNN': {
      shortName: 'knn',
      flatY: false,
      useTrainMethod: false,
    },
    'FeedForwardNeuralNetworks': {
      shortName: 'feed_forward',
      flatY: false,
      useTrainMethod: true,
    },
    'GaussianNB': {
      shortName: 'naive_bayes',
      flatY: true,
      useTrainMethod: true,
    },
    'MultinomialNB': {
      shortName: 'naive_bayes',
      flatY: true,
      useTrainMethod: true,
    },
    'DecisionTreeClassifier': {
      shortName: 'naive_bayes',
      flatY: true,
      useTrainMethod: true,
    },
    'RandomForestClassifier': {
      shortName: 'naive_bayes',
      flatY: true,
      useTrainMethod: true,
    },
}

export const validRegressors = {
    'SimpleLinearRegression': {
        shortName: 'linear',
        flatX: true,
        flatY: true,
        useTrainMethod: false
    }, 
    'PolynomialRegression': {
        shortName: 'polynomial',
        flatX: true,
        flatY: true,
        useTrainMethod: false
    },
    'MultivariateLinearRegression': {
        shortName: 'multivariable',
        flatX: false,
        flatY: false,
        useTrainMethod: false
    }, 
    'DecisionTreeRegression': {
        shortName: 'decision_tree',
        flatX: false,
        flatY: true,
        useTrainMethod: true
    },
    'RandomForestRegression': {
        shortName: 'random_forest',
        flatX: false,
        flatY: true,
        useTrainMethod: true
    },
    'FeedForwardNeuralNetworks': {
        shortName: 'feed_forward',
        flatX: false,
        flatY: false,
        useTrainMethod: true
    }
}