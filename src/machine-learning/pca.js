import { PCA } from "ml-pca";

export const pca = main => {

    const {inputParams, instances} = main

    for(const row of inputParams)
    {
        const {key: indicatorName, params} = row

        if(indicatorName !== 'scaler') continue

        const [size, keyNames, options] = params

        const {type, group, range, lag} = options

        const scaledKeyNames = keyNames.map(v => `${type}_${size}_${v}`)
        const laggedKeys = []

        for (const k of scaledKeyNames) {
            for (let step = 1; step <= lag; step++) {
                laggedKeys.push(`${k}_lag_${step}`)
            }
        }

        scaledKeyNames.push(...laggedKeys)

        console.log({indicatorName, scaledKeyNames})

    }

}