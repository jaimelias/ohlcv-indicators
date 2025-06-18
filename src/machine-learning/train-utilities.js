export const modelTrain = ({main, type, xRows, yRows, useTrainMethod, modelArgs, algo, uniqueLabels = 0}) => {

    let model
    const validAlgos = ['classifier', 'regressor']
    const mlClass = main.ML.classes[type]

    if(!validAlgos.includes(algo.toString())) throw new Error(`Invalid "algo" para in "modelTrain" function.`)

    if(type === 'FeedForwardNeuralNetworks')
    {
        if(!modelArgs) modelArgs = {}

        if(!modelArgs.hasOwnProperty('activation'))
        {
            if(algo === 'regressor')
            {
                modelArgs.activation = 'identity'
            }
            else if(algo === 'classifier')
            {
                modelArgs.activation = (uniqueLabels) ? 'logistic' : 'identity'
            }
        }
    } 
    else if(type === 'KNN')
    {
        if(!modelArgs) modelArgs = {}
        modelArgs.uniqueLabels = uniqueLabels
    }
    else if(type === 'RandomForestRegression')
    {
        if(!modelArgs) modelArgs = {}

    }

    if(useTrainMethod)
    {
        model = new mlClass(modelArgs)
        model.train(xRows, yRows)
    } else {
        model = new mlClass(xRows, yRows, modelArgs)
    }

    return model

}