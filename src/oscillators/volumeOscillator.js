import { FasterEMA } from 'trading-signals';

export const volumeOscillator = (main, index, fast, slow) => {

    const value = main.verticalOhlcv.volume[index]

    if (index === 0) {

        Object.assign(main.instances, {
            volume_oscillator: {
                fastEMA: new FasterEMA(fast),
                slowEMA: new FasterEMA(slow)
            }
        })

        main.verticalOhlcv[`volume_oscillator`] = new Array(main.len).fill(null);
        main.crossPairsList.push({ fast: `volume_oscillator`, slow: 0 });
    }

    const { fastEMA, slowEMA } = main.instances[`volume_oscillator`];

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

    if (typeof fastValue === 'number' && typeof slowValue === 'number' && slowValue !== 0) {
        main.verticalOhlcv[`volume_oscillator`][index] = 100 * (fastValue - slowValue) / slowValue
    } else {
        main.verticalOhlcv[`volume_oscillator`][index] = null;
    }

    return true;
};
