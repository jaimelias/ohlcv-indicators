import {FasterSMA} from 'trading-signals';

export const relativeVolume = (main, index, size = 10) => {

    const key = `relative_volume_${size}`

    if (index === 0) {
        main.instances[key] = {
            instance: new FasterSMA(size),
            prevRelativeVolumeSma: null
        }

        Object.assign(main.verticalOhlcv, {
            [key]: [...main.nullArray],
        })
    }


    const value = main.verticalOhlcv.volume[index]
    
    const smaInstance = main.instances[key].instance
    smaInstance.update(value, main.lastIndexReplace)

    let smaValue;
    try {
        smaValue = smaInstance.getResult()

        
    } catch (err) {
        //do nothing
    }

    const {prevRelativeVolumeSma} = main.instances[key]

    main.pushToMain({
        index, 
        key,
        value: (smaValue !== null && prevRelativeVolumeSma !== null) ? value / prevRelativeVolumeSma : null
    })

    main.instances[key].prevRelativeVolumeSma = smaValue

    return true;
};
