import { initializeColumns } from '../core-functions/initializeColumns.js';
import { validateInputValues } from '../utilities/validators.js';

export const cmf = (main, index, size, options = {}) => {
    const { verticalOhlcv, instances } = main;
    const { lag = 0 } = options;
    const key = `cmf_${size}`;

    if (index === 0) {
        // CMF is bounded and already centered on zero. A log ratio has no
        // valid zero reference; a signed log1p changes its magnitudes without
        // a mathematical need before downstream feature scaling.
        const unsupportedOption = Object.keys(options).find(name => name !== 'lag');
        if (unsupportedOption) throw new Error(`Unsupported option "${unsupportedOption}" in "cmf"; only "lag" is available.`);

        validateInputValues({ high: true, low: true, close: true, volume: true }, verticalOhlcv, index, 'cmf');
        initializeColumns(main, [{ key }], { lag });
        instances[key] = {
            moneyFlowVolumes: new Float64Array(size),
            volumes: new Float64Array(size),
            next: 0,
            count: 0
        };
    }

    const state = instances[key];
    const high = verticalOhlcv.high[index];
    const low = verticalOhlcv.low[index];
    const close = verticalOhlcv.close[index];
    const volume = verticalOhlcv.volume[index];
    const range = high - low;

    let moneyFlowVolume = NaN;
    let windowVolume = NaN;

    // Invalid or malformed candles occupy a window slot and keep CMF unavailable
    // until they roll out. A flat candle has a neutral multiplier of zero.
    if (
        Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close) &&
        Number.isFinite(volume) && volume >= 0 && high >= low &&
        close >= low && close <= high && Number.isFinite(range)
    ) {
        const multiplier = range === 0 ? 0 : ((close - low) - (high - close)) / range;
        const flow = multiplier * volume;
        if (Number.isFinite(multiplier) && Number.isFinite(flow)) {
            moneyFlowVolume = flow;
            windowVolume = volume;
        }
    }

    state.moneyFlowVolumes[state.next] = moneyFlowVolume;
    state.volumes[state.next] = windowVolume;
    state.next = (state.next + 1) % size;
    if (state.count < size) state.count++;
    if (state.count < size) return;

    // Sum in chronological order and retain only this fixed-size window.
    let totalMoneyFlowVolume = 0;
    let totalVolume = 0;
    let slot = state.next;
    for (let step = 0; step < size; step++) {
        const flow = state.moneyFlowVolumes[slot];
        const candleVolume = state.volumes[slot];
        if (!Number.isFinite(flow) || !Number.isFinite(candleVolume)) return;
        totalMoneyFlowVolume += flow;
        totalVolume += candleVolume;
        if (++slot === size) slot = 0;
    }

    // A zero-volume window has no defined ratio. A zero CMF from positive
    // volume is valid and remains at the neutral center.
    if (!Number.isFinite(totalMoneyFlowVolume) || !Number.isFinite(totalVolume) || totalVolume === 0) return;

    const value = totalMoneyFlowVolume / totalVolume;
    if (!Number.isFinite(value)) return;

    main.pushToMain({ index, key, value });
};
