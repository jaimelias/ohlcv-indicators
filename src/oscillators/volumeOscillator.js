import { FasterEMA } from 'trading-signals';
import { mathLog } from '../utilities/math.js';
import { isPositiveInteger } from '../utilities/numberUtilities.js';

export const volumeOscillator = (main, index, fast, slow, {lag, retLogs}) => {

    const {verticalOhlcv, instances} = main
    const key = `volume_oscillator_${fast}_${slow}`

    if (index === 0) {

        const {len} = main
        Object.assign(instances, {
            [key]: {
                fastEMA: new FasterEMA(fast),
                slowEMA: new FasterEMA(slow),
                hasInvalidVolumeValue: false
            }
        })

        const keyNames = (retLogs) ? [key, `ret_log_${key}`]: [key];

        const verticalOhlcvSetup = Object.fromEntries(keyNames.map(k => [k, new Float64Array(len).fill(NaN)]));

        Object.assign( verticalOhlcv, verticalOhlcvSetup);

        if(lag > 0)
        {
            main.lag(keyNames, lag)
        }
    }

    const { fastEMA, slowEMA, hasInvalidVolumeValue } = instances[key];

    const volume = verticalOhlcv.volume[index];

    if(hasInvalidVolumeValue) {
        return;
    }
    if(!isPositiveInteger(volume)) {
        instances[key].hasInvalidVolumeValue = true;
        return;
    };

    

    fastEMA.update(volume);
    slowEMA.update(volume);

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
    let volumeOscRetLog = NaN

    if(Number.isNaN(fastValue) || Number.isNaN(slowValue)) {
        return;
    }

    volumeOscValue = 100 * (fastValue - slowValue) / slowValue

    if(retLogs) {
        volumeOscRetLog = mathLog(fastValue, slowValue)
        main.pushToMain({index, key: `ret_log_${key}`, value:  volumeOscRetLog})
    }

    main.pushToMain({index, key, value:  volumeOscValue})

    return true;
};
