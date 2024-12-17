import {FasterSMA} from 'trading-signals';

export const relativeVolume = (main, index, size = 10) => {

    const value = main.verticalOhlcv.volume[index]

    if (index === 0) {
        main.instances[`relative_volume_${size}`] = {
            instance: new FasterSMA(size),
            prevRelativeVolumeSma: null
        }

        Object.assign(main.verticalOhlcv, {
            [`relative_volume_${size}`]: [...main.nullArray],
        })
    }

    const smaInstance = main.instances[`relative_volume_${size}`].instance
    smaInstance.update(value, main.lastIndexReplace)

    let smaValue;
    try {
        smaValue = smaInstance.getResult()
    } catch (err) {
        //do nothing
    }

    const {prevRelativeVolumeSma} = main.instances[`relative_volume_${size}`]

    if (smaValue !== null && prevRelativeVolumeSma !== null) {
        main.verticalOhlcv[`relative_volume_${size}`][index] = value / prevRelativeVolumeSma;
    } else {
        main.verticalOhlcv[`relative_volume_${size}`][index] = null;
    }


    main.instances[`relative_volume_${size}`].prevRelativeVolumeSma = smaValue

    return true;
};
