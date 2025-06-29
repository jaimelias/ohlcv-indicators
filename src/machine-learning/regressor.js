import { getFeaturedKeys, computeFlatFeaturesLen, logMlTraining, findGroupsFunc } from "./ml-utilities.js"
import { buildTrainX } from "./trainX.js"
import { modelTrain } from "./train-utilities.js"
import { areKeyValuesValid } from "../core-functions/pushToMain.js"

export const regressor = (main, index, trainingSize, {target, predictions, retrain, trainingCols, findGroups, type, modelArgs, precompute}) => {

    const {lookbackAbs, prefix, flatX, flatY, useTrainMethod} = precompute
    const {verticalOhlcv, len, instances, scaledGroups, invalidValueIndex, ML} = main
    const allModels = ML.models
    const startIndex = (invalidValueIndex + 1)

    if(index === startIndex)
    {
        if (!instances.hasOwnProperty('regressor')) instances.regressor = {}
        if(!instances.regressor.hasOwnProperty(prefix)) instances.regressor[prefix] = {}

        const expectedLoops = (flatY) ? predictions : 1 //

        instances.regressor[prefix] = {
            expectedLoops,
            trainingSize,
            isTrained: new Array(expectedLoops).fill(false),
            retrainOnEveryIndex: retrain,
            featureCols: [],
            flatFeaturesColLen: 0,
            X: [],
            Y: Array.from({ length: expectedLoops }, () => []),
        }
    } 
    else if(index < startIndex || index < lookbackAbs)
    {
        return
    }
    else if(index + 1 === len) 
    {
        if(instances.regressor[prefix].featureCols.length === 0)
        {
            const inputFeatures = [...trainingCols, ...(findGroupsFunc(findGroups, scaledGroups))]

            throw new Error(`Some of the provided ${type} features where not found in "verticalOhlcv": ${JSON.stringify(inputFeatures)}`)
        }

        //last execution
        for(const featureKey of instances.regressor[prefix].featureCols)
        {
            if(!verticalOhlcv.hasOwnProperty(featureKey)) throw new Error(`Feature "${featureKey}" not found in verticalOhlcv for regressor ${type}.`)
        }
    }

    const dataSetInstance = instances.regressor[prefix]

    if(dataSetInstance.flatFeaturesColLen === 0)
    {
        dataSetInstance.featureCols = getFeaturedKeys({trainingCols, findGroups, verticalOhlcv, scaledGroups})

        if(areKeyValuesValid(main, index, dataSetInstance.featureCols))
        {
            dataSetInstance.flatFeaturesColLen = computeFlatFeaturesLen(dataSetInstance.featureCols, instances, type, verticalOhlcv, index)

            for(let x = 0; x < predictions; x++)
            {
                const predictionKey = `${prefix}_${(x+1)}`
                verticalOhlcv[predictionKey] = new Float64Array(len).fill(NaN)
                ML.featureCols[predictionKey] = dataSetInstance.featureCols
            }

            logMlTraining({
                featureCols: dataSetInstance.featureCols, 
                flatFeaturesColLen: dataSetInstance.flatFeaturesColLen, 
                type, 
                trainingSize
            })

        } else {
            return
        }
    }
    
    if(dataSetInstance.flatFeaturesColLen === 0) return

    if(!verticalOhlcv.hasOwnProperty(target))
    {
        throw new Error(`Target property "${target}" not found in verticalOhlcv for regressor.`)
    }

    const {
        expectedLoops,
        X: xRows, 
        Y, 
        flatFeaturesColLen, 
        featureCols, 
        retrainOnEveryIndex
    } = dataSetInstance

    if(!featureCols.includes(target))
    {
        throw new Error(`Target property "${target}" not found in ${type} features: ${JSON.stringify(featureCols)}`)
    }
    
    const trainX = (flatX) ? verticalOhlcv[target][index] : buildTrainX({featureCols, flatFeaturesColLen, type, index, lookbackAbs, main})

    if (flatX) {
        if (!Number.isFinite(trainX)) return;   // or `trainX == null`
    } else {
        if (trainX == null) return;
    }

    let trainY = []

    for (let i = 0; i < predictions; i++) {
        const v = verticalOhlcv[target][index + i + 1]

        if (!Number.isFinite(v)) {
            break
        }

        trainY.push(v)
    }

    //if univariable Y (flatY) a model is created for each prediction
    for(let loopIdx = 0; loopIdx < expectedLoops; loopIdx++)
    {
        const predictionKey = `${prefix}_${(loopIdx+1)}`
        const yRows = Y[loopIdx]
        const currTrainY =  (flatY) ? (typeof trainY[loopIdx] === 'undefined') ? null : trainY[loopIdx] : trainY
        const isTrained = dataSetInstance.isTrained[loopIdx]

        //predicts using previously saved models even if current currTrainY is not available
        if(allModels.hasOwnProperty(predictionKey))
        {
            const futureRow = allModels[predictionKey].predict([trainX])[0]

            if(flatY)
            {
                if(Number.isNaN(futureRow)) throw new Error(`Prediction of ${type} at index ${index} was expecting a number.`)

                main.pushToMain({index, key: predictionKey, value: futureRow})
            }
            else {

                if (!Array.isArray(futureRow) || futureRow.length !== predictions) {
                    throw new Error(
                        `Prediction output of "${type}" at index ${index} was expecting an array of values.`
                    )
                }

                for(let preIdx = 0; preIdx < predictions; preIdx++) {
                    main.pushToMain({index, key: `${prefix}_${(preIdx+1)}`, value: futureRow[preIdx]})
                }
            }
        }

        if((index + predictions + 1) > len) continue
        if(trainY.length < predictions) continue
        if(currTrainY === null) continue

        if(flatY)
        {
            if (typeof currTrainY !== 'number' || Number.isNaN(currTrainY))
            {
                throw new Error(`currTrainY must return number, got ${typeof currTrainY} at index ${index}`)
            }
        } else {
            if (!Array.isArray(currTrainY)) {
                throw new Error(`currTrainY must return an array, got ${typeof currTrainY} at index ${index}`)
            }

            if ((currTrainY.length !== predictions)) {

                throw new Error(`currTrainY length (${currTrainY.length}) ≠ "options.predictions" (${predictions}) for regressor "${type}"`)
            }           
        }

        // enqueue
        yRows.push(currTrainY)
        if (yRows.length > trainingSize) yRows.shift()

        if(loopIdx === 0)
        {
            xRows.push(trainX)
            if (xRows.length > trainingSize) xRows.shift()
        }

        const shouldTrainModel = retrainOnEveryIndex || !isTrained

        if (shouldTrainModel && xRows.length === trainingSize && yRows.length === trainingSize) {

            allModels[predictionKey] = modelTrain({main, type, xRows, yRows, useTrainMethod, modelArgs, algo: 'regressor', uniqueLabels: 0})
            dataSetInstance.isTrained[loopIdx] = true
        }

    }
}