import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import OHLCV_INDICATORS from '../index.js'
import * as Core from '../src/core-indicators/index.js'
import { addPrecisionAsNumber, revertPrecisionAsNumber } from '../src/utilities/precisionMultiplier.js'

// npm test: offline deterministic regressions.
// npm test -- --baseline /path/to/pre-change/index.js --benchmark --rows 10000 --repeats 7
// npm test -- --live: original Nasdaq smoke test (requires its market-data service).
const args = process.argv.slice(2)
const option = name => {
    const index = args.indexOf(name)
    if (index === -1) return undefined
    assert.ok(args[index + 1] && !args[index + 1].startsWith('--'), `${name} requires a value`)
    return args[index + 1]
}
const makeInput = (length = 320, precision = false) => Array.from({ length }, (_, index) => {
    const open = 100 + index / 100 + Math.sin(index / 7) * 3
    const close = open + Math.cos(index / 3) * 1.5
    const price = value => precision ? value.toFixed(4) : Number(value.toFixed(4))
    return {
        date: new Date(Date.UTC(2024, 0, 1, 1, 15) + index * 3600000).toISOString(),
        open: price(open), high: price(Math.max(open, close) + 2),
        low: price(Math.min(open, close) - 2), close: price(close),
        volume: index > 0 && index % 37 === 0 ? 0 : 1000 + index % 29 * 17,
        note: `row-${index}`, flag: index % 2 === 0, extra: index / 10
    }
})
const mapCallback = ({ index, main, params }) => ({
    custom_value: index === 17 ? null : main.verticalOhlcv.close[index] * params.factor,
    custom_vector: index === 19 ? undefined : [index % 2, (index + 1) % 2]
})
const configure = (Ctor, input, { precision = false, retLogs = false, chunkProcess = 100, includeMfi = true } = {}) => {
    Ctor.registerMapCallback('test.optimizations.v1', mapCallback)
    const main = new Ctor({ input, chunkProcess, config: { precision, useFullNames: retLogs, timeZone: 'America/Panama', dateFormat: 'iso', skipNull: false } })
        .ema(5, { lag: 2 }).ema(9, { target: 'open' }).sma(7, { lag: 1 })
        .bollingerBands(8, 2, { lag: 1 }).macd(4, 9, 3, { lag: 1 })
        .relativeVolume(6, { lag: 2 }).volumeDelta({ lag: 1 }).volumeOscillator(3, 8, { retLogs, lag: 2 })
        .rsi(7, { retLogs, lag: 1 }).stochastic(7, 3, 3, { retLogs, lag: 1 })
        .atr(7, { retLogs, lag: 1 }).adx(7, { retLogs, lag: 1 })
        .heikenAshi(null, null, { retLogs, lag: 1 }).heikenAshi(3, 4, { retLogs })
        .donchianChannels(1, 0, { lag: 1 }).donchianChannels(8, 2, { lag: 2 }).donchianChannels(31, 9)
        .dateTime({ oneHot: retLogs, lag: 1 }).candleFeatures({ colKeys: ['close'], retLogs, lag: 1 })
        .crossPairs([{ fast: 'close', slow: 'open' }, { fast: 'price', slow: 100 }], { limit: 5, oneHot: true })
        .mapCols(['custom_value', 'custom_vector'], 'test.optimizations.v1', { callbackParams: { factor: 2 }, lag: 2 })
        .lag(['close', 'volume'], 2).lag(['close_lag_1'], 2).lag(['one_hot_close_x_open'], 1)
    if (includeMfi) main.mfi(7, { retLogs, lag: 1 })
    return main
}
const deepFreeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value) }
    return value
}
// Observe results/metadata/types, not the intentionally changed runtime cache layout.
const snapshot = main => ({
    columns: structuredClone(main.verticalOhlcv),
    types: Object.entries(main.verticalOhlcv).map(([key, values]) => [key, values.constructor.name]),
    keys: [...main.verticalOhlcvKeyNames], temp: [...main.verticalOhlcvTempCols],
    priceBased: [...main.priceBased], scaledGroups: structuredClone(main.scaledGroups),
    invalidValueIndex: main.invalidValueIndex, config: main.exportConfig(),
    rows: main.getData({ skipNull: false, dateFormat: 'object' }),
    validRows: main.getData({ skipNull: true, dateFormat: 'iso' }), last: main.getLastValues({ dateFormat: 'seconds' })
})
// Keep the old shift-based algorithm as an independent oracle, including its
// NaN comparisons (Math.max/Math.min would have different invalid-value behavior).
const referenceDonchian = (highs, lows, size, offset) => {
    const max = [], min = [], upper = [], lower = [], basis = []
    for (let index = 0; index < highs.length; index++) {
        upper.push(NaN); lower.push(NaN); basis.push(NaN)
        const current = index - offset, start = current - size + 1
        if (current < 0 || current >= highs.length) continue
        while (max.length && max[0] < start) max.shift()
        while (max.length && highs[max.at(-1)] <= highs[current]) max.pop()
        max.push(current)
        while (min.length && min[0] < start) min.shift()
        while (min.length && lows[min.at(-1)] >= lows[current]) min.pop()
        min.push(current)
        if (start < 0) continue
        upper[index] = highs[max[0]]; lower[index] = lows[min[0]]; basis[index] = (upper[index] + lower[index]) / 2
    }
    return { upper, lower, basis }
}

// Use independent full windows and the original three-log geometric definition.
const referenceBollinger = (closes, size, stdDev) => Array.from(closes, (_, index) => {
    if (index < size) return { upper: NaN, middle: NaN, lower: NaN }
    const window = Array.from(closes.slice(index - size + 1, index + 1))
    const middle = window.reduce((sum, value) => sum + value, 0) / size
    const deviation = Math.sqrt(window.reduce((sum, value) => sum + (value - middle) ** 2, 0) / size) * stdDev
    return { upper: middle + deviation, middle, lower: middle - deviation }
})
const referenceChannelLogs = (upper, lower, close) => {
    if (!Number.isFinite(upper) || !Number.isFinite(lower) || lower <= 0 || upper < lower || !Number.isFinite(upper / lower)) {
        return { width: NaN, position: NaN }
    }
    const logUpper = Math.log(upper), logLower = Math.log(lower)
    const width = (logUpper - logLower) / 2
    const ratio = close / lower
    const position = width > 0 && Number.isFinite(close) && close > 0 && Number.isFinite(ratio) && ratio > 0
        ? (Math.log(close) - (logUpper + logLower) / 2) / width : NaN
    return { width, position: Number.isFinite(position) ? position : NaN }
}
const assertNear = (actual, expected, label, tolerance = 1e-10) => {
    if (Number.isNaN(expected)) assert.ok(Number.isNaN(actual), `${label}: expected NaN, received ${actual}`)
    else assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
        `${label}: expected ${expected}, received ${actual}`)
}

// Independent full-history/window oracle: do not share the handler's ring state.
const referenceMfi = (columns, size, retLogs = false) => {
    const typical = Array.from(columns.close, (_, index) =>
        (columns.high[index] + columns.low[index] + columns.close[index]) / 3)
    const flows = typical.map((value, index) => {
        if (index === 0) return NaN
        const difference = value - typical[index - 1], money = value * columns.volume[index]
        if (!Number.isFinite(difference) || !Number.isFinite(money) || money < 0) return NaN
        return difference > 0 ? money : difference < 0 ? -money : 0
    })
    return flows.map((_, index) => {
        if (index < size) return NaN
        const window = flows.slice(index - size + 1, index + 1)
        if (window.some(Number.isNaN)) return NaN
        let positive = 0, negative = 0
        for (const value of window) {
            if (value > 0) positive += value
            else if (value < 0) negative -= value
        }
        if (!Number.isFinite(positive) || !Number.isFinite(negative)) return NaN
        if (positive === 0 && negative === 0) return NaN
        const value = negative === 0 ? 100 : positive === 0 ? 0 : 100 - 100 / (1 + positive / negative)
        return retLogs ? Math.log((value === 0 ? 0.001 : value) / 50) : value
    })
}
const mfiInput = (prices, volumes = prices.map(() => 1), precision = false) => prices.map((price, index) => {
    const value = precision ? String(price) : price
    return { open: value, high: value, low: value, close: value, volume: volumes[index] }
})

// One independent registration per public indicator/study. The combined chain
// above remains useful for detecting interactions between different handlers.
const indicatorCases = [
    { name: 'ema', register: (m, o) => m.ema(5, o), keys: logs => [`${logs ? 'ret_log_' : ''}ema_5`], warmup: 4 },
    { name: 'sma', register: (m, o) => m.sma(5, o), keys: logs => [`${logs ? 'ret_log_' : ''}sma_5`], warmup: 4 },
    { name: 'bollingerBands', register: (m, o) => m.bollingerBands(8, 2, o),
        // Preserve the existing first bands after size + 1 updates.
        keys: logs => logs ? ['width', 'position'].map(k => `ret_log_bollinger_bands_${k}`)
            : ['upper', 'middle', 'lower'].map(k => `bollinger_bands_${k}`), warmup: 8 },
    { name: 'macd', register: (m, o) => m.macd(4, 9, 3, o),
        keys: () => ['diff', 'dea', 'histogram'].map(k => `macd_${k}`) },
    { name: 'relativeVolume', register: (m, o) => m.relativeVolume(6, o),
        keys: logs => [`${logs ? 'ret_log_' : ''}relative_volume_6`], warmup: 6 },
    { name: 'volumeDelta', register: (m, o) => m.volumeDelta(o),
        keys: () => ['high', 'low', 'close', 'cross'].map(k => `volume_delta_${k}`) },
    { name: 'volumeOscillator', register: (m, o) => m.volumeOscillator(3, 8, o),
        keys: logs => [`${logs ? 'ret_log_' : ''}volume_oscillator_3_8`], warmup: 7 },
    { name: 'rsi', register: (m, o) => m.rsi(7, o),
        keys: logs => ['rsi_7', 'rsi_sma_7'].map(k => `${logs ? 'ret_log_' : ''}${k}`) },
    { name: 'mfi', register: (m, o) => m.mfi(7, o), keys: logs => [`${logs ? 'ret_log_' : ''}mfi_7`], warmup: 7 },
    { name: 'stochastic', register: (m, o) => m.stochastic(7, 3, 3, o),
        keys: logs => ['d', 'k'].map(k => `${logs ? 'ret_log_' : ''}stochastic_${k}_7_3_3`) },
    { name: 'atr', register: (m, o) => m.atr(7, o), keys: logs => [`${logs ? 'ret_log_' : ''}atr_7`] },
    { name: 'adx', register: (m, o) => m.adx(7, o), keys: logs => [`${logs ? 'ret_log_' : ''}adx_7`] },
    { name: 'heikenAshi', register: (m, o) => m.heikenAshi(null, null, o),
        keys: logs => [...['body', 'upper_wick', 'lower_wick', 'range'].map(k => `${logs ? 'ret_log_' : 'ret_'}heiken_ashi_${k}`), 'heiken_ashi_cross'] },
    { name: 'donchianChannels', register: (m, o) => m.donchianChannels(8, 2, o),
        keys: logs => logs ? ['width', 'position'].map(k => `ret_log_donchian_channel_${k}`)
            : ['upper', 'basis', 'lower'].map(k => `donchian_channel_${k}`), warmup: 9 },
    { name: 'dateTime', register: (m, o) => m.dateTime({ lag: o.lag, oneHot: o.retLogs }),
        keys: oneHot => oneHot
            ? ['month', 'day_of_the_month', 'day_of_the_week', 'hour', 'minute'].map(k => `one_hot_${k}`)
            : ['month', 'day_of_the_month', 'day_of_the_week', 'hour', 'minute', 'year'] },
    { name: 'candleFeatures', register: (m, o) => m.candleFeatures({ ...o, colKeys: ['close'] }),
        keys: logs => ['change', 'mid_price_change', 'upper_wick', 'lower_wick', 'gap', 'body', 'range', 'close'].map(k => `${logs ? 'ret_log_' : 'ret_'}${k}`), warmup: 1 },
    { name: 'crossPairs', register: (m, o) => m.crossPairs([{ fast: 'close', slow: 'open' }], { limit: 5, oneHot: o.retLogs }),
        keys: oneHot => ['close_x_open', ...(oneHot ? ['one_hot_close_x_open'] : [])], autoLag: false },
    { name: 'mapCols', register: (m, o) => m.mapCols(['change'], null, { lag: o.lag }), keys: () => ['change'], warmup: 1 },
    { name: 'lag', register: m => m.lag(['close', 'volume'], 2),
        keys: () => ['close_lag_1', 'close_lag_2', 'volume_lag_1', 'volume_lag_2'], autoLag: false }
]

