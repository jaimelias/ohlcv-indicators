export const validRegressors = {
    'SimpleLinearRegression': 'linear', 
    'PolynomialRegression': 'polynomial',
    'MultivariateLinearRegression': 'multivariable', 
    'DecisionTreeRegression': 'decisionTree',
    'RandomForestRegression': 'randomForest'
}



export const regressor = (main, index, trainingSize, {target, predictions, trainingCols, type}) => {

    const {verticalOhlcv} = main
    const prefix = `regresor_${validRegressors[type]}_${target}_${trainingSize}`

    console.log(prefix)

    if(index === 0)
    {
        for(let x = 0; x < predictions; x++)
        {
            //do nothing
        }
    }


}