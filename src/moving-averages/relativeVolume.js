import {FasterSMA} from 'trading-signals';
import { calcMagnitude } from '../utilities/numberUtilities.js';

export const relativeVolume = (main, index, size = 10, {scale}) => {

    const key = `relative_volume_${size}`
    const {instances, verticalOhlcv, lastIndexReplace} = main

    if (index === 0) {

        const {nullArray} = main

        instances[key] = {
            instance: new FasterSMA(size),
            prevRelativeVolumeSma: null
        }

        Object.assign(verticalOhlcv, {
            [key]: [...nullArray],
        })
    }


    const value = verticalOhlcv.volume[index]
    
    const smaInstance = instances[key].instance
    smaInstance.update(value, lastIndexReplace)

    let smaValue;
    try {
        smaValue = smaInstance.getResult()

        
    } catch (err) {
        //do nothing
    }

    const {prevRelativeVolumeSma} = instances[key]

    let currRelativeVolume = null

    if(smaValue !== null && prevRelativeVolumeSma !== null && typeof smaValue !== 'undefined' && prevRelativeVolumeSma !== 'undefined')
    {
        currRelativeVolume = value / prevRelativeVolumeSma

        if(scale)
        {
            currRelativeVolume = calcMagnitude(currRelativeVolume, scale)
        }
    }

    main.pushToMain({
        index, 
        key,
        value: currRelativeVolume
    })

    instances[key].prevRelativeVolumeSma = smaValue

    return true;
};
