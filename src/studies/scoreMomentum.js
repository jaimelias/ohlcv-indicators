import { initializeColumns } from '../core-functions/initializeColumns.js';
import { copyConfig } from '../utilities/config.js';
import { mathLog } from '../utilities/math.js';
import { validateInputValues } from '../utilities/validators.js';

export const DEFAULT_LOOKBACKS = Object.freeze([
    Object.freeze({ sessions: 21, weight: 0.10 }),
    Object.freeze({ sessions: 63, weight: 0.30 }),
    Object.freeze({ sessions: 126, weight: 0.40 }),
    Object.freeze({ sessions: 252, weight: 0.20 })
]);

const MIN_WEIGHT = 0.1;
const MAX_WEIGHT = 1;
const MAX_WEIGHT_SUM = 1;
const EPSILON = 1e-9;
const scoreMomentumStates = Symbol('scoreMomentumStates');

// Shared by public registration and row-zero initialization for config replay.
export const validateScoreMomentumParams = lookbacks => {
    copyConfig(lookbacks);

    if (!Array.isArray(lookbacks) || lookbacks.length === 0) {
        throw new TypeError('lookbacks must be a non-empty array.');
    }

    const seenSessions = new Set();
    let weightSum = 0;

    for (const [index, item] of lookbacks.entries()) {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
            throw new TypeError(`lookbacks[${index}] must be an object.`);
        }

        const { sessions, weight } = item;
        if (!Number.isInteger(sessions) || sessions < 1) {
            throw new RangeError(`lookbacks[${index}].sessions must be a positive integer, got ${sessions}.`);
        }
        if (seenSessions.has(sessions)) {
            throw new RangeError(`lookbacks[${index}].sessions is duplicated: ${sessions}.`);
        }
        if (typeof weight !== 'number' || !Number.isFinite(weight)) {
            throw new TypeError(`lookbacks[${index}].weight must be a finite number, got ${weight}.`);
        }
        if (weight < MIN_WEIGHT - EPSILON || weight > MAX_WEIGHT + EPSILON) {
            throw new RangeError(`lookbacks[${index}].weight must be between ${MIN_WEIGHT} and ${MAX_WEIGHT}, got ${weight}.`);
        }

        seenSessions.add(sessions);
        weightSum += weight;
    }

    if (weightSum > MAX_WEIGHT_SUM + EPSILON) {
        throw new RangeError(`The sum of weights must not exceed ${MAX_WEIGHT_SUM}, got ${weightSum}.`);
    }
};

export const scoreMomentum = (main, index, lookbacks = DEFAULT_LOOKBACKS) => {
    const { verticalOhlcv, instances } = main;

    if (index === 0) {
        validateScoreMomentumParams(lookbacks);
        validateInputValues({ close: true }, verticalOhlcv, index, 'scoreMomentum');

        let maxSessions = 0;
        for (const { sessions } of lookbacks) maxSessions = Math.max(maxSessions, sessions);

        const useIndexedKey = main.useFullNames || main.inputParams.filter(job => job.key === 'scoreMomentum').length > 1;
        const suffix = useIndexedKey
            ? `_${lookbacks.map(({ sessions, weight }) => `${sessions}_${weight}`).join('_')}` : '';
        const key = `score_momentum${suffix}`;

        // Allocation rejects duplicate output keys before sharing runtime state.
        initializeColumns(main, [{ key }]);
        if (!instances[scoreMomentumStates]) instances[scoreMomentumStates] = new WeakMap();
        instances[scoreMomentumStates].set(lookbacks, { key, maxSessions });
    }

    const { key, maxSessions } = instances[scoreMomentumStates].get(lookbacks);
    // N sessions compare today's close with index - N, requiring N + 1 rows.
    if (index < maxSessions) return;

    const closes = verticalOhlcv.close;
    const currentClose = closes[index];
    if (!Number.isFinite(currentClose) || currentClose <= 0) return;

    let score = 0;
    for (const { sessions, weight } of lookbacks) {
        const previousClose = closes[index - sessions];
        const ratio = currentClose / previousClose;
        // Preserve NaN for invalid inputs and unrepresentable ratios; do not
        // let mathLog's zero/sign handling change the positive-close formula.
        if (!Number.isFinite(previousClose) || previousClose <= 0 || !Number.isFinite(ratio) || ratio <= 0) return;
        score += weight * mathLog(currentClose, previousClose);
    }

    if (Number.isFinite(score)) main.pushToMain({ index, key, value: score });
};
