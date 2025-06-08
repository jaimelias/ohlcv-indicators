export const validRegressors = {
    'SimpleLinearRegression': 'linear', 
    'PolynomialRegression': 'polynomial',
    'MultivariateLinearRegression': 'multivariable', 
    'DecisionTreeRegression': 'decisionTree',
    'RandomForestRegression': 'randomForest'
}

export const univariableRegressors = new Set('SimpleLinearRegression', 'PolynomialRegression')

export const regressor = (main, index, trainingSize, {target, predictions, trainingCols, type}) => {

    const {verticalOhlcv, len, instances} = main
    const prefix = `reg_${validRegressors[type]}_${trainingSize}_${target}_prediction`


    if(index === 0)
    {
        if(!verticalOhlcv.hasOwnProperty(target))
        {
            throw new Error(`Target property ${target} not found in verticalOhlcv for regressor.`)
        }

        if(!instances.hasOwnProperty('regressor'))
        {
            instances.regressor = {
                X: {},
                Y: {}
            }
        }

        for(let x = 0; x < predictions; x++)
        {
            const predictionKey = `${prefix}_${(x+1)}`
            verticalOhlcv[predictionKey] = new Float64Array(len).fill(NaN)

            instances.regressor.X[predictionKey] = []
            instances.regressor.Y[predictionKey] = []
        }
    }

    const {X: xInstance, Y: yInstance} = instances.regressor

    for(let x = 0; x < predictions; x++)
    {
        const predictionKey = `${prefix}_${(x+1)}`
        const trainX = new Float64Array(trainingCols.length).fill(NaN)

        for(let t = 0; t < trainingCols.length; t++)
        {
            const trainingKey = trainingCols[t]
            const value = verticalOhlcv[trainingKey][index]
            trainX[t] = typeof value === 'undefined' ? NaN : value
        }

        const predictedValue = verticalOhlcv[target][index + (x + 1)]

        xInstance[predictionKey].push(trainX)
        yInstance[predictionKey].push(typeof predictedValue === 'undefined' ? NaN : predictedValue)

        if(xInstance[predictionKey].length > trainingSize)
        {
            xInstance[predictionKey].shift()
        }
     }
}