
export const validRegressors = {
    'SimpleLinearRegression': 'linear', 
    'PolynomialRegression': 'polynomial',
    'MultivariateLinearRegression': 'multivariable', 
    'DecisionTreeRegression': 'decision_tree',
    'RandomForestRegression': 'random_forest',
    'FeedForwardNeuralNetworks': 'feed_forward'
}

export const validFeedForwardActivators = ['tanh', 'identity', 'logistic', 'arctan', 'softsign', 'relu', 'softplus', 'bent', 'sinusoid', 'sinc', 'gaussian', 'parametric-relu', 'exponential-relu', 'soft-exponential']

export const univariableRegressorsX = new Set(['SimpleLinearRegression', 'PolynomialRegression'])
export const univariableRegressorsY = new Set(['SimpleLinearRegression', 'PolynomialRegression', 'DecisionTreeRegression', 'RandomForestRegression'])
export const regressorUseTrainMethod = new Set(['DecisionTreeRegression', 'RandomForestRegression', 'FeedForwardNeuralNetworks'])
export const defaultRandomForestOptions = {
    seed: 3,
    maxFeatures: 2,
    replacement: false,
    nEstimators: 30,
}

export const defaultFeedForwardOptions = {
    hiddenLayers: [10],
    iterations: 50,
    learningRate: 0.01,
    regularization: 0.01,
    activationParam: 1,
    activation: 'relu',
}

export const regressor = (main, index, trainingSize, {target, predictions, lookback, trainingCols, findGroups, type, regressorArgs, precompute}) => {

    const {lookbackAbs, prefix, flatX, flatY, useTrainMethod} = precompute
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
            Y: []
        }

        for(let x = 0; x < predictions; x++)
        {
            const predictionKey = `${prefix}_${(x+1)}`
            verticalOhlcv[predictionKey] = new Float64Array(len).fill(NaN)

            if(flatY)
            {
                instances.regressor[prefix].X[x] = [];
                instances.regressor[prefix].Y[x] = [];
            }
        }

    }

    const {X: xInstance, Y: yInstance, trainingColsLen} = instances.regressor[prefix]
    

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
        //process single-column outputs
        for(let x = 0; x < predictions; x++) {
            const predictionKey = `${prefix}_${(x+1)}`
            let model

            //predict from stored model in main
            if(main.models.hasOwnProperty(predictionKey)){

                //current prediction should be extracted from the saved model in 
                model = main.ML[type].load(main.models[predictionKey])

                let futureValue = model.predict([trainX])
                
                //the output pushed to main should be always a flat number
                main.pushToMain({ index, key: predictionKey, value: futureValue})
            }
            
            const trainY = verticalOhlcv[target][index + (x + 1)] 
            const yRows = yInstance[x]
            const xRows = xInstance[x]

            if(yRows.length === trainingSize && xRows.length === trainingSize){

                if(useTrainMethod)
                {
                    model = new main.ML[type](regressorArgs)
                    model.train(xRows, yRows)
                }
                else
                {
                    model = new main.ML[type](xRows, yRows)
                }

                main.models[predictionKey] = model.toJSON()
            }

            if(typeof trainY === 'undefined') continue

            yRows.push(trainY)
            xRows.push(trainX)

            if(yRows.length > trainingSize)
            {
                yRows.shift()
            }

            if(xRows.length > trainingSize)
            {
                xRows.shift()
            }
        }

        

    } else
    {
        let model

        //process multi-column outputs
        if(main.models.hasOwnProperty(prefix)){

            //current prediction should be extracted from the saved model in 
            model = main.ML[type].load(main.models[prefix])

            let futurePredictions = model.predict([trainX])[0]

            for(let x = 0; x < predictions; x++)
            {
                const predictionKey = `${prefix}_${(x+1)}`

                main.pushToMain({ index, key: predictionKey, value: futurePredictions[x] })
            }
        }

        //this conditionsl avoids undefined trainY items
        if((index + predictions + 1) > len) return

        trainY = new Array(predictions).fill(NaN).map((_, i) => verticalOhlcv[target][index + (i + 1)] )

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