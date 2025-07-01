import { getFeaturedKeys, computeFlatFeaturesLen, findGroupsFunc } from "./ml-utilities.js";
import { buildTrainX } from "./trainX.js";
import { areKeyValuesValid } from "../core-functions/pushToMain.js";

const algo = 'pca'

export const pca = (main, index, {prefix, trainingSize, findGroups, trainingCols, lookbackAbs, modelArgs, filterCallback}) => {

    const {verticalOhlcv, scaledGroups, len, instances, ML, invalidValueIndex} = main

    const startIndex = (invalidValueIndex + 2)
    const allModels = ML.models

    if(index === startIndex)
    {
        if(!instances.hasOwnProperty(algo)) instances[algo] = {}

        instances[algo][prefix] = {
            flatFeaturesColLen: 0,
            featureCols: [],
            X: []
        }
        
        verticalOhlcv[prefix] = new Array(len).fill(null)
        main.notNumberKeys.add(prefix)
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

        if(instances[algo][prefix].featureCols.length === 0)
        {
            const inputFeatures = [...trainingCols, ...(findGroupsFunc(findGroups, scaledGroups))]

            throw new Error(`Some of the provided ${prefix} features where not found in "verticalOhlcv": ${JSON.stringify(inputFeatures)}`)
        }

        //last execution
        for(const featureKey of instances[algo][prefix].featureCols)
        {
            if(!verticalOhlcv.hasOwnProperty(featureKey)) throw new Error(`Feature "${featureKey}" not found in verticalOhlcv for pca.`)
        }

        if(instances[algo][prefix].X.length < trainingSize)
        {
            const requiredDatapoints = instances[algo][prefix].X.length - trainingSize
            throw new Error(`The current "trainingSize" at "${prefix}" requires at least ${requiredDatapoints} more datapoints. Try adding more input ohlcv rows or reducing the "trainingSize" by ${requiredDatapoints}.`)
        }
    } 

    const dataSetInstance = instances[algo][prefix]

    if(dataSetInstance.flatFeaturesColLen === 0)
    {
        dataSetInstance.featureCols = getFeaturedKeys({trainingCols, findGroups, verticalOhlcv, scaledGroups})

        if(areKeyValuesValid(main, index, dataSetInstance.featureCols))
        {
            dataSetInstance.flatFeaturesColLen = computeFlatFeaturesLen(dataSetInstance.featureCols, verticalOhlcv, index)
        } else {
            return
        }
    }

    if(dataSetInstance.flatFeaturesColLen === 0) return
    
    const {X: xRows, featureCols, flatFeaturesColLen} = dataSetInstance

    const trainX = buildTrainX({featureCols, flatFeaturesColLen, type: algo, index, lookbackAbs, main})

    if (trainX == null) return

    if(allModels.hasOwnProperty(prefix))
    {

        const futureRow = allModels[prefix].predict([trainX]).to2DArray()

        verticalOhlcv[prefix][index] = futureRow[0]
    }

    xRows.push(trainX)

    if (xRows.length > trainingSize) xRows.shift()

    if(xRows.length === trainingSize)
    {
        allModels[prefix] = new ML.classes.PCA(xRows, modelArgs) 
    }
}