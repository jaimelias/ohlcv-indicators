
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

export const regressor = (main, index, trainingSize, {target, predictions, lookback, trainingCols, findGroups, type, regressorArgs, precompute}) => {

    const {lookbackAbs, prefix, flatX, flatY, useTrainMethod, isNeuralNetwork} = precompute
    const {verticalOhlcv, len, instances, scaledGroups} = main

    if(index === 0)
    {
        if(findGroups.length > 0)
        {
            for(let g = 0; g < findGroups.length; g++)
            {
                const group = findGroups[g]
                if(!scaledGroups.hasOwnProperty(`${group.type}_${group.size}`)) throw new Error(`Scaled group not found for ${type} regressor.options.findGroups[${g}]: ${JSON.stringify(group)}`)
                trainingCols.push(...scaledGroups[`${group.type}_${group.size}`])
            }
        }

        if(flatX === false && trainingCols.length === 0) throw new Error(`Param "options.trainingCols" must have at least 2 cols for ${type}.`)

        if(!verticalOhlcv.hasOwnProperty(target))
        {
            throw new Error(`Target property "${target}" not found in verticalOhlcv for regressor.`)
        }
        if(!trainingCols.includes(target))
        {
            throw new Error(`Target property "${target}" not found in options.trainingCols: ${JSON.stringify(trainingCols)}`)
        }

        if(!instances.hasOwnProperty('regressor'))
        {
            instances.regressor = {
                [prefix]: {}
            }
        }

        for(const trainingKey of trainingCols)
        {
            if(!verticalOhlcv.hasOwnProperty(trainingKey)) throw new Error(`Target property ${trainingKey} not found in verticalOhlcv for regressor.`)
        }



        instances.regressor[prefix] = {
            trainingColsLen: trainingCols.length,
            X: [],
            Y: [],
            indexOfTarget: trainingCols.indexOf(target)
        }

        for(let x = 0; x < predictions; x++)
        {
            const predictionKey = `${prefix}_${(x+1)}`
            verticalOhlcv[predictionKey] = new Float64Array(len).fill(NaN)
        }

    }

    const {X: xInstance, Y: yInstance, trainingColsLen, indexOfTarget} = instances.regressor[prefix]
    

    let trainX
    let trainY

    if(flatX)
    {
        trainX = verticalOhlcv[target][index]
    } else {
        if(index < lookbackAbs) return
        
        trainX = new Array(trainingColsLen *  lookbackAbs).fill(NaN)

        for(let l = 0; l < lookbackAbs; l++)
        {
            for(let t = 0; t < trainingColsLen; t++)
            {
                const trainingKey = trainingCols[t]
                const value = verticalOhlcv[trainingKey][index - l]
                trainX[l * trainingColsLen + t] = value
            }
        }
    }

   

    if(flatY)
    {
        //process single-column outputs using the current value as the first datapoint and using futureValue as datapoint for the next predictions
        const trainY = verticalOhlcv[target][index] 

        yInstance.push(trainY)
        xInstance.push(trainX)

        if(yInstance.length > trainingSize) yInstance.shift()
        if(xInstance.length > trainingSize) xInstance.shift()

        const yRows = [...yInstance] //can be an array of number or 2d array with numbers
        const xRows = [...xInstance] //can be an array of number or 2d array with numbers

        for(let x = 0; x < predictions; x++) {
            const predictionKey = `${prefix}_${(x+1)}`
            let model

            //predict from stored model in main
            if(main.models.hasOwnProperty(prefix)){

                //current prediction should be extracted from the saved model in 
                model = main.ML[type].load(main.models[prefix])
                
                // First prediction uses the original trainX; subsequent predictions use previous predicted values (futureValue) as datapoints

                const newTrainX = xRows[xRows.length - 1] // can be an array or a number
                const futureValueRow = model.predict([newTrainX]) //newTrainX needs to be wrapped in an array for predictions
                const futureValue = futureValueRow[0] //predict needs to be unwrapped before pushing it to main

                //flatX indicates training X features only accept 1 variable
                if(flatX)
                {
                    xRows.push(futureValue)

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

            if(x === 0 && yRows.length === trainingSize && xRows.length === trainingSize){

                if(useTrainMethod)
                {
                    model = new main.ML[type](regressorArgs)
                    model.train(xRows, yRows)
                }
                else
                {
                    model = new main.ML[type](xRows, yRows)
                }

                main.models[prefix] = model.toJSON()
            }
        }

        

    } else
    {
        let model

        //process multi-column outputs
        if(main.models.hasOwnProperty(prefix)){

            //current prediction should be extracted from the saved model in 
            model = main.ML[type].load(main.models[prefix])

            const futurePredictionsRow = model.predict([trainX])
            const futurePredictions = futurePredictionsRow[0]


            for(let x = 0; x < predictions; x++)
            {
                const predictionKey = `${prefix}_${(x+1)}`

                if(isNeuralNetwork)
                {
                    //3d array pushing the target value
                    main.pushToMain({ index, key: predictionKey, value: futurePredictions[x][indexOfTarget] })
                }
                else{
                    //2d array pushing the target value
                    main.pushToMain({ index, key: predictionKey, value: futurePredictions[x] })
                }
            }
        }

        //this conditionsl avoids undefined trainY items
        if((index + predictions + 1) > len) return

        if(isNeuralNetwork)
        {
            //3d array
            trainY = new Array(predictions).fill(NaN).map((_, i) => trainingCols.map(key => verticalOhlcv[key][index + (i + 1)]) )
        }
        else {
            //2d array
            trainY = new Array(predictions).fill(NaN).map((_, i) => verticalOhlcv[target][index + (i + 1)] )
        }

        const yRows = yInstance
        const xRows = xInstance

        if(yRows.length === trainingSize && xRows.length === trainingSize)
        {
            if(useTrainMethod)
            {
                model = new main.ML[type](regressorArgs)
                model.train(xRows, yRows)
            }
            else
            {
                model = new main.ML[type](xRows, yRows)
            }
            main.models[prefix] = model.toJSON()
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