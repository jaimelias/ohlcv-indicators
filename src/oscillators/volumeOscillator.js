import { FasterEMA } from 'trading-signals';
import { calcMagnitude } from '../utilities/numberUtilities.js';

export const volumeOscillator = (main, index, fast, slow, {scale}) => {

    const value = main.verticalOhlcv.volume[index]
    const key = 'volume_oscillator'

    if (index === 0) {

        Object.assign(main.instances, {
            volume_oscillator: {
                fastEMA: new FasterEMA(fast),
                slowEMA: new FasterEMA(slow)
            }
        })

        main.verticalOhlcv[key] = [...main.nullArray];
        main.crossPairsList.push({ fast: key, slow: 0, isDefault: true });
    }

    const { fastEMA, slowEMA } = main.instances[key];

    fastEMA.update(value, main.lastIndexReplace);
    slowEMA.update(value, main.lastIndexReplace);

    let fastValue = null;
    let slowValue = null;

    try {
        fastValue = fastEMA.getResult();
    } catch (err) {
        fastValue = null;
    }

    try {
        slowValue = slowEMA.getResult();
    } catch (err) {
        slowValue = null;
    }

    let volumeOscValue = null

    if(typeof fastValue === 'number' && typeof slowValue === 'number' && slowValue !== 0)
    {
        volumeOscValue = 100 * (fastValue - slowValue) / slowValue

        if(scale)
        {
            volumeOscValue = calcMagnitude(volumeOscValue, scale)
        }
    }

    main.pushToMain({index, key, value:  volumeOscValue})

    return true;
};
