import { getFeaturedKeys, computeFlatFeaturesLen } from "./ml-utilities.js";
import { buildTrainX } from "./trainX.js";

export const pca = (main, index, {keyName, trainingSize, findGroups, trainingCols, lookbackAbs, modelArgs, order}) => {

    if(index + 1 > main.len) return

    const {verticalOhlcv, scaledGroups, invalidValueIndex, len, instances, ML} = main
    const allModels = ML.models
    const type = 'pca'

    if((index + 1) === (invalidValueIndex + 1))
    {
         const featureCols = getFeaturedKeys({trainingCols, findGroups, verticalOhlcv, scaledGroups, type})

         verticalOhlcv[keyName] = new Array(len).fill(null)

         if(!instances.hasOwnProperty('pca')) instances.pca = {}

        const flatFeaturesColLen = computeFlatFeaturesLen(featureCols, instances, type, verticalOhlcv, index)

        instances.pca[keyName] = {
            flatFeaturesColLen,
            featureCols,
            X: []
        }

        main.notNumberKeys.add(keyName)
    }

    // --- EARLY EXIT IF NOT ENOUGH HISTORY ---
    if (index < lookbackAbs) return;

    const dataSetInstance = instances.pca[keyName]
    const {X: xRows, featureCols, flatFeaturesColLen} = dataSetInstance

    const trainX = buildTrainX({featureCols, flatFeaturesColLen, type, index, lookbackAbs, verticalOhlcv})

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