const coreCases = [
    ...['FasterEMA', 'FasterSMA', 'FasterWSMA', 'FasterRSI'].map(name => ({ name, create: (lib, size) => new lib[name](size) })),
    ...['FasterTR', 'FasterATR', 'FasterDX', 'FasterADX'].map(name => ({ name, candle: true, create: (lib, size) => new lib[name](size) })),
    { name: 'FasterBollingerBands', create: (lib, size) => new lib.FasterBollingerBands(size, 2) },
    { name: 'FasterMACD', create: (lib, size) => new lib.FasterMACD(new lib.FasterEMA(size), new lib.FasterEMA(size + 2), new lib.FasterEMA(3)) },
    { name: 'FasterStochasticOscillator', candle: true, create: (lib, size) => new lib.FasterStochasticOscillator(size, 3, 2) }
]
const readCoreResult = instance => {
    try { return { value: instance.getResult() } }
    catch (error) { return { error: error.name, message: error.message } }
}
const retainedStorage = (value, seen = new Set()) => {
    if (value === null || typeof value !== 'object' || seen.has(value)) return { slots: 0, bytes: 0 }
    seen.add(value)
    if (ArrayBuffer.isView(value)) return { slots: 0, bytes: value.byteLength }
    const total = { slots: Array.isArray(value) ? value.length : 0, bytes: 0 }
    for (const item of Object.values(value)) {
        const storage = retainedStorage(item, seen)
        total.slots += storage.slots; total.bytes += storage.bytes
    }
    return total
}

// Fixed pre-optimization snapshots, not recomputed from the implementation under test.
// Each digest covers every update/readiness/result/extrema observation below.
// Number encoding preserves IEEE-754 values, including -0 and non-finite values;
// undefined is tagged rather than silently dropped by JSON serialization.
const traceValue = (hash, value) => hash.update(JSON.stringify(value, (_, item) => {
    if (item === undefined) return { undefined: true }
    if (typeof item === 'number') {
        if (Number.isNaN(item)) return { number: 'NaN' }
        const bytes = Buffer.allocUnsafe(8)
        bytes.writeDoubleBE(item)
        return { float64: bytes.toString('hex') }
    }
    return item
}))
const traceState = instance => [instance.isStable, readCoreResult(instance),
    ...['highest', 'lowest', 'previousResult', 'pdi', 'mdi'].map(key => instance[key])]
const coreTrace = (lib, test) => {
    const hash = createHash('sha256')
    for (const size of [1, 2, 7, 32]) for (const pattern of ['mixed', 'zero', 'invalid', 'coercion']) for (const replacements of [false, true]) {
        const instance = test.create(lib, size)
        traceValue(hash, [size, pattern, replacements, traceState(instance)])
        let previousObject, previousSnapshot
        for (let index = 0; index < 180; index++) {
            // Binary-exact inputs avoid platform differences in transcendental functions.
            let value = pattern === 'zero' ? (index % 2 ? -0 : 0) : 100 + (index % 23 - 11) / 8 + index / 256
            if (pattern === 'invalid') {
                if (index === 13) value = NaN
                if (index === 41) value = Infinity
                if (index === 83) value = -Infinity
            }
            if (pattern === 'coercion') {
                if (index === 9) value = null
                if (index === 10) value = undefined
                if (index === 11) value = '2'
                if (index === 12) value = true
                if (index === 13) value = '3'
            }
            const input = test.candle ? { high: value + 2, low: value - 2, close: value } : value
            const actual = instance.update(input, replacements && index % 5 === 0)
            traceValue(hash, [actual, traceState(instance)])
            if (actual && typeof actual === 'object') {
                if (previousObject) {
                    assert.notStrictEqual(actual, previousObject)
                    assert.deepStrictEqual(previousObject, previousSnapshot)
                }
                previousObject = actual; previousSnapshot = { ...actual }
            }
        }
    }
    return hash.digest('hex')
}
const candleMutationTrace = (lib, test) => {
    const hash = createHash('sha256'), instance = test.create(lib, 3)
    const candles = [{ high: 4, low: 1, close: 2 }, { high: 5, low: 2, close: 3 }]
    for (let index = 0; index < 80; index++) {
        const candle = candles[index % 2]
        candle.high = 100 + index; candle.low = 90 + index; candle.close = 95 + index
        traceValue(hash, [instance.update(candle), traceState(instance)])
    }
    return hash.digest('hex')
}
const batchReplacementTrace = (lib, name) => {
    const hash = createHash('sha256'), instance = new lib[name](3)
    traceValue(hash, [instance.updates([1, , 2, 3, 4]), traceState(instance)])
    for (const value of [0, NaN, 7, -0]) traceValue(hash, [instance.replace(value), traceState(instance)])
    return hash.digest('hex')
}
// Captured from the untouched local core before the runtime-allocation upgrade.
// These constants are intentionally not regenerated by npm test or --baseline.
const coreGolden = {
    FasterEMA: { trace: '78ab81db0dfead350fe56bb3954b0daa5cdefa3106c2a8e0da74dfd680f5f7f8', batch: '151b515d79fa9df1c4a0e107d4499fc5a8ee28a2713f3f51de0bef8f19d50a52' },
    FasterSMA: { trace: 'bcfc82bc43e647da69bdec38c6c42a4606d393af582e2c583616f065866f23e8', batch: '54804fe1d0439cf6f050298fc5bb8e35633df78751c5878d0b1cd9e3c1c61a78' },
    FasterWSMA: { trace: '875a98e2e03267d4af5ad7fb73d54f9bfd57b9e7289c34dc0e452249b6d065e0', batch: 'db6bb9608a9796bc73395259c7faa506994dcb8cfcbcb20ac55a6eba85e135b7' },
    FasterRSI: { trace: 'f6ac351918308e9c3242ed2da9fa67b49c4d51308e7d288f311eaa3710d4c4ed' },
    FasterTR: { trace: '648182a18eedea9f52658b9223029f514edfdcb83c53eacb4b757c8a7b3288d0', mutation: 'd9ed0b39278293e54fd6f170c3956327e2f38e76c8562ff28bde8bb03319233b' },
    FasterATR: { trace: 'd5d85c88d26d7f61c066eb7561ad0735a20a11b9f6380e175b820f845ea9a5c4', mutation: '6ba2e5337c05b61bcec38f0f7abd366ce84576a4813e36847e287476644aa85a' },
    FasterDX: { trace: '87aaf629d97a65e39c71312c6a73c9349bbf6f86ab390e8cd1f4b6381079e1ca', mutation: 'da5b536cec355236455d19c7104fae1791573304b66c4729b91bc4e6fbcb6c5b' },
    FasterADX: { trace: '20c42d867ed187c7d153f019e27404780e29e91a312814dcde7b7c0d66ad0768', mutation: '7cd635bf30ec272f24b335a884f4c386eacbe6699b3c07810117e451c33419a6' },
    FasterBollingerBands: { trace: 'de88f538a1761f8e441e18232961432eb09a37d729a513fa7d88975a088614f9' },
    FasterMACD: { trace: '963a46f587757bc1d2f759a2334aa5d9e7ce6796e94719eb349cb821e08da6ba' },
    FasterStochasticOscillator: { trace: '3f31db0f8601f19e7be61069bb8b6bad2faf89b73c4545ce212269206024eec5', mutation: 'ef88bce5c228f29c5f511a5f5e28ed620b7b10936eaa79179d4b1b6a6bb2fed3' }
}

