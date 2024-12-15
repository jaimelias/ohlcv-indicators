import {FasterSMA} from 'trading-signals';

export const relativeVolume = (main, index, size = 10) => {

    const value = main.verticalOhlcv.volume[index]

    if (index === 0) {
        main.instances[`relative_volume_${size}`] = new FasterSMA(size);

        Object.assign(main.verticalOhlcv, {
            [`relative_volume_${size}`]: new Array(main.len).fill(null),
            [`relative_volume_sma_${size}`]: new Array(main.len).fill(null)
        })
    }

    const smaInstance = main.instances[`relative_volume_${size}`]
    smaInstance.update(value)

    let smaValue;
    try {
        smaValue = smaInstance.getResult()
    } catch (err) {
        //do nothing
    }

    main.verticalOhlcv[`relative_volume_sma_${size}`][index] = smaValue;

    if (smaValue !== null && typeof main.verticalOhlcv[`relative_volume_sma_${size}`][index - 1] === 'number') {
        main.verticalOhlcv[`relative_volume_${size}`][index] = value / main.verticalOhlcv[`relative_volume_sma_${size}`][index - 1];
    } else {
        main.verticalOhlcv[`relative_volume_${size}`][index] = null;
    }

    return true;
};
