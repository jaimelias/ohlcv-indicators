import { PCA } from "ml-pca";
import { validateBoolean, validateArrayOptions, validateNumber } from "../utilities/validators.js";

export const pca = main => {

    const {inputParams, invalidValueIndex, len, verticalOhlcv} = main
    const startIndex = invalidValueIndex + 1

    for(const rowParams of inputParams)
    {
        const {key: indicatorName, params} = rowParams

        if(indicatorName !== 'scaler') continue

        const [size, keyNames, options] = params

        const {type, group, lag, pca: pcaOptions} = options

        const {
            showSource = false,
            storeModel = false,
            isCovarianceMatrix = false,
            method = 'NIPALS', //SVD, covarianceMatrix or NIPALS
            center = true,
            scale = false,
            nCompNIPALS = 2,
            ignoreZeroVariance = false
        } = pcaOptions

        if(!group || pcaOptions === null) continue

        validateBoolean(showSource, 'showSource', 'scaler.options.pca.showSource')
        validateBoolean(storeModel, 'storeModel', 'scaler.options.pca.storeModel')
        validateBoolean(isCovarianceMatrix, 'isCovarianceMatrix', 'scaler.options.pca.isCovarianceMatrix')
        validateBoolean(center, 'center', 'scaler.options.pca.center')
        validateBoolean(scale, 'scale', 'scaler.options.pca.scale')
        validateBoolean(ignoreZeroVariance, 'ignoreZeroVariance', 'scaler.options.pca.ignoreZeroVariance')
        validateArrayOptions(['SVD', 'NIPALS', 'covarianceMatrix'], method, 'scaler.options.pca.method')
        validateNumber(nCompNIPALS, {min: 1}, 'nCompNIPALS', 'scaler.options.pca.nCompNIPALS')

        const scaledKeyNames = keyNames.map(v => `${type}_${size}_${v}`)
        const laggedKeys = []

        for (const k of scaledKeyNames) {
            for (let step = 1; step <= lag; step++) {
                laggedKeys.push(`${k}_lag_${step}`)
            }
        }

        scaledKeyNames.push(...laggedKeys)

        const diffLen = len - startIndex
        const numCols = scaledKeyNames.length
        const tempArr = new Array(diffLen)

        for (let i = startIndex; i < len; i++) {

            const row = new Float64Array(numCols);

            let j = 0

            for (const key of scaledKeyNames) {
                row[j++] = verticalOhlcv[key][i]
            }

            tempArr[i - startIndex] = row
        }

        if(!showSource)
        {
            for (const key of scaledKeyNames) {
                delete verticalOhlcv[key]
            }
        }

        const verticalKey = `pca_${type}_${size}`

        const pca = new PCA(tempArr, {
            isCovarianceMatrix,
            method,
            center,
            scale,
            nCompNIPALS,
            ignoreZeroVariance
        })

        if(storeModel)
        {
            main.models[verticalKey] = pca.toJSON()
        }
        
        const predictions = pca.predict(tempArr).to2DArray()

        verticalOhlcv[verticalKey] = new Array(len).fill(null)

        for(let x = 0; x < predictions.length; x++)
        {
            verticalOhlcv[verticalKey][x + startIndex] = predictions[x]
        }

    }

}