import { getFeaturedKeys, computeFlatFeaturesLen, logMlTraining } from "./ml-utilities.js"
import { buildTrainX } from "./trainX.js"
import { modelTrain } from "./train-utilities.js"

export const regressor = (main, index, trainingSplit, {target, predictions, retrain, trainingCols, findGroups, type, modelArgs, precompute}) => {

    const {lookbackAbs, prefix, flatX, flatY, useTrainMethod} = precompute
    const {verticalOhlcv, len, instances, scaledGroups, invalidValueIndex, ML} = main
    const allModels = ML.models

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

        const usable = (len - invalidValueIndex) - predictions
        const trainingSize = Math.floor(usable * trainingSplit)

        const expectedLoops = (flatY) ? predictions : 1 //

        instances.regressor[prefix] = {
            expectedLoops,
            trainingSize,
            isTrained: new Array(expectedLoops).fill(false),
            retrainOnEveryIndex: retrain,
            featureCols,
            flatFeaturesColLen,
            X: [],
            Y: Array.from({ length: expectedLoops }, () => []),
        }

        for(let x = 0; x < predictions; x++)
        {
            const predictionKey = `${prefix}_${(x+1)}`
            verticalOhlcv[predictionKey] = new Float64Array(len).fill(NaN)
        }

        logMlTraining({featureCols, flatFeaturesColLen, type, trainingSize})
    }

    // --- EARLY EXIT IF NOT ENOUGH HISTORY ---
    if (index < lookbackAbs) return;

    const dataSetInstance = instances.regressor[prefix]
    const {
        expectedLoops,
        trainingSize, 
        X: xRows, 
        Y, 
        flatFeaturesColLen, 
        featureCols, 
        retrainOnEveryIndex
    } = dataSetInstance

    
    const trainX = (flatX) ? verticalOhlcv[target][index] : buildTrainX({featureCols, instances, flatFeaturesColLen, type, index, lookbackAbs, verticalOhlcv})

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
        const modelKey = `${prefix}_${(loopIdx+1)}`
        const yRows = Y[loopIdx]
        const currTrainY =  (flatY) ? (typeof trainY[loopIdx] === 'undefined') ? null : trainY[loopIdx] : trainY
        const isTrained = dataSetInstance.isTrained[loopIdx]

        //predicts using previously saved models even if current currTrainY is not available
        if(allModels.hasOwnProperty(modelKey))
        {
            const futureRow = allModels[modelKey].predict([trainX])[0]

            if(flatY)
            {
                if(Number.isNaN(futureRow)) throw new Error(`Prediction of ${type} at index ${index} was expecting a number.`)

                main.pushToMain({index, key: modelKey, value: futureRow})
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

                throw new Error(`currTrainY length (${currTrainY.length}) ≠ "options.predictions" (${predictions}) for classifier "${type}"`)
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

            allModels[modelKey] = modelTrain({main, type, xRows, yRows, useTrainMethod, modelArgs, algo: 'regressor', uniqueLabels: 0})
            dataSetInstance.isTrained[loopIdx] = true
        }

    }
}