const runRegressions = Baseline => {
    let passed = 0
    const check = (name, callback) => { callback(); console.log(`PASS ${name}`); passed++ }
    check('core known values, exact warm-up, signed zero and invalid-window recovery', () => {
        const ema = new Core.FasterEMA(3), sma = new Core.FasterSMA(3), wsma = new Core.FasterWSMA(3)
        assert.throws(() => ema.getResult(), { name: 'NotEnoughDataError' })
        assert.deepStrictEqual([1, 2, 3, 4].map(value => ema.update(value)), [1, 1.5, 2.25, 3.125])
        assert.deepStrictEqual([1, 2, 3, 4].map(value => sma.update(value)), [undefined, undefined, 2, 3])
        assert.deepStrictEqual([1, 2, 3, 8].map(value => wsma.update(value)), [undefined, undefined, 2, 4])
        assert.equal(ema.isStable, true)
        sma.update(NaN); sma.update(5); assert.ok(Number.isNaN(sma.getResult()))
        sma.update(6); assert.ok(Number.isNaN(sma.getResult()))
        assert.equal(sma.update(7), 6)
        const rsi = new Core.FasterRSI(3)
        assert.deepStrictEqual([1, 2, 3, 4].map(value => rsi.update(value)), [undefined, undefined, undefined, 100])
        const bands = new Core.FasterBollingerBands(3)
        assert.deepStrictEqual([1, 2, 3].map(value => bands.update(value)), [undefined, undefined, undefined])
        assert.deepStrictEqual(bands.update(4), { lower: 3 - Math.sqrt(2 / 3) * 2, middle: 3, upper: 3 + Math.sqrt(2 / 3) * 2 })
        const tr = new Core.FasterTR()
        assert.equal(tr.update({ high: 4, low: 1, close: 2 }), 3)
        assert.equal(tr.update({ high: 8, low: 5, close: 6 }), 6)
        const zero = new Core.FasterEMA(1)
        assert.ok(Object.is(zero.update(-0), -0))
    })
    for (const test of coreCases) check(`core ${test.name}: fixed pre-change traces`, () => {
        assert.equal(coreTrace(Core, test), coreGolden[test.name].trace, `${test.name}: update/readiness/result/extrema trace changed`)
    })
    check('core storage stays bounded and Wilder smoothing releases its seed window', () => {
        for (const test of coreCases) {
            const instance = test.create(Core, 32)
            let warmedStorage
            for (let index = 0; index < 8192; index++) {
                const value = 100 + Math.sin(index / 7)
                instance.update(test.candle ? { high: value + 2, low: value - 2, close: value } : value)
                if (index === 511) warmedStorage = retainedStorage(instance)
            }
            assert.deepStrictEqual(retainedStorage(instance), warmedStorage, `${test.name}: retained storage grows with history`)
        }
        const wsma = new Core.FasterWSMA(32)
        wsma.updates(Array.from({ length: 32 }, (_, index) => index))
        assert.equal(wsma.isStable, true)
        assert.deepStrictEqual(retainedStorage(wsma), { slots: 0, bytes: 0 })
        const rsi = new Core.FasterRSI(32)
        for (let index = 0; index < 10000; index++) rsi.update(100 + index % 17)
        assert.deepStrictEqual(retainedStorage(rsi), { slots: 0, bytes: 0 })
    })
    check('core candle windows retain reference semantics, including reused objects', () => {
        for (const test of coreCases.filter(test => test.candle)) {
            assert.equal(candleMutationTrace(Core, test), coreGolden[test.name].mutation, `${test.name}: mutable candle trace changed`)
        }
    })
    check('core batch and replacement helpers preserve readiness and extrema', () => {
        for (const name of ['FasterEMA', 'FasterSMA', 'FasterWSMA']) {
            assert.equal(batchReplacementTrace(Core, name), coreGolden[name].batch, `${name}: sparse batch/replacement trace changed`)
        }
    })
    check('coverage includes every public indicator method', () => {
        const lifecycle = new Set(['constructor', '_registerIndicator', 'exportConfig', 'compute', 'getData', 'getLastValues'])
        const methods = Object.getOwnPropertyNames(OHLCV_INDICATORS.prototype).filter(name => !lifecycle.has(name))
        assert.deepStrictEqual(indicatorCases.map(test => test.name).sort(), methods.sort())
    })
    for (const test of indicatorCases) for (const precision of [false, true]) for (const retLogs of [false, true]) {
        check(`${test.name} individually: precision=${precision}, ${retLogs ? 'lagged/log/one-hot' : 'plain'} options`, () => {
            const input = makeInput(160, precision), options = { lag: retLogs ? 2 : 0, retLogs }
            const create = Ctor => test.register(new Ctor({ input, chunkProcess: 100,
                config: { precision, timeZone: 'UTC', skipNull: false } }), options)
            const main = create(OHLCV_INDICATORS), before = main.exportConfig()
            assert.equal(before.inputParams.length, 1)
            assert.equal(before.inputParams[0].key, test.name)
            main.compute()
            const v = main.verticalOhlcv, baseKeys = test.keys(retLogs)
            const expectedKeys = test.autoLag === false ? baseKeys : [
                ...baseKeys, ...baseKeys.flatMap(key => Array.from({ length: options.lag }, (_, i) => `${key}_lag_${i + 1}`))
            ]
            const inputKeys = new Set([...Object.keys(input[0]), 'mid_price'])
            assert.deepStrictEqual(Object.keys(v).filter(key => !inputKeys.has(key)).sort(), [...expectedKeys].sort())
            for (const key of expectedKeys) {
                const column = v[key]
                assert.equal(column.length, input.length, `${key}: column length`)
                const last = column.at(-1)
                if (key.startsWith('one_hot_')) {
                    assert.ok(last instanceof Uint8Array, `${key}: one-hot storage`)
                    assert.equal(last.reduce((sum, value) => sum + value, 0), 1)
                } else assert.ok(Number.isFinite(last), `${key}: terminal value must be finite`)
                const lagMatch = /^(.*)_lag_(\d+)$/.exec(key)
                if (lagMatch) {
                    const source = v[lagMatch[1]], step = Number(lagMatch[2])
                    assert.equal(Array.isArray(column), Array.isArray(source), `${key}: lag type`)
                    for (let index = 0; index < input.length; index++) {
                        const value = index < step || source[index - step] == null
                            ? Array.isArray(column) ? null : NaN : source[index - step]
                        assert.strictEqual(column[index], value, `${key}[${index}]: lag value/identity`)
                    }
                }
            }
            if (test.warmup !== undefined) for (const key of baseKeys) {
                assert.equal(v[key].findIndex(Number.isFinite), test.warmup, `${key}: first valid row`)
            }
            if (['relativeVolume', 'volumeDelta', 'volumeOscillator'].includes(test.name)) {
                for (let index = 0; index < input.length; index++) if (input[index].volume === 0) {
                    for (const key of baseKeys) assert.ok(Number.isNaN(v[key][index]), `${key}: zero-volume row`)
                }
            }
            const rows = main.getData({ skipNull: false })
            assert.deepStrictEqual(main.getData({ skipNull: true }), rows.slice(main.invalidValueIndex + 1))
            assert.deepStrictEqual(main.getLastValues(), rows.at(-1))
            assert.deepStrictEqual(main.exportConfig(), before)
            const replay = new OHLCV_INDICATORS({ input, config: deepFreeze(JSON.parse(JSON.stringify(before))) })
            assert.deepStrictEqual(snapshot(replay), snapshot(main))
            assert.throws(() => test.register(main, options), /already computed/)
            // A pre-MFI baseline still exercises every previously supported method.
            if (Baseline && (test.name !== 'mfi' || typeof Baseline.prototype.mfi === 'function')) {
                assert.deepStrictEqual(snapshot(main), snapshot(create(Baseline).compute()))
            }
        })
    }
    check('EMA/SMA known values and target-relative logs preserve warm-up and raw arithmetic', () => {
        const prices = [10, 20, 30, 40, 20, 10]
        const expected = { ema: [NaN, NaN, 22.5, 31.25, 25.625, 17.8125], sma: [NaN, NaN, 20, 30, 30, 70 / 3] }
        for (const precision of [false, true]) for (const method of ['ema', 'sma']) {
            const main = new OHLCV_INDICATORS({ input: mfiInput(prices, undefined, precision), config: { precision } })
                [method](3)[method](3, { retLogs: true }).compute()
            const key = `${method}_3`, v = main.verticalOhlcv
            const scale = precision ? main.precisionMultiplier : 1
            const raw = method === 'ema' ? expected.ema.map(value => value * scale)
                : [NaN, NaN, ...[60, 90, 90, 70].map(sum => sum * scale / 3)]
            assert.deepStrictEqual(Array.from(v[key]), raw)
            assert.deepStrictEqual(Array.from(v[`ret_log_${key}`]), prices.map((price, index) => Math.log(price * scale / raw[index])))
            assert.equal(v[`ret_log_${key}`].findIndex(Number.isFinite), 2)
        }
    })
    check('new log modes select one output with independent raw/log state, target metadata, lags and frozen replay', () => {
        const registrations = [
            ...['ema', 'sma'].flatMap(method => ['close', 'open', 'volume'].map(target => ({
                method, options: { target }, key: `${method}_3${target === 'close' ? '' : `_${target}`}`
            }))),
            { method: 'relativeVolume', options: {}, key: 'relative_volume_3' }
        ]
        for (const precision of [false, true]) for (const { method, options, key } of registrations) {
            const input = makeInput(160, precision), config = { precision, timeZone: 'UTC', skipNull: false }
            const main = new OHLCV_INDICATORS({ input, config })
                [method](3, { ...options, lag: 2 })[method](3, { ...options, lag: 2, retLogs: true })
            const before = main.exportConfig(), saved = deepFreeze(JSON.parse(JSON.stringify(before)))
            main.compute()
            for (const retLogs of [false, true]) {
                const separate = new OHLCV_INDICATORS({ input, config })[method](3, { ...options, lag: 2, retLogs }).compute()
                const selected = `${retLogs ? 'ret_log_' : ''}${key}`, absent = `${retLogs ? '' : 'ret_log_'}${key}`
                for (const suffix of ['', '_lag_1', '_lag_2']) {
                    assert.ok(!(absent + suffix in separate.verticalOhlcv))
                    assert.deepStrictEqual(main.verticalOhlcv[selected + suffix], separate.verticalOhlcv[selected + suffix])
                    assert.equal(main.priceBased.has(selected + suffix), !retLogs && ['close', 'open'].includes(options.target))
                }
                if (method !== 'relativeVolume') for (let index = 0; index < input.length; index++) {
                    const value = main.verticalOhlcv[options.target][index], average = main.verticalOhlcv[key][index]
                    const ratio = value / average
                    const expected = value > 0 && average > 0 && Number.isFinite(ratio) && ratio > 0 ? Math.log(ratio) : NaN
                    assert.strictEqual(main.verticalOhlcv[`ret_log_${key}`][index], expected)
                }
                const rows = separate.getData({ skipNull: false })
                if (retLogs) for (let index = 0; index < input.length; index++) {
                    assert.strictEqual(rows[index][selected], separate.verticalOhlcv[selected][index])
                }
            }
            assert.deepStrictEqual(main.exportConfig(), before)
            for (let replay = 0; replay < 2; replay++) {
                assert.deepStrictEqual(snapshot(new OHLCV_INDICATORS({ input, config: saved })), snapshot(main))
            }
        }
    })
    check('relativeVolume logs use the prior completed nonzero-volume window and reject negative operands', () => {
        for (const precision of [false, true]) {
            const volumes = [0, 10, 0, 20, 30, 0, 60, 30]
            const input = mfiInput(volumes.map(() => 10.25), volumes, precision)
            const main = new OHLCV_INDICATORS({ input, config: { precision } })
                .relativeVolume(2, { lag: 1 }).relativeVolume(2, { retLogs: true, lag: 1 }).compute()
            const expected = [NaN, NaN, NaN, NaN, 2, NaN, 2.4, 2 / 3]
            const logged = expected.map(Math.log)
            assert.deepStrictEqual(Array.from(main.verticalOhlcv.relative_volume_2), expected)
            assert.deepStrictEqual(Array.from(main.verticalOhlcv.ret_log_relative_volume_2), logged)
            assert.deepStrictEqual(Array.from(main.verticalOhlcv.ret_log_relative_volume_2_lag_1), [NaN, ...logged.slice(0, -1)])
            const negativeVolumes = [10, -100, -100, 10, 10, 10, 10]
            const negative = new OHLCV_INDICATORS({ input: mfiInput(negativeVolumes.map(() => 10.25), negativeVolumes, precision), config: { precision } })
                .relativeVolume(2).relativeVolume(2, { retLogs: true }).compute()
            assert.equal(negative.verticalOhlcv.relative_volume_2[2], -100 / -45)
            assert.deepStrictEqual(Array.from(negative.verticalOhlcv.ret_log_relative_volume_2), [NaN, NaN, NaN, NaN, NaN, 0, 0])
        }
    })
    check('new moving-average logs leave invalid, nonpositive and unrepresentable ratios as NaN', () => {
        for (const precision of [false, true]) for (const method of ['ema', 'sma']) {
            for (const invalid of [0, -1000, NaN, Infinity, -Infinity]) {
                const input = makeInput(12, precision)
                input.forEach((row, index) => { row.signal = index === 4 ? invalid : 10 })
                const main = new OHLCV_INDICATORS({ input, config: { precision } })
                    [method](3, { target: 'signal' })[method](3, { target: 'signal', retLogs: true }).compute()
                const v = main.verticalOhlcv, raw = v[`${method}_3_signal`], logged = v[`ret_log_${method}_3_signal`]
                assert.ok(Number.isNaN(logged[4]))
                for (let index = 0; index < input.length; index++) {
                    const value = v.signal[index], ratio = value / raw[index]
                    const expected = value > 0 && raw[index] > 0 && Number.isFinite(ratio) && ratio > 0 ? Math.log(ratio) : NaN
                    assert.strictEqual(logged[index], expected, `${method}: ${invalid} at index ${index}`)
                }
            }
        }
        // The core average can remain finite while a positive ratio underflows.
        for (const method of ['ema', 'sma']) {
            const input = makeInput(5)
            input.forEach((row, index) => { row.signal = index < 3 ? 1e200 : Number.MIN_VALUE })
            const main = new OHLCV_INDICATORS({ input })[method](3, { target: 'signal', retLogs: true }).compute()
            assert.ok(Number.isNaN(main.verticalOhlcv[`ret_log_${method}_3_signal`][3]))
        }
    })
    check('new log options validate booleans, reject duplicates and preserve raw defaults in stored configs', () => {
        const input = makeInput(120)
        for (const method of ['ema', 'sma', 'relativeVolume']) {
            for (const retLogs of [null, 0, 1, 'true', [], {}]) {
                assert.throws(() => new OHLCV_INDICATORS({ input })[method](3, { retLogs }), /options.retLogs/)
            }
            for (const retLogs of [false, true]) {
                assert.throws(() => new OHLCV_INDICATORS({ input })[method](3, { retLogs })[method](3, { retLogs }).compute(), /already|duplicate/i)
            }
            const defaults = new OHLCV_INDICATORS({ input, config: { skipNull: false } })[method](3, { lag: 1 })
            const saved = defaults.exportConfig()
            assert.equal(saved.inputParams[0].params.at(-1).retLogs, false)
            delete saved.inputParams[0].params.at(-1).retLogs
            deepFreeze(saved)
            defaults.compute()
            const restored = new OHLCV_INDICATORS({ input, config: saved })
            assert.deepStrictEqual(restored.verticalOhlcv, defaults.verticalOhlcv)
            assert.deepStrictEqual(restored.priceBased, defaults.priceBased)
            assert.deepStrictEqual(restored.getData(), defaults.getData())
            assert.deepStrictEqual(restored.exportConfig(), saved)
        }
    })
    check('channel logs match independent formulas, preserve raw windows and support both registration orders', () => {
        const cases = [
            { method: 'bollingerBands', prefix: 'bollinger_bands', args: [5, 2], rawParts: ['upper', 'middle', 'lower'], warmup: 5 },
            { method: 'donchianChannels', prefix: 'donchian_channel', args: [5, 2], rawParts: ['upper', 'basis', 'lower'], warmup: 6 }
        ]
        for (const precision of [false, true]) for (const test of cases) for (const reverse of [false, true]) {
            const input = makeInput(120, precision), config = { precision, skipNull: false, timeZone: 'UTC' }
            const main = new OHLCV_INDICATORS({ input, config })
            for (const retLogs of reverse ? [true, false] : [false, true]) main[test.method](...test.args, { retLogs, lag: 2 })
            const before = main.exportConfig(), saved = deepFreeze(JSON.parse(JSON.stringify(before)))
            main.compute()
            const v = main.verticalOhlcv, suffix = `_${test.args.join('_')}`
            const raw = test.method === 'bollingerBands' ? referenceBollinger(v.close, ...test.args)
                : Array.from(v.close, (_, index) => {
                    const end = index - test.args[1], start = end - test.args[0] + 1
                    if (start < 0) return { upper: NaN, basis: NaN, lower: NaN }
                    const upper = Math.max(...v.high.slice(start, end + 1)), lower = Math.min(...v.low.slice(start, end + 1))
                    return { upper, basis: (upper + lower) / 2, lower }
                })
            for (const part of test.rawParts) {
                assert.deepStrictEqual(Array.from(v[`${test.prefix}_${part}${suffix}`]), raw.map(row => row[part]))
            }
            for (const part of ['width', 'position']) {
                const key = `ret_log_${test.prefix}_${part}${suffix}`
                assert.equal(v[key].findIndex(Number.isFinite), test.warmup)
                for (let index = 0; index < input.length; index++) {
                    const expected = referenceChannelLogs(raw[index].upper, raw[index].lower, v.close[index])
                    assertNear(v[key][index], expected[part], `${key}[${index}]`)
                }
            }
            for (const retLogs of [false, true]) {
                const separate = new OHLCV_INDICATORS({ input, config: { ...config, useFullNames: true } })
                    [test.method](...test.args, { retLogs, lag: 2 }).compute()
                const parts = retLogs ? ['width', 'position'] : test.rawParts
                const keys = parts.map(part => `${retLogs ? 'ret_log_' : ''}${test.prefix}_${part}${suffix}`)
                const expectedKeys = keys.flatMap(key => [key, `${key}_lag_1`, `${key}_lag_2`])
                assert.deepStrictEqual(Object.keys(separate.verticalOhlcv).filter(key => key.includes(test.prefix)).sort(), expectedKeys.sort())
                const rows = separate.getData({ skipNull: false })
                for (const key of keys) for (let lag = 0; lag <= 2; lag++) {
                    const selected = key + (lag ? `_lag_${lag}` : '')
                    assert.deepStrictEqual(v[selected], separate.verticalOhlcv[selected])
                    assert.equal(main.priceBased.has(selected), !retLogs)
                    for (let index = 0; index < input.length; index++) {
                        assert.strictEqual(v[selected][index], index < lag ? NaN : v[key][index - lag])
                        if (retLogs) assert.strictEqual(rows[index][selected], separate.verticalOhlcv[selected][index])
                    }
                }
            }
            assert.deepStrictEqual(main.exportConfig(), before)
            const rows = main.getData({ skipNull: false })
            assert.deepStrictEqual(main.getData({ skipNull: true }), rows.slice(main.invalidValueIndex + 1))
            assert.deepStrictEqual(main.getLastValues(), rows.at(-1))
            for (let replay = 0; replay < 2; replay++) {
                assert.deepStrictEqual(snapshot(new OHLCV_INDICATORS({ input, config: saved })), snapshot(main))
            }
        }
    })
    check('channel log names separate multiple configurations and explicit lags replay unchanged', () => {
        const input = makeInput(120)
        for (const [method, prefix] of [['bollingerBands', 'bollinger_bands'], ['donchianChannels', 'donchian_channel']]) {
            const main = new OHLCV_INDICATORS({ input, config: { skipNull: false } })
                [method](3, 1, { retLogs: true })[method](7, 2, { retLogs: true })
                .lag([`ret_log_${prefix}_width_3_1`, `ret_log_${prefix}_position_7_2`], 2)
            const saved = deepFreeze(JSON.parse(JSON.stringify(main.exportConfig())))
            main.compute()
            for (const args of [[3, 1], [7, 2]]) {
                const separate = new OHLCV_INDICATORS({ input, config: { useFullNames: true } })
                    [method](...args, { retLogs: true }).compute()
                for (const part of ['width', 'position']) {
                    const key = `ret_log_${prefix}_${part}_${args.join('_')}`
                    assert.deepStrictEqual(main.verticalOhlcv[key], separate.verticalOhlcv[key])
                }
            }
            assert.deepStrictEqual(snapshot(new OHLCV_INDICATORS({ input, config: saved })), snapshot(main))
        }
    })
    check('flat channel logs retain zero width, undefined position and lag warm-up', () => {
        for (const precision of [false, true]) for (const size of [1, 3]) {
            const input = mfiInput(Array(12).fill(10), undefined, precision)
            for (const [method, prefix, parameter, warmup] of [
                ['bollingerBands', 'bollinger_bands', 2, size],
                ['donchianChannels', 'donchian_channel', 2, size + 1]
            ]) {
                const main = new OHLCV_INDICATORS({ input, config: { precision } })
                    [method](size, parameter, { retLogs: true, lag: 1 }).compute()
                const v = main.verticalOhlcv, width = `ret_log_${prefix}_width`, position = `ret_log_${prefix}_position`
                assert.deepStrictEqual(Array.from(v[width]), input.map((_, index) => index < warmup ? NaN : 0))
                assert.deepStrictEqual(Array.from(v[`${width}_lag_1`]), [NaN, ...v[width].slice(0, -1)])
                assert.ok(v[position].every(Number.isNaN))
                assert.ok(v[`${position}_lag_1`].every(Number.isNaN))
                assert.equal(main.invalidValueIndex, input.length - 1)
                assert.deepStrictEqual(main.getData({ skipNull: true }), [])
            }
        }
        const main = new OHLCV_INDICATORS({ input: mfiInput([10, 20, 30]) })
            .donchianChannels(1, 1, { retLogs: true }).compute()
        assert.deepStrictEqual(Array.from(main.verticalOhlcv.ret_log_donchian_channel_width), [NaN, 0, 0])
        assert.ok(main.verticalOhlcv.ret_log_donchian_channel_position.every(Number.isNaN))
    })
    check('Bollinger logs reject zero/negative lower bands and recover without altering raw bands', () => {
        for (const prices of [[1, 1, 3, 4, 5, 6], [1, 1, 10, 10, 11, 12]]) for (const precision of [false, true]) {
            const input = mfiInput(prices, undefined, precision)
            const main = new OHLCV_INDICATORS({ input, config: { precision } })
                .bollingerBands(2, 2).bollingerBands(2, 2, { retLogs: true }).compute()
            const v = main.verticalOhlcv
            assert.ok(v.bollinger_bands_lower_2_2[2] <= 0)
            assert.ok(Number.isNaN(v.ret_log_bollinger_bands_width_2_2[2]))
            assert.ok(Number.isNaN(v.ret_log_bollinger_bands_position_2_2[2]))
            assert.ok(Number.isFinite(v.ret_log_bollinger_bands_width_2_2[4]))
            assert.ok(Number.isFinite(v.ret_log_bollinger_bands_position_2_2[4]))
            const raw = referenceBollinger(v.close, 2, 2)
            assert.deepStrictEqual(Array.from(v.bollinger_bands_lower_2_2), raw.map(row => row.lower))
        }
    })
    check('Donchian log position uses current close against offset bounds and does not clip breakouts', () => {
        const input = [100, 110, 90, 150, 60].map(close => ({ open: close, high: 110, low: 90, close, volume: 1 }))
        const main = new OHLCV_INDICATORS({ input }).donchianChannels(1, 1, { retLogs: true }).compute()
        const v = main.verticalOhlcv
        assert.ok(Number.isNaN(v.ret_log_donchian_channel_position[0]))
        assertNear(v.ret_log_donchian_channel_position[1], 1, 'upper boundary')
        assertNear(v.ret_log_donchian_channel_position[2], -1, 'lower boundary')
        assert.ok(v.ret_log_donchian_channel_position[3] > 1)
        assert.ok(v.ret_log_donchian_channel_position[4] < -1)
        for (let index = 1; index < input.length; index++) {
            const expected = referenceChannelLogs(110, 90, input[index].close)
            assertNear(v.ret_log_donchian_channel_width[index], expected.width, 'offset width')
            assertNear(v.ret_log_donchian_channel_position[index], expected.position, 'offset position')
        }
    })
    check('channel widths and positions are invariant to price scaling and precision conversion', () => {
        const prices = [10.25, 11.5, 9.75, 12.25, 11.75, 10.5, 13.25, 12.5, 11.25, 14.5]
        for (const [method, prefix] of [['bollingerBands', 'bollinger_bands'], ['donchianChannels', 'donchian_channel']]) {
            const base = new OHLCV_INDICATORS({ input: mfiInput(prices) })[method](3, 2, { retLogs: true }).compute()
            for (const precision of [false, true]) for (const scale of [1, 10, 1000]) {
                const input = mfiInput(prices.map(value => value * scale), undefined, precision)
                const main = new OHLCV_INDICATORS({ input, config: { precision } })[method](3, 2, { retLogs: true }).compute()
                for (const part of ['width', 'position']) {
                    const key = `ret_log_${prefix}_${part}`
                    for (let index = 0; index < prices.length; index++) {
                        assertNear(main.verticalOhlcv[key][index], base.verticalOhlcv[key][index], `${key}: precision=${precision}, scale=${scale}`)
                    }
                }
            }
        }
    })
    check('channel logs reject invalid bounds/ratios but preserve width when only current close is invalid', () => {
        const triples = [
            [110, 90, 100], [110, 0, 100], [110, -1, 100], [NaN, 90, 100],
            [Infinity, 90, 100], [90, 110, 100], [110, 90, 0], [110, 90, -1],
            [110, 90, NaN], [110, 90, Infinity], [1e308, 1e-308, 100],
            [110, 90, Number.MIN_VALUE], [110, 90, 100]
        ]
        const input = triples.map(([high, low, close]) => ({ open: 100, high, low, close, volume: 1 }))
        const main = new OHLCV_INDICATORS({ input, config: { skipNull: false } })
            .donchianChannels(1, 0, { retLogs: true, lag: 1 }).compute()
        const v = main.verticalOhlcv
        for (let index = 0; index < input.length; index++) {
            const expected = referenceChannelLogs(...triples[index])
            assertNear(v.ret_log_donchian_channel_width[index], expected.width, `invalid bounds width[${index}]`)
            assertNear(v.ret_log_donchian_channel_position[index], expected.position, `invalid bounds position[${index}]`)
        }
        for (const index of [6, 7, 8, 9, 11]) {
            assert.ok(Number.isFinite(v.ret_log_donchian_channel_width[index]))
            assert.ok(Number.isNaN(v.ret_log_donchian_channel_position[index]))
        }
        assert.ok(Number.isFinite(v.ret_log_donchian_channel_position.at(-1)))
        assert.ok(Number.isNaN(v.ret_log_donchian_channel_position_lag_1.at(-1)))
    })
    check('channel log options validate booleans, reject duplicates and preserve legacy raw config defaults', () => {
        const input = makeInput(120)
        for (const method of ['bollingerBands', 'donchianChannels']) {
            for (const retLogs of [null, 0, 1, 'true', [], {}]) {
                assert.throws(() => new OHLCV_INDICATORS({ input })[method](3, 2, { retLogs }), /retLogs/)
            }
            for (const retLogs of [false, true]) {
                assert.throws(() => new OHLCV_INDICATORS({ input })[method](3, 2, { retLogs })[method](3, 2, { retLogs }).compute(), /already|duplicate/i)
            }
            const main = new OHLCV_INDICATORS({ input, config: { skipNull: false } })[method](3, 2, { lag: 1 })
            const saved = main.exportConfig()
            assert.equal(saved.inputParams[0].params.at(-1).retLogs, false)
            delete saved.inputParams[0].params.at(-1).retLogs
            deepFreeze(saved)
            main.compute()
            const replay = new OHLCV_INDICATORS({ input, config: saved })
            assert.deepStrictEqual(replay.verticalOhlcv, main.verticalOhlcv)
            assert.deepStrictEqual(replay.priceBased, main.priceBased)
            assert.deepStrictEqual(replay.getData(), main.getData())
            assert.deepStrictEqual(replay.exportConfig(), saved)
        }
    })
    check('ATR logs and their lags remain dimensionless during precision output conversion', () => {
        for (const precision of [false, true]) {
            const input = makeInput(120, precision)
            const main = new OHLCV_INDICATORS({ input, config: { precision, skipNull: false } })
                .atr(7, { lag: 2 }).atr(7, { lag: 2, retLogs: true })
            const saved = deepFreeze(main.exportConfig())
            main.compute()
            const v = main.verticalOhlcv, rows = main.getData()
            for (const suffix of ['', '_lag_1', '_lag_2']) {
                assert.ok(main.priceBased.has(`atr_7${suffix}`))
                assert.ok(!main.priceBased.has(`ret_log_atr_7${suffix}`))
                for (let index = 0; index < input.length; index++) {
                    assert.strictEqual(rows[index][`ret_log_atr_7${suffix}`], v[`ret_log_atr_7${suffix}`][index])
                }
            }
            for (let index = 0; index < input.length; index++) {
                assert.strictEqual(v.ret_log_atr_7[index], Math.log(v.atr_7[index] / v.close[index]))
                const expected = Number.isNaN(v.atr_7[index]) ? NaN : precision
                    ? revertPrecisionAsNumber(v.atr_7[index], main.precisionMultiplier) : v.atr_7[index]
                assert.strictEqual(rows[index].atr_7, expected)
            }
            assert.deepStrictEqual(main.exportConfig(), saved)
            assert.deepStrictEqual(snapshot(new OHLCV_INDICATORS({ input, config: saved })), snapshot(main))
        }
    })
    check('volumeOscillator raw/log variants have independent state, selected lags and config replay', () => {
        for (const precision of [false, true]) {
            const input = makeInput(160, precision)
            const config = { precision, timeZone: 'UTC', skipNull: false }
            const main = new OHLCV_INDICATORS({ input, config })
                .volumeOscillator(3, 8, { lag: 2 })
                .volumeOscillator(3, 8, { retLogs: true, lag: 2 })
            const before = main.exportConfig()
            main.compute()
            for (const retLogs of [false, true]) {
                const separate = new OHLCV_INDICATORS({ input, config })
                    .volumeOscillator(3, 8, { retLogs, lag: 2 }).compute()
                const key = `${retLogs ? 'ret_log_' : ''}volume_oscillator_3_8`
                const otherKey = `${retLogs ? '' : 'ret_log_'}volume_oscillator_3_8`
                for (const suffix of ['', '_lag_1', '_lag_2']) {
                    assert.ok(!(otherKey + suffix in separate.verticalOhlcv))
                    assert.deepStrictEqual(main.verticalOhlcv[key + suffix], separate.verticalOhlcv[key + suffix])
                    assert.ok(!main.priceBased.has(key + suffix))
                }
            }
            assert.deepStrictEqual(main.exportConfig(), before)
            const saved = deepFreeze(JSON.parse(JSON.stringify(before)))
            for (let replay = 0; replay < 2; replay++) {
                assert.deepStrictEqual(snapshot(new OHLCV_INDICATORS({ input, config: saved })), snapshot(main))
            }
        }
    })
    check('volumeOscillator explicit lags require their selected source column', () => {
        const input = makeInput(160)
        const missingRaw = new OHLCV_INDICATORS({ input })
            .volumeOscillator(3, 8, { retLogs: true }).lag(['volume_oscillator_3_8'], 1)
        assert.throws(() => new OHLCV_INDICATORS({ input, config: missingRaw.exportConfig() }), /volume_oscillator_3_8.*not found/)
        const main = new OHLCV_INDICATORS({ input })
            .volumeOscillator(3, 8, { retLogs: true })
            .volumeOscillator(3, 8)
            .lag(['volume_oscillator_3_8', 'ret_log_volume_oscillator_3_8'], 1)
        const saved = main.exportConfig()
        assert.deepStrictEqual(snapshot(main.compute()), snapshot(new OHLCV_INDICATORS({ input, config: saved })))
    })
    for (const precision of [false, true]) for (const retLogs of [false, true]) {
        check(`all indicators: precision=${precision}, retLogs=${retLogs}, exact replay/chunks`, () => {
            const input = makeInput(320, precision), options = { precision, retLogs }
            const main = configure(OHLCV_INDICATORS, input, options), before = main.exportConfig()
            const frozen = deepFreeze(JSON.parse(JSON.stringify(before)))
            const expected = snapshot(main.compute())
            assert.deepStrictEqual(main.exportConfig(), before)
            assert.equal(expected.rows.length, input.length)
            assert.ok(expected.validRows.length > 0 && expected.validRows.length < input.length)
            assert.deepStrictEqual(Object.keys(expected.rows[0]), expected.keys.filter(key => !main.verticalOhlcvTempCols.has(key)))
            assert.ok(main.executionParams.length > before.inputParams.length)
            assert.ok(Object.isFrozen(main.inputParams[0].params))
            assert.throws(() => main.ema(3), /already computed/)
            for (let replay = 0; replay < 2; replay++) {
                const restored = new OHLCV_INDICATORS({ input, config: frozen, chunkProcess: 101 })
                assert.deepStrictEqual(snapshot(restored), expected)
                assert.deepStrictEqual(restored.exportConfig(), before)
            }
            assert.deepStrictEqual(snapshot(configure(OHLCV_INDICATORS, input, { ...options, chunkProcess: 2000 }).compute()), expected)
            const exported = main.exportConfig()
            exported.inputParams[0].params[1] = 99
            exported.inputParams.find(job => job.key === 'mapCols').params[2].callbackParams.factor = 999
            assert.deepStrictEqual(main.exportConfig(), before)
            if (Baseline) {
                const includeMfi = typeof Baseline.prototype.mfi === 'function'
                const compatibleExpected = includeMfi ? expected : snapshot(configure(OHLCV_INDICATORS, input, { ...options, includeMfi: false }).compute())
                assert.deepStrictEqual(compatibleExpected, snapshot(configure(Baseline, input, { ...options, includeMfi }).compute()))
            }
        })
    }
    for (const pattern of ['increasing', 'decreasing', 'equal', 'mixed-invalid']) for (const precision of [false, true]) {
        check(`Donchian reference: ${pattern}, precision=${precision}`, () => {
            const input = makeInput(257, precision)
            input.forEach((row, index) => {
                const value = pattern === 'increasing' ? 100 + index : pattern === 'decreasing' ? 400 - index : pattern === 'equal' ? 200 : 200 + index % 7
                row.high = precision ? (value + 3).toFixed(4) : value + 3
                row.low = precision ? (value - 3).toFixed(4) : value - 3
            })
            if (pattern === 'mixed-invalid') {
                delete input[11].high; delete input[12].low
                input[35].high = precision ? 'NaN' : NaN; input[37].low = precision ? 'NaN' : NaN
            }
            const settings = [[1, 0], [2, 1], [17, 5], [128, 0], [256, 1], [257, 257]]
            const create = Ctor => {
                const main = new Ctor({ input, chunkProcess: 100, config: { precision, timeZone: 'UTC' } })
                settings.forEach(([size, offset]) => main.donchianChannels(size, offset, { lag: 1 }))
                return main.compute()
            }
            const main = create(OHLCV_INDICATORS)
            for (const [size, offset] of settings) {
                for (const [part, values] of Object.entries(referenceDonchian(main.verticalOhlcv.high, main.verticalOhlcv.low, size, offset))) {
                    assert.deepStrictEqual(Array.from(main.verticalOhlcv[`donchian_channel_${part}_${size}_${offset}`]), values)
                }
            }
            if (Baseline) assert.deepStrictEqual(snapshot(main), snapshot(create(Baseline)))
        })
    }
    check('input formatters: dates, numeric strings, passthrough and undefined values', () => {
        for (const kind of ['iso', 'seconds', 'object', 'milliseconds']) {
            const input = makeInput(120)
            input.forEach(row => {
                const date = new Date(row.date)
                if (kind === 'seconds') row.date = date.getTime() / 1000
                if (kind === 'object') row.date = date
                if (kind === 'milliseconds') row.date = date.getTime()
                row.extra = String(row.extra); row.payload = { note: row.note }
            })
            delete input[4].extra; delete input[5].note; delete input[6].high; input[7].low = NaN
            const create = Ctor => new Ctor({ input, config: { timeZone: 'UTC' } }).lag(['extra', 'note'], 2).compute()
            const main = create(OHLCV_INDICATORS)
            assert.equal(main.verticalOhlcv.extra[3], 0.3)
            assert.equal(main.verticalOhlcv.note[3], 'row-3'); assert.equal(main.verticalOhlcv.flag[3], false)
            assert.strictEqual(main.verticalOhlcv.payload[3], input[3].payload)
            assert.ok(Number.isNaN(main.verticalOhlcv.high[6])); assert.ok(Number.isNaN(main.verticalOhlcv.low[7]))
            // Preserve the existing unrecognized dateMillseconds formatter behavior.
            if (kind === 'milliseconds') {
                assert.equal(main.verticalOhlcv.date[0], input[0].date)
                assert.throws(() => main.getData(), TypeError)
                if (Baseline) assert.deepStrictEqual(main.verticalOhlcv, create(Baseline).verticalOhlcv)
            } else if (Baseline) assert.deepStrictEqual(snapshot(main), snapshot(create(Baseline)))
        }
    })
    check('lag types, missing values, nested ordering and source object identity', () => {
        const input = makeInput(120)
        input.forEach((row, index) => { row.vector = [index, index + 1] })
        delete input[4].extra; input[5].vector = null
        const v = new OHLCV_INDICATORS({ input }).lag(['extra', 'vector'], 2).lag(['extra_lag_1'], 1).compute().verticalOhlcv
        assert.ok(v.extra_lag_1 instanceof Float64Array); assert.ok(Array.isArray(v.vector_lag_1))
        assert.ok(Number.isNaN(v.extra_lag_1[0])); assert.ok(Number.isNaN(v.extra_lag_1[5]))
        assert.equal(v.vector_lag_1[0], null); assert.equal(v.vector_lag_1[6], null)
        assert.strictEqual(v.vector_lag_1[3], input[2].vector)
        assert.deepStrictEqual(v.extra_lag_1_lag_1, v.extra_lag_2)
        const nested = new OHLCV_INDICATORS({ input }).lag(['extra', 'extra_lag_1'], 2).compute().verticalOhlcv
        assert.deepStrictEqual(nested.extra_lag_1_lag_1, nested.extra_lag_2)
        assert.throws(() => new OHLCV_INDICATORS({ input }).lag(['missing'], 1).compute(), /not found/)
        assert.throws(() => new OHLCV_INDICATORS({ input }).lag(['extra', 'extra'], 1).compute(), /already exists/)
    })
    check('callbacks replacing lag buffers and changing inputTypes preserve behavior', () => {
        const input = makeInput(120)
        input.forEach((row, index) => { row.note = index === 0 ? 'original' : String(index) })
        const create = Ctor => new Ctor({ input }).mapCols(['custom'], ({ index, main }) => {
            if (index === 0) main.inputTypes.note = 'numberCleanString'
            if (index === 1) main.verticalOhlcv.custom = new Float64Array(main.len).fill(NaN)
            if (index === 2) {
                main.verticalOhlcv.custom = new Array(main.len).fill(null)
                main.verticalOhlcv.custom_lag_1 = new Array(main.len).fill('replaced')
            }
            return { custom: index === 2 ? null : index }
        }).lag(['custom'], 1).compute()
        const main = create(OHLCV_INDICATORS), v = main.verticalOhlcv
        assert.equal(v.note[0], 'original'); assert.equal(v.note[1], 1)
        assert.equal(v.custom_lag_1[0], 'replaced'); assert.equal(v.custom_lag_1[2], null)
        assert.equal(v.custom_lag_1[3], null); assert.equal(v.custom_lag_1[4], 3)
        if (Baseline) assert.deepStrictEqual(v, create(Baseline).verticalOhlcv)
    })
    check('callbacks changing runtime lag targets/lookback leave persistent declarations intact', () => {
        const input = makeInput(120)
        for (const mutation of ['lookback', 'splice', 'replace']) {
            const create = Ctor => new Ctor({ input }).mapCols(['marker'], ({ index, main }) => {
                if (index === 3) {
                    const job = main.executionParams.find(job => job.key === 'lag')
                    if (mutation === 'lookback') job.params[1] = 0
                    if (mutation === 'splice') job.params[0].splice(0, 1)
                    if (mutation === 'replace') job.params[0] = ['high']
                }
                return { marker: index }
            }).lag(['close', 'high'], 2).compute()
            const main = create(OHLCV_INDICATORS)
            assert.deepStrictEqual(main.inputParams[1].params, [['close', 'high'], 2])
            assert.equal(main.verticalOhlcv.close_lag_1[2], input[1].close)
            assert.ok(Number.isNaN(main.verticalOhlcv.close_lag_1[3]))
            if (mutation === 'lookback') assert.ok(Number.isNaN(main.verticalOhlcv.high_lag_1[3]))
            else assert.equal(main.verticalOhlcv.high_lag_1[3], input[2].high)
            if (Baseline) assert.deepStrictEqual(main.verticalOhlcv, create(Baseline).verticalOhlcv)
        }
    })
    check('output conversion: precision, dates, null/NaN, property order and identity', () => {
        const input = makeInput(120, true)
        const create = Ctor => {
            const main = new Ctor({ input, config: { precision: true, timeZone: 'UTC', skipNull: false } })
                .mapCols(['scaled'], ({ index, main }) => ({ scaled: index === 0 ? NaN : index === 1 ? null : main.verticalOhlcv.close[index] }), { isPriceBased: true })
                .mapCols(['vector'], ({ index }) => ({ vector: [index] })).compute()
            return main
        }
        const main = create(OHLCV_INDICATORS), expected = Baseline ? create(Baseline) : null
        assert.throws(() => main.exportConfig(), /callback/i)
        for (const dateFormat of ['milliseconds', 'seconds', 'iso', 'toISOString', 'object', 'string', 'toString', 'toUTCString']) for (const skipNull of [false, true]) {
            const rows = main.getData({ dateFormat, skipNull })
            if (expected) assert.deepStrictEqual(rows, expected.getData({ dateFormat, skipNull }))
            if (!skipNull) {
                assert.ok(Number.isNaN(rows[0].scaled)); assert.equal(rows[1].scaled, null)
                assert.equal(rows[2].scaled, Number(input[2].close))
                assert.strictEqual(rows[2].vector, main.verticalOhlcv.vector[2])
                if (dateFormat === 'object') assert.strictEqual(rows[2].date, main.verticalOhlcv.date[2])
            }
            assert.deepStrictEqual(Object.keys(rows[0]), Object.keys(main.verticalOhlcv))
        }
    })
    check('default callback replay and first-row validation', () => {
        const input = makeInput(120), main = new OHLCV_INDICATORS({ input }).mapCols().compute()
        assert.deepStrictEqual(snapshot(new OHLCV_INDICATORS({ input, config: main.exportConfig() })), snapshot(main))
        const invalid = makeInput(120); invalid[0].high = 0
        assert.throws(() => new OHLCV_INDICATORS({ input: invalid }).donchianChannels(3).compute(), /invalid/i)
        if (Baseline) assert.deepStrictEqual(snapshot(main), snapshot(new Baseline({ input }).mapCols().compute()))
    })
    check('cached validation includes generated outputs; callbacks can add/remove columns later', () => {
        const input = makeInput(120)
        delete input[11].high; input[77].extra = NaN
        const create = Ctor => new Ctor({ input, config: { timeZone: 'UTC' } })
            .ema(5, { lag: 2 }).dateTime().crossPairs([{ fast: 'close', slow: 100 }]).compute()
        const main = create(OHLCV_INDICATORS)
        assert.equal(main.invalidValueIndex, 77)
        assert.equal(main.getData().length, 42)
        if (Baseline) assert.deepStrictEqual(snapshot(main), snapshot(create(Baseline)))
        const dynamic = Ctor => new Ctor({ input: makeInput(120), config: { timeZone: 'UTC' } })
            .mapCols(['marker'], ({ index, main }) => {
                if (index === 3) {
                    main.verticalOhlcv.ephemeral = new Float64Array(main.len).fill(1)
                    main.verticalOhlcv.ephemeral[index] = NaN
                }
                if (index === 4) delete main.verticalOhlcv.ephemeral
                return { marker: index }
            }).compute()
        const changed = dynamic(OHLCV_INDICATORS)
        assert.equal(changed.invalidValueIndex, 3)
        assert.equal(changed.getData().length, 116)
        assert.ok(!('ephemeral' in changed.verticalOhlcv))
        if (Baseline) assert.deepStrictEqual(changed.getData({ skipNull: false }), dynamic(Baseline).getData({ skipNull: false }))
    })
    check('cross counters retain bounded state and independent one-hot output vectors', () => {
        const input = makeInput(2048)
        input.forEach((row, index) => { row.close = row.open + (index % 2 ? -1 : 1) })
        const observed = []
        const main = new OHLCV_INDICATORS({ input })
            .crossPairs([{ fast: 'close', slow: 'open' }], { limit: 3, oneHot: true })
            .mapCols(['marker'], ({ index, main }) => {
                if (index === 127 || index === input.length - 1) {
                    const run = main.instances.crossPairs.close_x_open.run
                    observed.push(retainedStorage(run))
                    assert.ok(!('crossIndexes' in run), 'unused event history must not be retained')
                }
                return { marker: index }
            }).compute()
        assert.deepStrictEqual(observed, [{ slots: 0, bytes: 0 }, { slots: 0, bytes: 0 }])
        const v = main.verticalOhlcv
        assert.deepStrictEqual(Array.from(v.close_x_open), input.map((_, index) => index % 2 ? -1 : 1))
        assert.notStrictEqual(v.one_hot_close_x_open[0], v.one_hot_close_x_open[2])
        v.one_hot_close_x_open[0][4] = 0
        assert.equal(v.one_hot_close_x_open[2][4], 1)
    })
    check('calendar scalar writes preserve DST, timezone boundaries and one-hot/lag identity', () => {
        const input = makeInput(5)
        const dates = ['2024-03-10T06:30:00Z', '2024-03-10T07:30:00Z', '2024-11-03T05:30:00Z', '2024-11-03T06:30:00Z', '2025-01-01T04:30:00Z']
        input.forEach((row, index) => { row.date = dates[index] })
        for (const oneHot of [false, true]) {
            const create = Ctor => new Ctor({ input, config: { timeZone: 'America/New_York', skipNull: false } }).dateTime({ oneHot, lag: 1 }).compute()
            const main = create(OHLCV_INDICATORS), v = main.verticalOhlcv
            if (Baseline) assert.deepStrictEqual(snapshot(main), snapshot(create(Baseline)))
            if (oneHot) {
                assert.deepStrictEqual(v.one_hot_hour.map(vector => vector.indexOf(1)), [1, 3, 1, 1, 23])
                assert.deepStrictEqual(v.one_hot_day_of_the_week.map(vector => vector.indexOf(1)), [0, 0, 0, 0, 2])
                assert.notStrictEqual(v.one_hot_hour[2], v.one_hot_hour[3])
                assert.strictEqual(v.one_hot_hour_lag_1[3], v.one_hot_hour[2])
                assert.equal(v.one_hot_hour_lag_1[0], null)
                v.one_hot_hour[2][1] = 0
                assert.equal(v.one_hot_hour[3][1], 1)
            } else {
                assert.deepStrictEqual(Array.from(v.hour), [1, 3, 1, 1, 23])
                assert.deepStrictEqual(Array.from(v.day_of_the_week), [7, 7, 7, 7, 2])
                assert.equal(v.year[4], 2024); assert.equal(v.month[4], 12); assert.equal(v.day_of_the_month[4], 31)
            }
        }
    })
    check('precision metadata caching preserves truncation, unusual values and per-call scale', () => {
        const additions = [
            ['123.456789', 10000, 1234567], ['-0.00019', 10000, -1],
            ['000123.4500', 10000, 1234500], ['12.999', 1, 12], ['-0', 10000, -0],
            ['0.000000000123456789', 1e14, 12345], ['NaN', 10000, NaN], ['1e2', 10000, 1]
        ]
        for (const [value, multiplier, expected] of additions) assert.strictEqual(addPrecisionAsNumber(value, multiplier), expected)
        const reversions = [
            [1234567.999, 10000, 123.4567], [-1234567.999, 10000, -123.4567],
            [2.999, 1, 2], [-2.999, 1, -2], [-0, 10000, 0], [-0.1, 10000, -0],
            [12345, 1e14, 0.00000000012345], [1, 10000, 0.0001]
        ]
        for (const [value, multiplier, expected] of reversions) assert.strictEqual(revertPrecisionAsNumber(value, multiplier), expected)
        assert.throws(() => addPrecisionAsNumber(12, 10000), /expects a string/)
        for (const value of [NaN, Infinity, -Infinity, null, '123']) assert.throws(() => revertPrecisionAsNumber(value, 10000), /finite number/)
        const input = makeInput(120, true)
        const main = new OHLCV_INDICATORS({ input, config: { precision: true } }).compute()
        const before = main.exportConfig()
        for (const multiplier of [10000, 100000, 1, 10000]) {
            main.precisionMultiplier = multiplier
            const rows = main.getData({ skipNull: false })
            assert.equal(rows[0].close, revertPrecisionAsNumber(main.verticalOhlcv.close[0], multiplier))
        }
        assert.deepStrictEqual(main.exportConfig(), before)
    })
    check('MFI known values: neutral logs, bounds, independent raw/log state and lagged replay', () => {
        for (const precision of [false, true]) {
            const input = mfiInput([10, 20, 10, 20, 10], [1, 1, 2, 1, 2], precision)
            const main = new OHLCV_INDICATORS({ input, config: { precision, useFullNames: true, timeZone: 'UTC', skipNull: false } })
                .mfi(2, { lag: 1 }).mfi(2, { retLogs: true, lag: 1 }).mfi(1)
            const before = main.exportConfig(), frozen = deepFreeze(JSON.parse(JSON.stringify(before)))
            main.compute()
            assert.deepStrictEqual(Array.from(main.verticalOhlcv.mfi_2), [NaN, NaN, 50, 50, 50])
            assert.deepStrictEqual(Array.from(main.verticalOhlcv.ret_log_mfi_2), [NaN, NaN, 0, 0, 0])
            assert.deepStrictEqual(Array.from(main.verticalOhlcv.mfi_2_lag_1), [NaN, NaN, NaN, 50, 50])
            assert.deepStrictEqual(Array.from(main.verticalOhlcv.mfi_1), [NaN, 100, 0, 100, 0])
            for (const key of ['mfi_1', 'mfi_2', 'ret_log_mfi_2', 'mfi_2_lag_1', 'ret_log_mfi_2_lag_1']) {
                assert.ok(main.verticalOhlcv[key] instanceof Float64Array)
                assert.ok(!main.priceBased.has(key), `${key} must remain dimensionless`)
            }
            assert.deepStrictEqual(main.exportConfig(), before)
            for (let replay = 0; replay < 2; replay++) {
                assert.deepStrictEqual(snapshot(new OHLCV_INDICATORS({ input, config: frozen })), snapshot(main))
            }
        }
        for (const direction of [1, -1]) {
            const input = mfiInput(Array.from({ length: 12 }, (_, index) => 20 + direction * index))
            const main = new OHLCV_INDICATORS({ input }).mfi(3).mfi(3, { retLogs: true }).compute()
            const raw = direction === 1 ? 100 : 0, logged = Math.log((raw || 0.001) / 50)
            assert.deepStrictEqual(Array.from(main.verticalOhlcv.mfi_3), [NaN, NaN, NaN, ...Array(9).fill(raw)])
            assert.deepStrictEqual(Array.from(main.verticalOhlcv.ret_log_mfi_3), [NaN, NaN, NaN, ...Array(9).fill(logged)])
        }
    })
    check('MFI ties and zero-volume candles advance the window; empty directional windows stay NaN', () => {
        const ties = new OHLCV_INDICATORS({ input: mfiInput([10, 20, 20, 10], [1, 1, 999, 2]) }).mfi(2).compute()
        assert.deepStrictEqual(Array.from(ties.verticalOhlcv.mfi_2), [NaN, NaN, 100, 0])
        const zeros = new OHLCV_INDICATORS({ input: mfiInput([10, 20, 30, 20, 10], [0, 0, 0, 1, 1]) }).mfi(2).compute()
        assert.deepStrictEqual(Array.from(zeros.verticalOhlcv.mfi_2), [NaN, NaN, NaN, 0, 0])
        const zeroWindow = new OHLCV_INDICATORS({ input: mfiInput([10, 20, 30, 40, 50], [1, 1, 0, 0, 1]) }).mfi(2).compute()
        assert.deepStrictEqual(Array.from(zeroWindow.verticalOhlcv.mfi_2), [NaN, NaN, 100, NaN, 100])
        for (const input of [mfiInput([10, 10, 10, 10, 10]), mfiInput([10, 20, 10, 20, 10], [0, 0, 0, 0, 0])]) {
            const main = new OHLCV_INDICATORS({ input }).mfi(2).mfi(2, { retLogs: true }).compute()
            assert.ok(Array.from(main.verticalOhlcv.mfi_2).every(Number.isNaN))
            assert.ok(Array.from(main.verticalOhlcv.ret_log_mfi_2).every(Number.isNaN))
            assert.deepStrictEqual(main.getData(), [])
        }
    })
    check('MFI exact independent chronological-window reference across precision, logs and ring wraps', () => {
        for (const precision of [false, true]) for (const retLogs of [false, true]) {
            for (const pattern of ['mixed', 'flat', 'invalid', 'negative-volume']) for (const size of [1, 3, 7, 128]) {
                const prices = Array.from({ length: 257 }, (_, index) => pattern === 'flat' ? 100 : 100 + (index % 23 - 11) / 8 + index / 256)
                const volumes = prices.map((_, index) => index % 17 === 0 ? 0 : 20 + index % 11)
                if (pattern === 'invalid') prices[55] = NaN
                if (pattern === 'negative-volume') volumes[55] = -10
                const main = new OHLCV_INDICATORS({ input: mfiInput(prices, volumes, precision), chunkProcess: 100, config: { precision } })
                    .mfi(size, { retLogs }).compute()
                const key = `${retLogs ? 'ret_log_' : ''}mfi_${size}`
                assert.deepStrictEqual(Array.from(main.verticalOhlcv[key]), referenceMfi(main.verticalOhlcv, size, retLogs), `${key}: ${pattern}, precision=${precision}`)
                if (!retLogs) for (const value of main.verticalOhlcv[key]) {
                    assert.ok(Number.isNaN(value) || (value >= 0 && value <= 100))
                }
            }
        }
    })
    check('MFI invalid samples recover only after affected flows leave the window', () => {
        const prices = Array.from({ length: 14 }, (_, index) => 10 + index)
        const invalidTypical = mfiInput(prices)
        invalidTypical[5].high = NaN
        const main = new OHLCV_INDICATORS({ input: invalidTypical }).mfi(3).compute()
        assert.equal(main.verticalOhlcv.mfi_3[4], 100)
        for (const index of [5, 6, 7, 8]) assert.ok(Number.isNaN(main.verticalOhlcv.mfi_3[index]))
        assert.equal(main.verticalOhlcv.mfi_3[9], 100)
        for (const kind of ['money-overflow', 'negative-flow']) {
            const input = mfiInput(prices)
            if (kind === 'money-overflow') Object.assign(input[5], { high: 1e300, low: 1e300, close: 1e300, volume: 1000000000 })
            else input[5].volume = -1
            const changed = new OHLCV_INDICATORS({ input }).mfi(3).compute()
            for (const index of [5, 6, 7]) assert.ok(Number.isNaN(changed.verticalOhlcv.mfi_3[index]))
            assert.ok(Number.isFinite(changed.verticalOhlcv.mfi_3[8]))
            if (kind === 'negative-flow') assert.equal(changed.verticalOhlcv.mfi_3[8], 100)
            assert.deepStrictEqual(Array.from(changed.verticalOhlcv.mfi_3), referenceMfi(changed.verticalOhlcv, 3))
        }
    })
    check('MFI argument/source validation, defaults, duplicates and computation guards', () => {
        const input = makeInput(120)
        const defaults = new OHLCV_INDICATORS({ input }).mfi()
        assert.deepStrictEqual(defaults.exportConfig().inputParams, [{ key: 'mfi', params: [14, { lag: 0, retLogs: false }] }])
        for (const size of [0, -1, 1.5, '2', 121, NaN, Infinity]) assert.throws(() => new OHLCV_INDICATORS({ input }).mfi(size))
        for (const lag of [-1, 1.5, 121, NaN, Infinity]) assert.throws(() => new OHLCV_INDICATORS({ input }).mfi(3, { lag }))
        for (const retLogs of [null, 0, 1, 'true']) assert.throws(() => new OHLCV_INDICATORS({ input }).mfi(3, { retLogs }))
        assert.throws(() => new OHLCV_INDICATORS({ input }).mfi(3).mfi(3).compute(), /already|duplicate/i)
        assert.throws(() => new OHLCV_INDICATORS({ input }).mfi(3, { retLogs: true }).mfi(3, { retLogs: true }).compute(), /already|duplicate/i)
        const computed = defaults.compute()
        assert.throws(() => computed.mfi(3), /already computed/)
        new OHLCV_INDICATORS({ input }).mapCols(['guard'], ({ index, main }) => {
            if (index === 0) assert.throws(() => main.mfi(3), /computation is in progress/)
            return { guard: 1 }
        }).mfi(3).compute()
        for (const key of ['high', 'low', 'close', 'volume']) {
            const missing = makeInput(120); delete missing[0][key]
            assert.throws(() => new OHLCV_INDICATORS({ input: missing }).mfi(3).compute())
            const invalid = makeInput(120); invalid[0][key] = key === 'volume' ? -1 : 0
            assert.throws(() => new OHLCV_INDICATORS({ input: invalid }).mfi(3).compute(), /Invalid or missing/)
        }
    })
    check('MFI retains one period-sized Float64Array per independent configuration', () => {
        const sizes = [1, 7, 37], observed = []
        const main = new OHLCV_INDICATORS({ input: makeInput(8192) })
        for (const size of sizes) main.mfi(size).mfi(size, { retLogs: true })
        main.mapCols(['observe'], ({ index, main }) => {
            if (index === 255 || index === main.len - 1) {
                const buffers = []
                for (const size of sizes) for (const prefix of ['', 'ret_log_']) {
                    const state = main.instances[`${prefix}mfi_${size}`]
                    assert.deepStrictEqual(retainedStorage(state), { slots: 0, bytes: size * 8 })
                    const arrays = Object.values(state).filter(ArrayBuffer.isView)
                    assert.equal(arrays.length, 1)
                    assert.ok(arrays[0] instanceof Float64Array)
                    assert.ok(!buffers.includes(arrays[0])); buffers.push(arrays[0])
                }
                observed.push(buffers.map(buffer => buffer.byteLength))
            }
            return { observe: index }
        }).compute()
        assert.deepStrictEqual(observed[0], observed[1])
        assert.equal(observed.length, 2)
    })
    console.log(`\n${passed} deterministic regression groups passed${Baseline ? '; exact baseline comparisons passed' : ''}.`)
}

