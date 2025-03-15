import { FasterSMA, FasterBollingerBands } from 'trading-signals'
import { classifyBoll } from '../utilities/classification.js'

const diff = (a, b) => (a - b) / b

// crear una nueva instancia con la altura porcentual utilizando Bollinger Bands con una desviación estándar de 1.5
// Las diferencias estarán basadas en (objetivo - lower) / (upper - lower). Esto arrojará un valor entre -1 y 1


export const candleStudies = (main, index, size, stdDev, {lag, scale}) => {

    const { verticalOhlcv, instances, lastIndexReplace } = main

    if(index === 0)
    {
        const {nullArray} = main

        const candleVectors = [
            ['open', 'high'], ['open', 'low'], ['open', 'close'], 
            ['high', 'low'], ['high', 'close'], 
            ['low', 'close']
        ]

        const gapVectors = [
            ['open', 'open'],
            ['high', 'high'],
            ['low', 'low'],
            ['close', 'close']
        ]

        const candleVectorsSetup = Object.fromEntries(candleVectors.map(arr => [`candle_${arr[0]}_${arr[1]}`, [...nullArray]]))

        Object.assign(verticalOhlcv, {...candleVectorsSetup})

        Object.assign(instances, {
            candleStudies: {
                candleVectors,
                gapVectors,
                bodyInstance: new FasterBollingerBands(size, stdDev),      
            }
        })

        if(lag > 0)
        {
            main.lag(keyNames, lag)
        }
        
    }

    if (index === 0) return true


    const {candleVectors, gapVectors, bodyInstance} = instances.candleStudies

    let bodyBoll = null
    let heightValue = null

    const currOpen = verticalOhlcv.open[index]
    const currClose = verticalOhlcv.close[index]
    const bodySize = diff(currClose, currOpen)

    // Update instances with current absolute values
    bodyInstance.update(bodySize, lastIndexReplace)

    try {
        bodyBoll = bodyInstance.getResult()
        heightValue = diff(bodyBoll.upper, bodyBoll.lower)
    } catch (err) {
        // If there's not enough data, means remain null
    }


    for(let x = 0; x < candleVectors.length; x++)
    {
        const [k2, k1] = candleVectors[x]
        const v2 = verticalOhlcv[k2][index]
        const v1 = verticalOhlcv[k1][index]
        console.log(v1, v2)
        main.pushToMain({index, key: `candle_${k2}_${k1}`, value: classifyBoll(diff(v2, v1), bodyBoll, scale)})
    }

    return true
}


