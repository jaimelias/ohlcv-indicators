import { FasterEMA } from '../core-indicators/index.js';
import { mathLog } from '../utilities/math.js';
import { isPositiveInteger } from '../utilities/numberUtilities.js';
import { validateInputValues } from '../utilities/validators.js';
import { initializeColumns } from '../core-functions/initializeColumns.js';

export const volumeOscillator = (main, index, fast, slow, {lag, retLogs}) => {

    const {verticalOhlcv, instances} = main
    const key = retLogs ? `ret_log_volume_oscillator_${fast}_${slow}` : `volume_oscillator_${fast}_${slow}`

    if (index === 0) {
        validateInputValues({ volume: true }, verticalOhlcv, index, 'volumeOscillator');

        Object.assign(instances, {
            [key]: {
                fastEMA: new FasterEMA(fast),
                slowEMA: new FasterEMA(slow),
            }
        })

        initializeColumns(main, [{ key }], { lag });
    }

    const { fastEMA, slowEMA } = instances[key];

    const volume = verticalOhlcv.volume[index];

    if(volume === 0) {
        return;
    }

    fastEMA.update(volume);
    slowEMA.update(volume);

    const fastValue = fastEMA.isStable ? fastEMA.getResult() : NaN;
    const slowValue = slowEMA.isStable ? slowEMA.getResult() : NaN;

    let volumeOscValue = NaN
    let volumeOscRetLog = NaN

    if(Number.isNaN(fastValue) || Number.isNaN(slowValue)) {
        return;
    }

    volumeOscValue = retLogs
        ?  mathLog(fastValue, slowValue)
        : 100 * (fastValue - slowValue) / slowValue

    main.pushToMain({index, key, value:  volumeOscValue})
};
