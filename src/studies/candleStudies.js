import { FasterSMA, FasterBollingerBands } from 'trading-signals'
import { classifyBoll } from '../utilities/classification.js'

const diff = (a, b) => (a - b) / b

// crear una nueva instancia con la altura porcentual utilizando Bollinger Bands con una desviación estándar de 1.5
// Las diferencias estarán basadas en (objetivo - lower) / (upper - lower). Esto arrojará un valor entre -1 y 1


export const candleStudies = (main, index, size, {stdDev, patternSize, lag, scale}) => {

    const { verticalOhlcv, instances, lastIndexReplace } = main

    if(index === 0)
    {
        console.log({size, stdDev, patternSize, lag, scale})

        const {nullArray} = main

        const bodyVectors = [
            ['open', 'high'], ['open', 'low'], ['open', 'close'], 
            ['high', 'low'], ['high', 'close'], 
            ['low', 'close']
        ]

        const gapVectors = [
            ['open', 'open'],
            ['high', 'high'],
            ['low', 'low'],
            ['close', 'close'],
            ...bodyVectors
        ]

        const gapVectorKeyNames = []
        const gapVectorsSetup = {}

        for(let x = 0; x < patternSize; x++)
        {
            for(const [currK, prevK] of gapVectors)
            {
                gapVectorKeyNames.push(`candle_${x+1}_${currK}_${prevK}`)
                gapVectorsSetup[`candle_${x+1}_${currK}_${prevK}`] = [...nullArray]
            }
        }
        

        const bodyVectorKeyNames = []
        const bodyVectorSetup = {}

        for(const [a, b] of bodyVectors)
        {
            bodyVectorKeyNames.push(`candle_${a}_${b}`)
            bodyVectorSetup[`candle_${a}_${b}`] = [...nullArray]
        }

        const keyNames = [...bodyVectorKeyNames, ...gapVectorKeyNames]

        Object.assign(verticalOhlcv, {...bodyVectorSetup, ...gapVectorsSetup})

        Object.assign(instances, {
            candleStudies: {
                bodyVectors,
                gapVectors,
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


    const {bodyVectors, gapVectors, bodyInstance} = instances.candleStudies

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

        main.pushToMain({index, key: `candle_${k2}_${k1}`, value: classifyBoll(diff(v2, v1), bodyBoll, scale)})
    }

    for(let x = 0; x < patternSize; x++)
    {
        for(const [currK, prevK] of gapVectors)
        {
           
            const currV = verticalOhlcv[currK][index]
            const prevV = verticalOhlcv[prevK][index-(x+1)]

            if(typeof prevV === 'undefined')
            {
                main.pushToMain({index, key: `candle_${x+1}_${currK}_${prevK}`, value: null})
            } 
            else
            {
                main.pushToMain({index, key: `candle_${x+1}_${currK}_${prevK}`, value: classifyBoll(diff(currV, prevV), bodyBoll, scale)})
            }
        }
    }

    return true
}


