
export const validRegressors = {
    'SimpleLinearRegression': 'linear', 
    'PolynomialRegression': 'polynomial',
    'MultivariateLinearRegression': 'multivariable', 
    'DecisionTreeRegression': 'decision_tree',
    'RandomForestRegression': 'random_forest'
}

export const univariableRegressorsX = new Set(['SimpleLinearRegression', 'PolynomialRegression'])
export const univariableRegressorsY = new Set(['SimpleLinearRegression', 'PolynomialRegression', 'DecisionTreeRegression', 'RandomForestRegression'])
export const regressorUseTrainMethod = new Set(['DecisionTreeRegression', 'RandomForestRegression'])
export const defaultRandomForestOptions = {
    seed: 3,
    maxFeatures: 2,
    replacement: false,
    nEstimators: 30,
}

export const regressor = (main, index, trainingSize, {target, predictions, lookback, trainingCols, findGroups, type, rfArgs, precompute}) => {

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

        instances.regressor[prefix] = {
            X: {},
            Y: {}
        }

        for(const trainingKey of trainingCols)
        {
            if(!verticalOhlcv.hasOwnProperty(trainingKey)) throw new Error(`Target property ${trainingKey} not found in verticalOhlcv for regressor.`)
        }

        instances.regressor[prefix].trainingColsLen = trainingCols.length

        for(let x = 0; x < predictions; x++)
        {
            const predictionKey = `${prefix}_${(x+1)}`
            verticalOhlcv[predictionKey] = new Float64Array(len).fill(NaN)

            instances.regressor[prefix].X[predictionKey] = []
            instances.regressor[prefix].Y[predictionKey] = []
        }
    }

    const {X: xInstance, Y: yInstance, trainingColsLen} = instances.regressor[prefix]
    

    //console.log({trainingCols})

    for(let x = 0; x < predictions; x++)
    {
        const predictionKey = `${prefix}_${(x+1)}`
        let trainX
        let model

        if(flatX)
        {
            trainX = verticalOhlcv[target][index]
        }
        else{

            // skip until we have at least `lookbackAbs` bars of history
            if(index < lookbackAbs) continue

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

        //predict from stored model in main
        if(main.models.hasOwnProperty(predictionKey)){

            //current prediction should be extracted from the saved model in 
            model = main.ML[type].load(main.models[predictionKey])

            let prediction = model.predict([trainX])
            
            //the output pushed to main should be always a flat number
            main.pushToMain({ index, key: predictionKey, value: prediction[0]})
        }
        

        const trainY = verticalOhlcv[target][index + (x + 1)] 

        if(typeof trainY === 'undefined') continue

        const yRows = yInstance[predictionKey]
        const xRows = xInstance[predictionKey]

        if(yRows.length === trainingSize && xRows.length === trainingSize){

            if(useTrainMethod)
            {
                model = new main.ML[type](rfArgs)
                model.train(xRows, yRows)
            }
            else
            {
                model = new main.ML[type](xRows, yRows)
            }

            main.models[predictionKey] = model.toJSON()
        }

        xRows.push(trainX)
        yRows.push((flatY) ? trainY : [trainY])

        if(xRows.length > trainingSize)
        {
            xRows.shift()
            yRows.shift()
        }
    }
}