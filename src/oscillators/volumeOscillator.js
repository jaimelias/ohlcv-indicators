import { FasterEMA } from 'trading-signals';

export const volumeOscillator = (main, index, fast, slow, {lag}) => {

    const {verticalOhlcv, instances} = main
    const value = verticalOhlcv.volume[index]
    const key = 'volume_oscillator'

    if (index === 0) {

        const {crossPairsList, len, arrayTypes} = main
        Object.assign(instances, {
            volume_oscillator: {
                fastEMA: new FasterEMA(fast),
                slowEMA: new FasterEMA(slow)
            }
        })

        verticalOhlcv[key] = new Float64Array(len).fill(NaN)
        crossPairsList.push({ fast: key, slow: 0, isDefault: true })

        if(lag > 0)
        {
            main.lag([key], lag)
        }

        arrayTypes[key] = 'Float64Array'
    }

    const { fastEMA, slowEMA } = instances[key];

    fastEMA.update(value);
    slowEMA.update(value);

    let fastValue = NaN;
    let slowValue = NaN;

    try {
        fastValue = fastEMA.getResult();
    } catch (err) {
        
    }

    try {
        slowValue = slowEMA.getResult();
    } catch (err) {

    }

    let volumeOscValue = NaN

    if(!Number.isNaN(fastValue) && !Number.isNaN(slowValue))
    {
        volumeOscValue = 100 * (fastValue - slowValue) / slowValue
    }

    main.pushToMain({index, key, value:  volumeOscValue})

    return true;
};
