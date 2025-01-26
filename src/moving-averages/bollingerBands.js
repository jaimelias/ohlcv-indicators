import {FasterBollingerBands, FasterSMA} from 'trading-signals';
import { classifySize } from '../utilities/classification.js';

let defaultTarget = 'close'

export const bollingerBands = (main, index, size, times, options) => {

    const {height, range, target} = options
    let suffix = (target === defaultTarget) ? '' : `_${target}`

    if (index === 0) {

        if(!main.verticalOhlcv.hasOwnProperty(target))
        {
            throw new Error(`bollingerBands could not find target "${target}"`)
        }

        Object.assign(main.instances, {
            [`bollinger_bands${suffix}`]: {
                instance: new FasterBollingerBands(size, times),
                heightInstance: height ? new FasterSMA(size) : null
            }
        })
        
        Object.assign(main.verticalOhlcv, {
            [`bollinger_bands_upper${suffix}`]: [...main.nullArray],
            [`bollinger_bands_middle${suffix}`]: [...main.nullArray],
            [`bollinger_bands_lower${suffix}`]: [...main.nullArray],
            ...(height && {
                [`bollinger_bands_height${suffix}`]: [...main.nullArray]
            }),
            ...(range && {
                [`bollinger_bands_range${suffix}`]: [...main.nullArray],
            })
        })
    }

    
    const { instance, heightInstance } = main.instances[`bollinger_bands${suffix}`]
    const value = main.verticalOhlcv[target][index]
    instance.update(value, main.lastIndexReplace)

    let result;
    try {
        result = instance.getResult();
    } catch (err) {
       //do nothing
    }

    if(!result) return true

    const { upper, middle, lower } = result;
    main.verticalOhlcv[`bollinger_bands_upper${suffix}`][index] = upper;
    main.verticalOhlcv[`bollinger_bands_middle${suffix}`][index] = middle;
    main.verticalOhlcv[`bollinger_bands_lower${suffix}`][index] = lower;

    if (!height && !range) return true;

    let heightMean;
    const rangeValue = (value - lower) / (upper - lower);
    const heightValue = upper - lower;

    heightInstance.update(heightValue, main.lastIndexReplace);

    try {
        heightMean = heightInstance.getResult();
    } catch (err) {
        //do nothing
    }

    main.verticalOhlcv[`bollinger_bands_range${suffix}`][index] = rangeValue;

    if(heightMean)
    {
        main.verticalOhlcv[`bollinger_bands_height${suffix}`][index] = classifySize(heightValue, heightMean, 1.5);
    }
    
    return true;
};
