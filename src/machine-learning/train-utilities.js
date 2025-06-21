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
                modelArgs = {
                    ...modelArgs, 
                    activation: 'identity', 
                    hiddenLayers: [20]
                }
            }
            else if(algo === 'classifier')
            {
                modelArgs = {
                    ...modelArgs, 
                    activation: (uniqueLabels === 2) ? 'logistic' : 'identity',
                    hiddenLayers: [20]
                } 
            }
        }

        
    } 
    else if(type === 'KNN')
    {
        if(!modelArgs) modelArgs = {}
        modelArgs.k = uniqueLabels
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