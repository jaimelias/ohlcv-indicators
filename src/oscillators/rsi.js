import {FasterRSI} from 'trading-signals';
import { FasterSMA } from 'trading-signals';
import { calcMagnitude } from '../utilities/numberUtilities.js';

const defaultTarget = 'close'

export const rsi = (main, index, size, {scale, target}) => {
    
    const {verticalOhlcv, instances, lastIndexReplace} = main
    const suffix = (target === defaultTarget) ? '' : `_${target}`
    const rsiKey = `rsi_${size}${suffix}`
    const rsiSmaKey = `rsi_sma_${size}${suffix}`

    if(index === 0)
    {
        const {crossPairsList, nullArray} = main

        if(!verticalOhlcv.hasOwnProperty(target))
        {
            throw new Error(`Target property ${target} not found in verticalOhlcv for rsi.`)
        }

        crossPairsList.push({fast: rsiKey, slow: rsiSmaKey, isDefault: true})

        Object.assign(instances, {
            [rsiKey]: new FasterRSI(size),
            [rsiSmaKey]: new FasterSMA(size)
        })

        main.fillNulls([rsiKey, rsiSmaKey])
    }

    const value = verticalOhlcv[target][index]
    let currentRsi
    let smoothedRsi

    instances[rsiKey].update(value, lastIndexReplace)

    try
    {
        currentRsi = instances[rsiKey].getResult()
    } catch(err) {
        currentRsi = null
    }
    
    if(currentRsi)
    {
        if(scale)
        {
            currentRsi = calcMagnitude(currentRsi, scale)
        }

        main.pushToMain({index, key: rsiKey, value: currentRsi})
        instances[rsiSmaKey].update(currentRsi, lastIndexReplace)
    }

    try
    {
        smoothedRsi = instances[rsiSmaKey].getResult()
    } catch(err)
    {
        smoothedRsi = null
    }

    if(smoothedRsi)
    {
        if(scale)
        {
            smoothedRsi = calcMagnitude(smoothedRsi, scale)
        }

        main.pushToMain({index, key: rsiSmaKey, value: smoothedRsi})
    }
}