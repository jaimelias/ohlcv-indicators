import {FasterBollingerBands, FasterSMA} from 'trading-signals';
import { classifySize } from '../utilities/classification.js';

export const bollingerBands = (main, index, size, times, bollingerBandsStudies = false) => {

    const value = main.verticalOhlcv.close[index]

    if (index === 0) {

        Object.assign(main.instances, {
            bollinger_bands: {
                instance: new FasterBollingerBands(size, times),
                heightInstance: bollingerBandsStudies ? new FasterSMA(size) : null
            }
        })
        
        Object.assign(main.verticalOhlcv, {
            bollinger_bands_upper: [...main.nullArray],
            bollinger_bands_middle: [...main.nullArray],
            bollinger_bands_lower: [...main.nullArray],
            ...(bollingerBandsStudies && {
                bollinger_bands_range: [...main.nullArray],
                bollinger_bands_height: [...main.nullArray]
            })
        })
    }

    const { instance, heightInstance } = main.instances[`bollinger_bands`];
    instance.update(value, main.lastIndexReplace);

    let result;
    try {
        result = instance.getResult();
    } catch (err) {
       //do nothing
    }

    if(!result) return true

    const { upper, middle, lower } = result;
    main.verticalOhlcv.bollinger_bands_upper[index] = upper;
    main.verticalOhlcv.bollinger_bands_middle[index] = middle;
    main.verticalOhlcv.bollinger_bands_lower[index] = lower;

    if (!bollingerBandsStudies) return true;

    let range = null;
    let height = null;
    let heightMean;

    range = (value - lower) / (upper - lower);
    height = upper - lower;

    heightInstance.update(height, main.lastIndexReplace);

    try {
        heightMean = heightInstance.getResult();
    } catch (err) {
        //do nothing
    }

    main.verticalOhlcv.bollinger_bands_range[index] = range;

    if(heightMean)
    {
        main.verticalOhlcv.bollinger_bands_height[index] = classifySize(height, heightMean, 1.5);
    }
    
    return true;
};
