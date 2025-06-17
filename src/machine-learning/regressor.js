import { getFeaturedKeys, computeFlatFeaturesLen, logMlTraining } from "./ml-utilities.js"
import { buildTrainX } from "./trainX.js"

export const validRegressors = {
    'SimpleLinearRegression': 'linear', 
    'PolynomialRegression': 'polynomial',
    'MultivariateLinearRegression': 'multivariable', 
    'DecisionTreeRegression': 'decision_tree',
    'RandomForestRegression': 'random_forest',
    'FeedForwardNeuralNetworks': 'feed_forward'
}

export const defaultRandomForestRegressorOptions = {
    seed: 3,
    maxFeatures: 2,
    replacement: false,
    nEstimators: 30,
}

export const defaultFeedForwardRegressorOptions = {
    hiddenLayers: [10],
    iterations: 20,
    learningRate: 0.01,
    regularization: 0.01,
    activationParam: 1,
    activation: 'relu',
}

export const regressor = (main, index, trainingSplit, {target, predictions, retrain, trainingCols, findGroups, type, regressorArgs, precompute}) => {

    const {lookbackAbs, prefix, flatX, flatY, useTrainMethod} = precompute
    const {verticalOhlcv, len, instances, scaledGroups, invalidValueIndex} = main
    const mlClass = main.ML.classes[type]
    const allModels = main.models

    if((index + 1) === (invalidValueIndex + 1))
    {
        const featureCols = getFeaturedKeys({trainingCols, findGroups, verticalOhlcv, scaledGroups, type})

        if(!verticalOhlcv.hasOwnProperty(target))
        {
            throw new Error(`Target property "${target}" not found in verticalOhlcv for regressor.`)
        }
        if(!featureCols.includes(target))
        {
            throw new Error(`Target property "${target}" not found in options.trainingCols: ${JSON.stringify(trainingCols)}`)
        }

        if (!instances.hasOwnProperty('regressor')) instances.regressor = {}
        if(!instances.regressor.hasOwnProperty(prefix)) instances.regressor[prefix] = {}

        for(const featureKey of featureCols)
        {
            if(!verticalOhlcv.hasOwnProperty(featureKey)) throw new Error(`Feature "${featureKey}" not found in verticalOhlcv for regressor.`)
        }

        // compute flattened feature‐length (expanding one-hots)
        const flatFeaturesColLen = computeFlatFeaturesLen(featureCols, instances, type)

        const trainingSize = Math.floor((len - invalidValueIndex) * trainingSplit)

        instances.regressor[prefix] = {
            trainingSize,
            isTrained: false,
            retrainOnEveryIndex: retrain,
            featureCols,
            flatFeaturesColLen,
            X: [],
            Y: [],
        }

        for(let x = 0; x < predictions; x++)
        {
            const predictionKey = `${prefix}_${(x+1)}`
            verticalOhlcv[predictionKey] = new Float64Array(len).fill(NaN)
        }

        logMlTraining({featureCols, flatFeaturesColLen, type, trainingSize})
    }

    const {trainingSize, X, Y, flatFeaturesColLen, featureCols, isTrained, retrainOnEveryIndex} = instances.regressor[prefix]
    let trainX
    let trainY

    if(flatX)
    {
        trainX = verticalOhlcv[target][index]
    } else {
        // --- EARLY EXIT IF NOT ENOUGH HISTORY ---
        if (index < lookbackAbs) return;

        // ─── BUILD TRAINING X ──────────────────────────────────────────────
        trainX = buildTrainX({
            featureCols,
            instances,
            flatFeaturesColLen,
            type,
            index,
            lookbackAbs,
            verticalOhlcv
        })

        if(!trainX) return 
    }

   

    if(flatY)
    {
        //process single-column outputs using the current value as the first datapoint and using futureValue as datapoint for the next predictions
        const trainY = verticalOhlcv[target][index] 

        if(!Number.isFinite(trainY)) throw new Error(`At index ${index} the value of ${type} "trainY" is not numeric.`)

        Y.push(trainY)
        X.push(trainX)

        if(Y.length > trainingSize) Y.shift()
        if(X.length > trainingSize) X.shift()

        //can be an array of number or 2d array with numbers
        const yRows = [...Y] //we must spread here because predictions are used as datapoints
        const xRows = [...X] //we must spread here because predictions are used as datapoints

        for(let x = 0; x < predictions; x++) {
            const predictionKey = `${prefix}_${(x+1)}`
            let model

            //predict from stored model in main
            if(allModels.hasOwnProperty(prefix)){

                //current prediction should be extracted from the saved model in 
                model = allModels[prefix]
                
                // First prediction uses the original trainX; subsequent predictions use previous predicted values (futureValue) as datapoints

                const newTrainX = xRows[xRows.length - 1] // can be an array or a number
                const futureValueRow = model.predict([newTrainX]) //newTrainX needs to be wrapped in an array for predictions
                const futureValue = futureValueRow[0] //predict needs to be unwrapped before pushing it to main

                //flatX indicates training X features only accept 1 variable
                if(flatX)
                {
                    xRows.push(futureValue) //do not update yRows as xRows and yRows will end with the same values

                    if(xRows.length > trainingSize) xRows.shift()

                } else
                {
                    const prevX = xRows[xRows.length - 1]
                    const nextX = prevX.slice(1).concat(futureValue) // shift window
                    xRows.push(nextX)

                    if (xRows.length > trainingSize) xRows.shift()
                }


                //the output pushed to main should be always a flat number
                main.pushToMain({ index, key: predictionKey, value: futureValue})
            }

            const shouldTrainModel = retrainOnEveryIndex || retrainOnEveryIndex === false && isTrained === false

            

            if(x === 0 && shouldTrainModel && yRows.length === trainingSize && xRows.length === trainingSize){

                if(useTrainMethod)
                {
                    model = new mlClass(regressorArgs)
                    model.train(xRows, yRows)
                }
                else
                {
                    model = new mlClass(xRows, yRows, regressorArgs)
                }

                allModels[prefix] = model
                instances.regressor[prefix].isTrained = true
            }
        }

        

    } else
    {
        //process multi-column outputs
        if(allModels.hasOwnProperty(prefix)){

            //current prediction should be extracted from the saved model in 
            const model = allModels[prefix]

            const futurePredictionsRow = model.predict([trainX])
            const futurePredictions = futurePredictionsRow[0]

            if (!Array.isArray(futurePredictions) || futurePredictions.length < predictions) {
                throw new Error(
                `Model.predict returned invalid output for "${type}" at index ${index}`
                );
            }

            for(let x = 0; x < predictions; x++)
            {
                const predictionKey = `${prefix}_${(x+1)}`
                const currPrediction = futurePredictions[x]
                main.pushToMain({ index, key: predictionKey, value: currPrediction })
            }
        }

        //this conditionsl avoids undefined trainY items
        if((index + predictions + 1) > len) return

        //2d array


        trainY = []

        for (let i = 0; i < predictions; i++) {
            const v = verticalOhlcv[target][index + i + 1]

            if (!Number.isFinite(v)) {
                break
            }

            trainY.push(v)
        }

        if(trainY.length !== predictions)
        {
            return
        }

        //can be an array of number or 2d array with numbers
        const yRows = Y //we must not spread here because here predictions are not used as datapoints
        const xRows = X //we must not spread here because here predictions are not used as datapoints

        const shouldTrainModel = retrainOnEveryIndex || retrainOnEveryIndex === false && isTrained === false


        if(shouldTrainModel && yRows.length === trainingSize && xRows.length === trainingSize)
        {
            let model

            if(useTrainMethod)
            {
                model = new main.ML.classes[type](regressorArgs)
                model.train(xRows, yRows)
            }
            else
            {
                model = new main.ML.classes[type](xRows, yRows)
            }
            
            allModels[prefix] = model
            instances.regressor[prefix].isTrained = true
        }

        xRows.push(trainX)
        yRows.push(trainY)

        if(xRows.length > trainingSize)
        {
            xRows.shift()
            yRows.shift()
        }
        
    }
}