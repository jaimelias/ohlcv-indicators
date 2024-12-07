import { FasterEMA } from 'trading-signals'
import { findCrosses } from "../studies/findCrosses.js";


export const volumeOscillator = (main, fastPeriod = 5, slowPeriod = 10) => {
    const { verticalOhlcv } = main;
    const { volume } = verticalOhlcv;

    return getVolumeOscillator(volume, fastPeriod, slowPeriod);

}

export const getVolumeOscillator = (volume, fastPeriod, slowPeriod) => {
    const fastEMA = new FasterEMA(fastPeriod)
    const slowEMA = new FasterEMA(slowPeriod)
    const volume_oscillator = new Array(volume.length).fill(null)

    for (let i = 0; i < volume.length; i++) {

        fastEMA.update(volume[i])
        slowEMA.update(volume[i])

        let fastValue = null
        let slowValue = null

        try {
            fastValue = fastEMA.getResult()
        } catch (err) {
            fastValue = null
        }

        try {
            slowValue = slowEMA.getResult()
        } catch (err) {
            slowValue = null
        }

        if (typeof fastValue === 'number' && typeof slowValue === 'number' && slowValue !== 0) {

            volume_oscillator[i] = 100 * (fastValue - slowValue) / slowValue
        }
    }

    const volume_oscillator_x_0 = findCrosses({fast: volume_oscillator, slow: new Array(volume.length).fill(0)})

    return {volume_oscillator, volume_oscillator_x_0}
}