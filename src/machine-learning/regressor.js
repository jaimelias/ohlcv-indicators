import { findGroupsFunc } from "./ml-utilities.js"

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

export const regressor = (main, index, trainingSize, {target, predictions, retrain, trainingCols, findGroups, type, regressorArgs, precompute}) => {

    const {lookbackAbs, prefix, flatX, flatY, useTrainMethod} = precompute
    const {verticalOhlcv, len, instances, scaledGroups} = main

    if(index === 0)
    {
        const featureCols = [...trainingCols, ...(findGroupsFunc(findGroups, scaledGroups))]

        if(findGroups.length > 0)
        {
            for(let g = 0; g < findGroups.length; g++)
            {
                const group = findGroups[g]
                if(!scaledGroups.hasOwnProperty(`${group.type}_${group.size}`)) throw new Error(`Scaled group not found for ${type} regressor.options.findGroups[${g}]: ${JSON.stringify(group)}`)
                featureCols.push(...scaledGroups[`${group.type}_${group.size}`])
            }
        }

        if(featureCols.length === 0) throw new Error(`There are not "featureCols" available in regressor "${type}"`)

        if(!verticalOhlcv.hasOwnProperty(target))
        {
            throw new Error(`Target property "${target}" not found in verticalOhlcv for regressor.`)
        }
        if(!featureCols.includes(target))
        {
            throw new Error(`Target property "${target}" not found in options.trainingCols: ${JSON.stringify(trainingCols)}`)
        }

        if(!instances.hasOwnProperty('regressor'))
        {
            instances.regressor = {
                [prefix]: {}
            }
        }

        for(const trainingKey of featureCols)
        {
            if(!verticalOhlcv.hasOwnProperty(trainingKey)) throw new Error(`Target property ${trainingKey} not found in verticalOhlcv for regressor.`)
        }

       let flatFeaturesColLen = 0

        for(const key of featureCols)
        {
            if(key.startsWith('one_hot_'))
            {
                if(!instances.hasOwnProperty('crossPairs')) throw new Error(`Property "instances.crossPairs" not found in regressor ${type}`)
                if(!instances.crossPairs.hasOwnProperty(key)) throw new Error(`Property "instances.crossPairs[${key}]" not found in regressor ${type}`)
                const {oneHotCols, uniqueValues} = instances.crossPairs[key]
                const {size} = uniqueValues
                const colSize = (typeof oneHotCols === 'number') ? oneHotCols : size

                flatFeaturesColLen = flatFeaturesColLen + colSize
            }
            else {
                flatFeaturesColLen++
            }
        }

        instances.regressor[prefix] = {
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

        console.log(`Training ${type} with ${flatFeaturesColLen} features: ${JSON.stringify(featureCols)}\n\n`)

    }

    const {X, Y, flatFeaturesColLen, featureCols, isTrained, retrainOnEveryIndex} = instances.regressor[prefix]
    let trainX
    let trainY

    if(flatX)
    {
        trainX = verticalOhlcv[target][index]
    } else {
        // --- EARLY EXIT IF NOT ENOUGH HISTORY ---
        if (index < lookbackAbs) return;
        let shouldExit = false;

        // --- BUILD A FLATTENED LIST OF “COLUMN SLOTS” ---
        // at init-time you already computed flatFeaturesColLen;
        // here we expand each 'one_hot_' key into [0..size-1] bit-slots
        const slots = []

        for (const key of featureCols) {
            if (key.startsWith('one_hot_')) {
                // pull the size from your CrossInstance metadata:
                const {oneHotCols, uniqueValues} = instances.crossPairs[key]
                const {size} = uniqueValues
                const colSize = (typeof oneHotCols === 'number') ? oneHotCols : size

                for (let bit = 0; bit < colSize; bit++) {
                    slots.push({ key, bit })
                }
            }
            else {
                slots.push({ key })
            }
        }

        if (slots.length !== flatFeaturesColLen) {
            throw new Error(`slots (${slots.length}) ≠ flatFeaturesColLen (${flatFeaturesColLen}) in ${type} index ${index}`)
        }

        // --- ALLOCATE AND FILL trainX ---
        trainX = new Array(flatFeaturesColLen * lookbackAbs).fill(NaN);

        for (let lag = 0; lag < lookbackAbs; lag++) {
        const tIdx = index - lag;

        for (let s = 0; s < slots.length; s++) {
            const { key, bit } = slots[s];
            // get either the raw value or the specific one-hot bit
            const cell = verticalOhlcv[key][tIdx];
            const value = (bit != null) ? cell[bit] : cell;

            if (!Number.isFinite(value)) {
                shouldExit = true;
                break;
            }
            trainX[lag * flatFeaturesColLen + s] = value;
        }

        if (shouldExit) break;
        }

        if (shouldExit) return;
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
            if(main.models.hasOwnProperty(prefix)){

                //current prediction should be extracted from the saved model in 
                model = main.models[prefix]
                
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
                    model = new main.ML.classes[type](regressorArgs)
                    model.train(xRows, yRows)
                }
                else
                {
                    model = new main.ML.classes[type](xRows, yRows)
                }

                main.models[prefix] = model
                instances.regressor[prefix].isTrained = true
            }
        }

        

    } else
    {
        let model

        //process multi-column outputs
        if(main.models.hasOwnProperty(prefix)){

            //current prediction should be extracted from the saved model in 
            model = main.models[prefix]

            const futurePredictionsRow = model.predict([trainX])
            const futurePredictions = futurePredictionsRow[0]


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
            if(useTrainMethod)
            {
                model = new main.ML.classes[type](regressorArgs)
                model.train(xRows, yRows)
            }
            else
            {
                model = new main.ML.classes[type](xRows, yRows)
            }
            main.models[prefix] = model
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