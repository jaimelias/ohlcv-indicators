import { FasterEMA } from 'trading-signals';

export const volumeOscillator = (main, index, fast, slow, {lag}) => {

    const {verticalOhlcv, instances} = main
    const value = verticalOhlcv.volume[index]
    const key = `volume_oscillator_${fast}_${slow}`

    if (index === 0) {

        const {len, arrayTypes} = main
        Object.assign(instances, {
            [key]: {
                fastEMA: new FasterEMA(fast),
                slowEMA: new FasterEMA(slow)
            }
        })

        verticalOhlcv[key] = new Float64Array(len).fill(NaN)

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
