import { FasterBollingerBands } from 'trading-signals'
import { classifyBoll } from '../utilities/classification.js'

const diff = (a, b) => (a - b) / b

// crear una nueva instancia con la altura porcentual utilizando Bollinger Bands con una desviación estándar de 1.5
// Las diferencias estarán basadas en (objetivo - lower) / (upper - lower). Esto arrojará un valor entre -1 y 1


export const candleVectors = (main, index, size, {stdDev, patternSize, lag, scale, autoMinMax}) => {

    const { verticalOhlcv, instances, lastIndexReplace } = main
    const calcSize = (di, bo) => classifyBoll(di, bo, scale, autoMinMax)

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

                if(autoMinMax)
                {
                    main.autoMinMaxKeys.push(`candle_change_${x+1}_${currK}_${prevK}`)
                }
            }
        }
        

        const bodyVectorKeyNames = []
        const bodyVectorSetup = {}

        for(const [a, b] of bodyVectors)
        {
            bodyVectorKeyNames.push(`candle_body_${a}_${b}`)
            bodyVectorSetup[`candle_body_${a}_${b}`] = [...nullArray]

            if(autoMinMax)
            {
                main.autoMinMaxKeys.push(`candle_body_${a}_${b}`)
            }
        }

        const keyNames = [...bodyVectorKeyNames, ...lookBackVectorKeyNames]

        Object.assign(verticalOhlcv, {...bodyVectorSetup, ...lookBackVectorsSetup})

        Object.assign(instances, {
            candleVectors: {
                bodyVectors,
                lookBackVectors,
                keyNames,
                bodyInstance: new FasterBollingerBands(size, stdDev),      
            }
        })

        if(lag > 0)
        {
            main.lag(keyNames, lag)
        }
        
    }

    if (index === 0) return true


    const {bodyVectors, lookBackVectors, bodyInstance} = instances.candleVectors

    let bodyBoll = null
    const currOpen = verticalOhlcv.open[index]
    const currClose = verticalOhlcv.close[index]
    const bodySize = diff(currClose, currOpen)

    // Update instances with current absolute values
    bodyInstance.update(bodySize, lastIndexReplace)

    try {
        bodyBoll = bodyInstance.getResult()
    } catch (err) {
        // If there's not enough data, means remain null
    }


    for(let x = 0; x < bodyVectors.length; x++)
    {
        const [k2, k1] = bodyVectors[x]
        const v2 = verticalOhlcv[k2][index]
        const v1 = verticalOhlcv[k1][index]

        main.pushToMain({index, key: `candle_body_${k2}_${k1}`, value: calcSize(diff(v2, v1), bodyBoll)})
    }

    for(let x = 0; x < patternSize; x++)
    {
        for(const [currK, prevK] of lookBackVectors)
        {
            const currV = verticalOhlcv[currK][index]
            const prevV = verticalOhlcv[prevK][index-(x+1)]

            main.pushToMain({
                index, 
                key: `candle_change_${x+1}_${currK}_${prevK}`, 
                value: (typeof prevV === 'undefined') ? null : calcSize(diff(currV, prevV), bodyBoll)
            })
        }
    }

    return true
}