const benchmark = Baseline => {
    const rows = Number(option('--rows') ?? 10000), repeats = Number(option('--repeats') ?? 7)
    assert.ok(Number.isInteger(rows) && rows >= 256 && rows <= 100000, '--rows must be 256..100000')
    assert.ok(Number.isInteger(repeats) && repeats >= 3 && repeats <= 30, '--repeats must be 3..30')
    const entries = Baseline ? [['baseline', Baseline], ['current', OHLCV_INDICATORS]] : [['current', OHLCV_INDICATORS]]
    const profiles = [
        { name: 'numeric', input: makeInput(rows), create: (Ctor, input) =>
            new Ctor({ input, config: { timeZone: 'UTC' } })
                .ema(10, { lag: 3 }).sma(20, { lag: 3 }).rsi(14, { retLogs: true, lag: 2 })
                .donchianChannels(128, 0, { lag: 2 }).donchianChannels(255, 5, { lag: 1 })
                .volumeOscillator(5, 10, { retLogs: true, lag: 2 }).lag(['close', 'volume'], 3) },
        ...[false, true].map(callback => ({ name: `features+precision${callback ? '+callback' : ''}`, input: makeInput(rows, true), create: (Ctor, input) => {
            const main = new Ctor({ input, config: { timeZone: 'America/New_York', precision: true } })
                .sma(10, { lag: 2 }).heikenAshi(3, 4, { retLogs: true, lag: 1 })
                .candleFeatures({ retLogs: true }).dateTime({ lag: 1 })
                .crossPairs([{ fast: 'close', slow: 'open' }], { limit: 5, oneHot: true })
            return callback ? main.mapCols(['body_ratio'], ({ index, main }) => ({
                body_ratio: main.verticalOhlcv.close[index] / main.verticalOhlcv.open[index]
            })) : main
        } }))
    ]
    const samples = {}
    for (const profile of profiles) {
        for (const [name] of entries) samples[`${profile.name} / ${name}`] = { compute: [], output: [] }
        for (let repetition = -2; repetition < repeats; repetition++) {
            // Alternate order to reduce warm-up/GC order bias. No timing assertions.
            for (const [name, Ctor] of repetition % 2 ? [...entries].reverse() : entries) {
                global.gc?.()
                const main = profile.create(Ctor, profile.input)
                const start = performance.now()
                main.compute()
                const computed = performance.now()
                const output = main.getData({ skipNull: false, dateFormat: 'milliseconds' })
                const converted = performance.now()
                assert.equal(output.length, rows)
                if (repetition >= 0) {
                    const sample = samples[`${profile.name} / ${name}`]
                    sample.compute.push(computed - start); sample.output.push(converted - computed)
                }
            }
        }
    }
    const median = values => {
        const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
        return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
    }
    console.log(`\nBenchmark: ${rows} rows, 2 warm-ups, ${repeats} samples; constructor excluded; median milliseconds`)
    console.table(Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, {
        compute: Number(median(values.compute).toFixed(2)), getData: Number(median(values.output).toFixed(2))
    }])))
}

