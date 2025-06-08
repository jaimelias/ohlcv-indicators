export const validRegressors = {
    'SimpleLinearRegression': 'linear', 
    'PolynomialRegression': 'polynomial',
    'MultivariateLinearRegression': 'multivariable', 
    'DecisionTreeRegression': 'decisionTree',
    'RandomForestRegression': 'randomForest'
}

export const univariableRegressors = new Set('SimpleLinearRegression', 'PolynomialRegression')

export const regressor = (main, index, trainingSize, {target, predictions, trainingCols, type}) => {

    const {verticalOhlcv, len, priceBased, instances} = main
    const prefix = `reg_${validRegressors[type]}_${trainingSize}_${target}_prediction`



    if(index === 0)
    {
        if(!verticalOhlcv.hasOwnProperty(target))
        {
            throw new Error(`Target property ${target} not found in verticalOhlcv for regressor.`)
        }

        if(!instances.hasOwnProperty('regressor'))
        {
            instances.regressor = {}
        }

        for(let x = 0; x < predictions; x++)
        {
            const keyName = `${prefix}_${(x+1)}`
            verticalOhlcv[keyName] = new Float64Array(len).fill(NaN)

            instances.regressor[keyName] = []

            if(priceBased.has(keyName))
            {
                priceBased.add(keyName)
            }
        }
    }

     for(let x = 0; x < predictions; x++)
     {
        const keyName = `${prefix}_${(x+1)}`

        const thisRow = new Float64Array(trainingCols.length).fill(NaN)

        for(let t = 0; t < trainingCols.length; t++)
        {
            const trainingKey = trainingCols[t]
            const value = verticalOhlcv[trainingKey][index]
            thisRow[t] = value
        }

        instances.regressor[keyName].push(thisRow)

        if(instances.regressor[keyName].length > trainingSize)
        {
            instances.regressor[keyName].shift()
        }
     }



}