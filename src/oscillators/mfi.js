import { mathLog } from '../utilities/math.js';
import { validateInputValues } from '../utilities/validators.js';
import { initializeColumns } from '../core-functions/initializeColumns.js';

export const mfi = (main, index, size, { lag, retLogs }) => {
    const { verticalOhlcv, instances } = main;
    const key = `${retLogs ? 'ret_log_' : ''}mfi_${size}`;

    if (index === 0) {
        validateInputValues({ high: true, low: true, close: true, volume: true }, verticalOhlcv, index, 'mfi');
        // Raw and logged variants own separate state, even at the same period.
        initializeColumns(main, [{ key }], { lag });
        instances[key] = {
            flows: new Float64Array(size),
            next: 0,
            count: 0,
            previousTypical: NaN
        };
    }

    const state = instances[key];
    const typical = (verticalOhlcv.high[index] + verticalOhlcv.low[index] + verticalOhlcv.close[index]) / 3;
    const change = typical - state.previousTypical;
    state.previousTypical = typical;

    // The first candle seeds the comparison; a size-period MFI needs size + 1 rows.
    if (index === 0) return;

    const flow = typical * verticalOhlcv.volume[index];
    // A tie is neutral, but an invalid comparison must not silently become zero.
    // Zero-volume candles contribute zero and still advance the candle window.
    state.flows[state.next] = Number.isFinite(change) && Number.isFinite(flow) && flow >= 0
        ? Math.sign(change) * flow : NaN;
    state.next = (state.next + 1) % size;
    if (state.count < size) state.count++;
    if (state.count < size) return;

    // Sum oldest to newest: bounded storage, no accumulated subtraction drift,
    // and invalid values recover naturally after leaving the window.
    let positive = 0;
    let negative = 0;
    let slot = state.next;
    for (let step = 0; step < size; step++) {
        const value = state.flows[slot];
        if (Number.isNaN(value)) return;
        if (value > 0) positive += value;
        else if (value < 0) negative -= value;
        if (++slot === size) slot = 0;
    }

    if (!Number.isFinite(positive) || !Number.isFinite(negative)) return;
    // No directional money flow gives an undefined ratio, not a neutral signal.
    const value = positive === 0 && negative === 0
        ? NaN : 100 - 100 / (1 + positive / negative);
    main.pushToMain({ index, key, value: Number.isNaN(value) ? NaN : retLogs ? mathLog(value, 50) : value });
};
