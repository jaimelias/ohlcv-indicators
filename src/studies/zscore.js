import { initializeColumns } from '../core-functions/initializeColumns.js';
import { copyConfig } from '../utilities/config.js';
import { validateBoolean, validateNumber } from '../utilities/validators.js';

const zscoreInstances = Symbol('zscoreInstances');

// Validate registration and imported jobs identically, without requiring targets
// to have usable values before their source indicators finish warming up.
export const validateZscoreParams = (rollingWindow, colKeys, options, len) => {
    copyConfig([rollingWindow, colKeys, options]);
    validateNumber(rollingWindow, { min: 1 }, 'rollingWindow', 'zscore');
    if (rollingWindow > len) {
        throw new RangeError('zscore rollingWindow must not exceed the input OHLCV length.');
    }
    if (!Array.isArray(colKeys) || colKeys.length === 0) {
        throw new TypeError('zscore colKeys must be a non-empty array of column names.');
    }
    const seen = new Set();
    for (const target of colKeys) {
        if (typeof target !== 'string' || target.length === 0) {
            throw new TypeError('zscore colKeys must contain non-empty column names.');
        }
        if (seen.has(target)) throw new Error(`Duplicate target "${target}" in zscore colKeys.`);
        seen.add(target);
    }
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('zscore options must be an object.');
    }
    for (const key of Object.keys(options)) {
        if (key !== 'lag' && key !== 'rowWise') {
            throw new Error(`Unsupported option "${key}" in "zscore"; only "lag" and "rowWise" are available.`);
        }
    }
    const { lag = 0, rowWise = false } = options;
    validateNumber(lag, { min: 0, max: len }, 'options.lag', 'zscore');
    validateBoolean(rowWise, 'options.rowWise', 'zscore');
    if (rowWise && rollingWindow !== 1) {
        throw new RangeError('zscore rowWise requires rollingWindow to equal 1.');
    }
    if (rowWise && colKeys.length < 2) {
        throw new RangeError('zscore rowWise requires at least two target columns.');
    }
    return { lag, rowWise };
};

const writeRowZscores = (main, index, targets, values) => {
    // Keep the comparison group fixed: a warming-up or invalid source makes
    // the whole row unavailable, without retaining that invalidity for later rows.
    for (let i = 0; i < targets.length; i++) {
        const { column, divisor } = targets[i];
        const current = column[index];
        if (!Number.isFinite(current)) return;
        const value = current / divisor;
        if (!Number.isFinite(value)) return;
        values[i] = value;
    }

    const origin = values[0];
    let meanOffset = 0;
    for (let i = 0; i < values.length; i++) {
        meanOffset += (values[i] - origin) / values.length;
    }
    let variance = 0;
    for (let i = 0; i < values.length; i++) {
        const deviation = (values[i] - origin) - meanOffset;
        variance += deviation * deviation / values.length;
    }
    if (!Number.isFinite(variance) || variance <= 0) return;

    const standardDeviation = Math.sqrt(variance);
    // Validate every result before writing any output, preserving all-or-nothing rows.
    for (let i = 0; i < values.length; i++) {
        const value = ((values[i] - origin) - meanOffset) / standardDeviation;
        if (!Number.isFinite(value)) return;
        values[i] = value;
    }
    for (let i = 0; i < targets.length; i++) {
        main.pushToMain({ index, key: targets[i].key, value: values[i] });
    }
};

export const zscore = (main, index, rollingWindow = 200, colKeys, options = {}) => {
    const { instances, verticalOhlcv } = main;

    if (index === 0) {
        const { lag, rowWise } = validateZscoreParams(rollingWindow, colKeys, options, main.len);
        if (!instances[zscoreInstances]) instances[zscoreInstances] = new Map();
        if (instances[zscoreInstances].has(rollingWindow)) {
            throw new Error(`zscore with rollingWindow ${rollingWindow} is already registered.`);
        }

        const targets = colKeys.map(target => {
            if (!Object.prototype.hasOwnProperty.call(verticalOhlcv, target)) {
                throw new Error(`Target column "${target}" not found in verticalOhlcv for "zscore".`);
            }
            return {
                key: `zscore_${rollingWindow}_${target}`,
                column: verticalOhlcv[target],
                count: 0,
                // Row comparisons must not mix fixed-point price units with
                // unscaled features. Do not truncate fractional indicator values.
                divisor: rowWise && main.precision && main.priceBased.has(target)
                    ? main.precisionMultiplier : 1
            };
        });
        initializeColumns(main, targets.map(({ key }) => ({ key })), { lag });
        instances[zscoreInstances].set(rollingWindow, {
            targets,
            rowWise,
            values: rowWise ? new Float64Array(targets.length) : null
        });
    }

    const { targets, rowWise, values } = instances[zscoreInstances].get(rollingWindow);
    if (rowWise) {
        writeRowZscores(main, index, targets, values);
        return;
    }

    for (const state of targets) {
        const { key, column } = state;
        const current = column[index];
        if (!Number.isFinite(current)) {
            state.count = 0;
            continue;
        }
        if (state.count < rollingWindow) state.count++;
        if (state.count < rollingWindow) continue;

        // Read the existing source column rather than duplicating its history.
        // Two centered passes avoid sum-of-squares cancellation and running-sum drift.
        const start = index - rollingWindow + 1;
        const origin = column[start];
        let meanOffset = 0;
        for (let row = start; row <= index; row++) {
            meanOffset += (column[row] - origin) / rollingWindow;
        }
        let variance = 0;
        for (let row = start; row <= index; row++) {
            const deviation = (column[row] - origin) - meanOffset;
            variance += deviation * deviation / rollingWindow;
        }
        if (!Number.isFinite(variance) || variance <= 0) continue;

        const value = ((current - origin) - meanOffset) / Math.sqrt(variance);
        if (Number.isFinite(value)) main.pushToMain({ index, key, value });
    }
};
