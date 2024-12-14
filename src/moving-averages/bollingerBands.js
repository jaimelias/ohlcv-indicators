import {FasterBollingerBands, FasterSMA} from 'trading-signals';
import { classifySize } from '../utilities/classification.js';

export const bollingerBands = (main, index, size, times, bollingerBandsStudies = false) => {

    const value = main.verticalOhlcv.close[index]

    if (!main.instances.hasOwnProperty(`bollinger_bands`)) {

        Object.assign(main.instances, {bollinger_bands: {
            instance: new FasterBollingerBands(size, times),
            heightInstance: bollingerBandsStudies ? new FasterSMA(size) : null
        }})


        Object.assign(main.verticalOhlcv, {
            bollinger_bands_upper: new Array(main.len).fill(null),
            bollinger_bands_middle: new Array(main.len).fill(null),
            bollinger_bands_lower: new Array(main.len).fill(null)
        })

        if (bollingerBandsStudies) {

            Object.assign(main.verticalOhlcv, {
                bollinger_bands_range: new Array(main.len).fill(null),
                bollinger_bands_height: new Array(main.len).fill(null),
            })
        }
    }

    const { instance, heightInstance } = main.instances[`bollinger_bands`];
    instance.update(value);

    let result;
    try {
        result = instance.getResult();
    } catch (err) {
        result = { upper: null, middle: null, lower: null };
    }

    const { upper, middle, lower } = result;
    main.verticalOhlcv[`bollinger_bands_upper`][index] = upper;
    main.verticalOhlcv[`bollinger_bands_middle`][index] = middle;
    main.verticalOhlcv[`bollinger_bands_lower`][index] = lower;

    if (!bollingerBandsStudies) return true;

    let range = null;
    let height = null;
    let heightMean;

    if (upper !== null && lower !== null) {
        range = (value - lower) / (upper - lower);
        height = upper - lower;

        heightInstance.update(height);

        try {
            heightMean = heightInstance.getResult();
        } catch (err) {
            heightMean = null;
        }
    }

    main.verticalOhlcv[`bollinger_bands_range`][index] = range;
    main.verticalOhlcv[`bollinger_bands_height`][index] = classifySize(height, heightMean, 1.5);

    return true;
};
