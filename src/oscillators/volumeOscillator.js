import { FasterEMA } from 'trading-signals';

export const volumeOscillator = (main, index, fast, slow, {lag}) => {

    const {verticalOhlcv, instances, lastIndexReplace} = main
    const value = verticalOhlcv.volume[index]
    const key = 'volume_oscillator'

    if (index === 0) {

        const {crossPairsList, nullArray} = main
        Object.assign(instances, {
            volume_oscillator: {
                fastEMA: new FasterEMA(fast),
                slowEMA: new FasterEMA(slow)
            }
        })

        verticalOhlcv[key] = [...nullArray];
        crossPairsList.push({ fast: key, slow: 0, isDefault: true });

        if(lag > 0)
        {
            main.lag([key], lag)
        }
    }

    const { fastEMA, slowEMA } = instances[key];

    fastEMA.update(value, lastIndexReplace);
    slowEMA.update(value, lastIndexReplace);

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
    }

    main.pushToMain({index, key, value:  volumeOscValue})

    return true;
};