const benchmarkCore = () => {
    const rows = Number(option('--rows') ?? 10000), repeats = Number(option('--repeats') ?? 7)
    const prices = Array.from({ length: rows }, (_, index) => 100 + Math.sin(index / 7) * 10)
    const candles = prices.map(close => ({ high: close + 2, low: close - 2, close }))
    const results = {}
    for (const test of coreCases) {
        const samples = []
        let storage
        for (let repetition = -2; repetition < repeats; repetition++) {
            const instance = test.create(Core, 32), input = test.candle ? candles : prices
            const start = performance.now()
            for (const value of input) instance.update(value)
            const elapsed = performance.now() - start
            assert.equal(instance.isStable, true)
            if (repetition >= 0) samples.push(elapsed)
            if (repetition === repeats - 1) storage = retainedStorage(instance)
        }
        const median = values => {
            const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2)
            return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
        }
        results[test.name] = {
            'core ms': Number(median(samples).toFixed(3)),
            'core array slots': storage.slots,
            'core typed bytes': storage.bytes
        }
    }
    console.log(`\nCore benchmark: ${rows} updates, period 32, 2 warm-ups, ${repeats} samples; median milliseconds`)
    console.log('Storage counts describe retained arrays only, not total heap or peak/transient allocations.')
    console.table(results)
}

if (args.includes('--live')) {
    const { getNasdaqOHLCV } = await import('./utilities/fetchNasdaq.js')
    const input = await getNasdaqOHLCV({ symbol: 'TQQQ', interval: '1d', type: 'index', limit: 1000 })
    console.log(new OHLCV_INDICATORS({ input, config: { precision: false, useFullNames: false } })
        .volumeOscillator(5, 10, { retLogs: true }).ema(10).ema(20).getLastValues())
} else {
    const path = option('--baseline')
    const Baseline = path ? (await import(pathToFileURL(resolve(path)).href)).default : null
    runRegressions(Baseline)
    if (args.includes('--benchmark')) { benchmark(Baseline); benchmarkCore() }
}
