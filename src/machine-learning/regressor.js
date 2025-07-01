import { getFeaturedKeys, computeFlatFeaturesLen, logMlTraining, findGroupsFunc } from './ml-utilities.js'
import { buildTrainX } from './trainX.js'
import { areKeyValuesValid } from '../core-functions/pushToMain.js'

const algo = 'regressor'

export const regressor = (main, index, trainingSize, {target, predictions, retrain, trainingCols, findGroups, type, modelArgs, precompute, filterCallback, modelConfig, modelClass}) => {

    const {lookbackAbs, prefix, flatX, flatY} = precompute
    const {verticalOhlcv, len, instances, scaledGroups, invalidValueIndex, ML} = main
    const allModels = ML.models
    const startIndex = (invalidValueIndex + 1)

    if(index === startIndex)
    {
        if (!instances.hasOwnProperty(algo)) instances.regressor = {}
        if(!instances.regressor.hasOwnProperty(prefix)) instances.regressor[prefix] = {}

        const expectedLoops = (flatY) ? predictions : 1 //

        instances.regressor[prefix] = {
            expectedLoops,
            trainingSize,
            isTrained: new Array(expectedLoops).fill(false),
            shouldRetrain: retrain,
            featureCols: [],
            flatFeaturesColLen: 0,
            X: [],
            Y: Array.from({ length: expectedLoops }, () => []),
        }

        for(let x = 0; x < predictions; x++)
        {
            const predictionKey = `${prefix}_${(x+1)}`
            verticalOhlcv[predictionKey] = new Float64Array(len).fill(NaN)

            if(!allModels.hasOwnProperty(predictionKey))
            {
                allModels[predictionKey] = []
            }
        }
    } 
    else if(index < startIndex || index < lookbackAbs)
    {
        return
    }
    else if(filterCallback(verticalOhlcv, index) === false)
    {
        return
    }
    else if(index + 1 === len) 
    {
        if(instances.regressor[prefix].featureCols.length === 0)
        {
            const inputFeatures = [...trainingCols, ...(findGroupsFunc(findGroups, scaledGroups))]

            throw new Error(`Some of the provided ${prefix} features where not found in "verticalOhlcv": ${JSON.stringify(inputFeatures)}`)
        }

        //last execution
        for(const featureKey of instances.regressor[prefix].featureCols)
        {
            if(!verticalOhlcv.hasOwnProperty(featureKey)) throw new Error(`Feature "${featureKey}" not found in verticalOhlcv for ${prefix}.`)
        }

        if(instances.regressor[prefix].X.length < trainingSize)
        {
            const requiredDatapoints = instances.regressor[prefix].X.length - trainingSize
            throw new Error(`The current "trainingSize" at "${prefix}" requires at least ${requiredDatapoints} more datapoints. Try adding more input ohlcv rows or reducing the "trainingSize" by ${requiredDatapoints}.`)
        }
    }

    const dataSetInstance = instances.regressor[prefix]

    if(dataSetInstance.flatFeaturesColLen === 0)
    {
        dataSetInstance.featureCols = getFeaturedKeys({trainingCols, findGroups, verticalOhlcv, scaledGroups})

        if(areKeyValuesValid(main, index, dataSetInstance.featureCols))
        {
            dataSetInstance.flatFeaturesColLen = computeFlatFeaturesLen(dataSetInstance.featureCols, verticalOhlcv, index)

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
        shouldRetrain
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

    const {train, unsupervised} = modelConfig

    //if univariable Y (flatY) a model is created for each prediction
    for(let loopIdx = 0; loopIdx < expectedLoops; loopIdx++)
    {
        const predictionKey = `${prefix}_${(loopIdx+1)}`
        const yRows = Y[loopIdx]
        const currTrainY =  (flatY) ? (typeof trainY[loopIdx] === 'undefined') ? null : trainY[loopIdx] : trainY
        const isTrained = dataSetInstance.isTrained[loopIdx]

        const shouldPredict = allModels.hasOwnProperty(predictionKey) && isTrained && (shouldRetrain === false || allModels[predictionKey].length === predictions)

        //predicts using previously saved models even if current currTrainY is not available
        if(shouldPredict)
        {
            const currModel = allModels[predictionKey][0]
            const futureRow = (unsupervised) ? currModel.predict(predictions)[0] : currModel.predict([trainX])[0]
            
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

        const shouldTrainModel = shouldRetrain || !isTrained

        if (shouldTrainModel && xRows.length === trainingSize && yRows.length === trainingSize) {

            const trainedModel = train({modelClass, xRows, yRows, modelArgs, uniqueLabels: 0})

            if(unsupervised)
            {
                allModels[predictionKey] = [trainedModel]
            } else {
                allModels[predictionKey].push(trainedModel)

                if(allModels[predictionKey].length > predictions)
                {
                    allModels[predictionKey].shift()
                }
            }

            dataSetInstance.isTrained[loopIdx] = true
        }

    }
}