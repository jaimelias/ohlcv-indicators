import { countUniqueLabels } from "./ml-utilities.js"
export const modelTrain = ({main, type, Xrows, Yrows, useTrainMethod, args, algo, uniqueLabels = 0}) => {

    let model
    const validAlgos = ['classifier', 'regressor']
    const mlClass = main.ML.classes[type]

    if(useTrainMethod)
    {
        if(type === 'FeedForwardNeuralNetworks')
        {
            if(!args) args = {}

            if(!args.hasOwnProperty('activation'))
            {
                args.activation = ()
            }
        }

        model = new mlClass(args)
        model.train(Xrows, Yrows)
    }
    else {
        if(type === 'KNN')
        {
            if(!args) args = {}


            args.uniqueLabels = uniqueLabels
        }
        
        model = new mlClass(Xrows, Yrows, args)
    }

    return model

}