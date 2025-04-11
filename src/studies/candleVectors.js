const diff = (a, b) => (a - b)

import { calcZScore } from "../utilities/classification.js"

export const candleVectors = (main, index, size, {patternSize, lag}) => {

    const { verticalOhlcv, instances, lastIndexReplace } = main

    if(index === 0)
    {
        const {nullArray} = main

        const bodyVectors = [

            ['close', 'open'], ['close', 'high'], ['close', 'low'],
            ['open', 'high'], ['open', 'low'], 
            ['high', 'low']
            
        ]

        //curr vs prev
        const lookBackVectors = [
            ['open', 'open'],
            ['high', 'high'],
            ['low', 'low'],
            ['close', 'close'],
            ...bodyVectors
        ]

        const lookBackVectorKeyNames = []
        const lookBackVectorsSetup = {}

        for(let x = 0; x < patternSize; x++)
        {
            for(const [currK, prevK] of lookBackVectors)
            {
                lookBackVectorKeyNames.push(`candle_change_${x+1}_${currK}_${prevK}`)
                lookBackVectorsSetup[`candle_change_${x+1}_${currK}_${prevK}`] = [...nullArray]
            }
        }
        

        const bodyVectorKeyNames = []
        const bodyVectorSetup = {}

        for(const [a, b] of bodyVectors)
        {
            bodyVectorKeyNames.push(`candle_body_${a}_${b}`)
            bodyVectorSetup[`candle_body_${a}_${b}`] = [...nullArray]
        }

        const keyNames = [...bodyVectorKeyNames, ...lookBackVectorKeyNames]

        Object.assign(verticalOhlcv, {...bodyVectorSetup, ...lookBackVectorsSetup})

        Object.assign(instances, {
            candleVectors: {
                bodyVectors,
                lookBackVectors,
                keyNames,
                arrayChunk: {...Object.fromEntries(keyNames.map(v => [v, []]))}  
            }
        })

        if(lag > 0)
        {
            main.lag(keyNames, lag)
        }
        
    }

    const {bodyVectors, lookBackVectors, arrayChunk} = instances.candleVectors

    for(let x = 0; x < bodyVectors.length; x++)
    {
        const [k2, k1] = bodyVectors[x]
        const v2 = verticalOhlcv[k2][index]
        const v1 = verticalOhlcv[k1][index]
        const key = `candle_body_${k2}_${k1}`
        const difference = diff(v2, v1)

        const zScore = calcZScore(arrayChunk, key, size, difference, lastIndexReplace)
    
        main.pushToMain({index, key, value: zScore})
    }

    for(let x = 0; x < patternSize; x++)
    {
        for(const [currK, prevK] of lookBackVectors)
        {
            const currV = verticalOhlcv[currK][index]
            const prevV = verticalOhlcv[prevK][index-(x+1)]
            const key = `candle_change_${x+1}_${currK}_${prevK}`

            if(typeof prevV === 'undefined')
            {
                main.pushToMain({index, key, value: null})
                continue
            }

            const difference = diff(currV, prevV)
            const zScore = calcZScore(arrayChunk, key, size, difference, lastIndexReplace)
    
            main.pushToMain({index, key, value: zScore})
        }
    }

    return true
}


