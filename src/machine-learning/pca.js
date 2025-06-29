import { getFeaturedKeys, computeFlatFeaturesLen, findGroupsFunc } from "./ml-utilities.js";
import { buildTrainX } from "./trainX.js";
import { areKeyValuesValid } from "../core-functions/pushToMain.js";

export const pca = (main, index, {keyName, trainingSize, findGroups, trainingCols, lookbackAbs, modelArgs, order}) => {

    
    const {verticalOhlcv, scaledGroups, len, instances, ML, invalidValueIndex} = main

    const startIndex = (invalidValueIndex + 2)
    const allModels = ML.models
    const type = 'pca'
    

    if(index === startIndex)
    {
        if(!instances.hasOwnProperty('pca')) instances.pca = {}

        instances.pca[keyName] = {
            flatFeaturesColLen: 0,
            featureCols: [],
            X: []
        }
        
        verticalOhlcv[keyName] = new Array(len).fill(null)
        main.notNumberKeys.add(keyName)
    }
    else if(index < startIndex || index < lookbackAbs)
    {
        return
    }
    else if(index + 1 === len) 
    {

        if(instances.pca[keyName].featureCols.length === 0)
        {
            const inputFeatures = [...trainingCols, ...(findGroupsFunc(findGroups, scaledGroups))]

            throw new Error(`Some of the provided ${type} features where not found in "verticalOhlcv": ${JSON.stringify(inputFeatures)}`)
        }

        //last execution
        for(const featureKey of instances.pca[keyName].featureCols)
        {
            if(!verticalOhlcv.hasOwnProperty(featureKey)) throw new Error(`Feature "${featureKey}" not found in verticalOhlcv for pca.`)
        }
    }

    const dataSetInstance = instances.pca[keyName]

    if(dataSetInstance.flatFeaturesColLen === 0)
    {
        dataSetInstance.featureCols = getFeaturedKeys({trainingCols, findGroups, verticalOhlcv, scaledGroups})

        if(areKeyValuesValid(main, index, dataSetInstance.featureCols))
        {
            dataSetInstance.flatFeaturesColLen = computeFlatFeaturesLen(dataSetInstance.featureCols, instances, type, verticalOhlcv, index)
        } else {
            return
        }
    }

    if(dataSetInstance.flatFeaturesColLen === 0) return
    
    const {X: xRows, featureCols, flatFeaturesColLen} = dataSetInstance


    const trainX = buildTrainX({featureCols, flatFeaturesColLen, type, index, lookbackAbs, main})

    if (trainX == null) return

    if(allModels.hasOwnProperty(keyName))
    {

        const futureRow = allModels[keyName].predict([trainX]).to2DArray()

        verticalOhlcv[keyName][index] = futureRow[0]
    }

    xRows.push(trainX)
    if (xRows.length > trainingSize) xRows.shift()

    if(xRows.length === trainingSize)
    {
        allModels[keyName] = new ML.classes.PCA(xRows, modelArgs) 
    }
}