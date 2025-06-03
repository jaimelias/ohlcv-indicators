import { PCA } from "ml-pca";

export const pca = main => {

    const {inputParams, invalidValueIndex, len, verticalOhlcv} = main
    const startIndex = invalidValueIndex + 1

    for(const rowParams of inputParams)
    {
        const {key: indicatorName, params} = rowParams

        if(indicatorName !== 'scaler') continue

        const [size, keyNames, options] = params

        const {type, group, lag, pca: pcaBoolean} = options

        if(!group || !pcaBoolean) continue

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

        for (const key of scaledKeyNames) {
            delete verticalOhlcv[key]
        }

        const pca = new PCA(tempArr)
        const predictions = [...pca.predict(tempArr)]

        const verticalKey = `pca_${type}_${size}`
        verticalOhlcv[verticalKey] = new Array(len).fill(null)

        for(let x = 0; x < predictions.length; x++)
        {
            verticalOhlcv[verticalKey][x + startIndex + 1] = predictions[x]
        }

    }

}