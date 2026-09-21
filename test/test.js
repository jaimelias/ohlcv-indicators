import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import OHLCV_INDICATORS from '../index.js'
import * as Core from '../src/core-indicators/index.js'
import * as TradingSignals from 'trading-signals'

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
const configure = (Ctor, input, { precision = false, retLogs = false, chunkProcess = 100 } = {}) => {
    Ctor.registerMapCallback('test.optimizations.v1', mapCallback)
    return new Ctor({ input, chunkProcess, config: { precision, useFullNames: retLogs, timeZone: 'America/Panama', dateFormat: 'iso', skipNull: false } })
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

// One independent registration per public indicator/study. The combined chain
// above remains useful for detecting interactions between different handlers.
const indicatorCases = [
    { name: 'ema', register: (m, o) => m.ema(5, o), keys: () => ['ema_5'], warmup: 4 },
    { name: 'sma', register: (m, o) => m.sma(5, o), keys: () => ['sma_5'], warmup: 4 },
    { name: 'bollingerBands', register: (m, o) => m.bollingerBands(8, 2, o),
        // trading-signals v5 exposes the first bands after size + 1 updates.
        keys: () => ['upper', 'middle', 'lower'].map(k => `bollinger_bands_${k}`), warmup: 8 },
    { name: 'macd', register: (m, o) => m.macd(4, 9, 3, o),
        keys: () => ['diff', 'dea', 'histogram'].map(k => `macd_${k}`) },
    { name: 'relativeVolume', register: (m, o) => m.relativeVolume(6, o),
        keys: () => ['relative_volume_6'], warmup: 6 },
    { name: 'volumeDelta', register: (m, o) => m.volumeDelta(o),
        keys: () => ['high', 'low', 'close', 'cross'].map(k => `volume_delta_${k}`) },
    { name: 'volumeOscillator', register: (m, o) => m.volumeOscillator(3, 8, o),
        keys: logs => ['volume_oscillator_3_8', ...(logs ? ['ret_log_volume_oscillator_3_8'] : [])], warmup: 7 },
    { name: 'rsi', register: (m, o) => m.rsi(7, o),
        keys: logs => ['rsi_7', 'rsi_sma_7'].map(k => `${logs ? 'ret_log_' : ''}${k}`) },
    { name: 'stochastic', register: (m, o) => m.stochastic(7, 3, 3, o),
        keys: logs => ['d', 'k'].map(k => `${logs ? 'ret_log_' : ''}stochastic_${k}_7_3_3`) },
    { name: 'atr', register: (m, o) => m.atr(7, o), keys: logs => [`${logs ? 'ret_log_' : ''}atr_7`] },
    { name: 'adx', register: (m, o) => m.adx(7, o), keys: logs => [`${logs ? 'ret_log_' : ''}adx_7`] },
    { name: 'heikenAshi', register: (m, o) => m.heikenAshi(null, null, o),
        keys: logs => [...['body', 'upper_wick', 'lower_wick', 'range'].map(k => `${logs ? 'ret_log_' : 'ret_'}heiken_ashi_${k}`), 'heiken_ashi_cross'] },
    { name: 'donchianChannels', register: (m, o) => m.donchianChannels(8, 2, o),
        keys: () => ['upper', 'basis', 'lower'].map(k => `donchian_channel_${k}`), warmup: 9 },
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

const runRegressions = Baseline => {
    let passed = 0
    const check = (name, callback) => { callback(); console.log(`PASS ${name}`); passed++ }
    for (const test of coreCases) check(`core ${test.name}: exact trading-signals 5.0.4 compatibility`, () => {
        for (const size of [1, 2, 7, 32]) for (const pattern of ['mixed', 'zero', 'invalid', 'coercion']) for (const replacements of [false, true]) {
            const current = test.create(Core, size), reference = test.create(TradingSignals, size)
            assert.deepStrictEqual(readCoreResult(current), readCoreResult(reference))
            let previousObject, previousSnapshot
            for (let index = 0; index < 180; index++) {
                let value = pattern === 'zero' ? (index % 2 ? -0 : 0) : 100 + Math.sin(index / 3) * 10
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
                const replace = replacements && index % 5 === 0
                const expected = reference.update(input, replace)
                const actual = current.update(input, replace)
                assert.deepStrictEqual(actual, expected, `${test.name}: update ${index}, size ${size}, ${pattern}`)
                assert.equal(current.isStable, reference.isStable)
                assert.deepStrictEqual(readCoreResult(current), readCoreResult(reference))
                for (const property of ['highest', 'lowest', 'previousResult', 'pdi', 'mdi']) {
                    assert.deepStrictEqual(current[property], reference[property], `${test.name}.${property}`)
                }
                if (actual && typeof actual === 'object') {
                    if (previousObject) {
                        assert.notStrictEqual(actual, previousObject)
                        assert.deepStrictEqual(previousObject, previousSnapshot)
                    }
                    previousObject = actual; previousSnapshot = { ...actual }
                }
            }
        }
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
            const current = test.create(Core, 3), reference = test.create(TradingSignals, 3)
            const candles = [{ high: 4, low: 1, close: 2 }, { high: 5, low: 2, close: 3 }]
            for (let index = 0; index < 80; index++) {
                const candle = candles[index % 2]
                candle.high = 100 + index; candle.low = 90 + index; candle.close = 95 + index
                assert.deepStrictEqual(current.update(candle), reference.update(candle))
                assert.deepStrictEqual(readCoreResult(current), readCoreResult(reference))
            }
        }
    })
    check('core batch and replacement helpers preserve readiness and extrema', () => {
        for (const name of ['FasterEMA', 'FasterSMA', 'FasterWSMA']) {
            const current = new Core[name](3), reference = new TradingSignals[name](3)
            const prices = [1, , 2, 3, 4]
            assert.deepStrictEqual(current.updates(prices), reference.updates(prices))
            for (const value of [0, NaN, 7, -0]) {
                assert.deepStrictEqual(current.replace(value), reference.replace(value))
                assert.deepStrictEqual(readCoreResult(current), readCoreResult(reference))
                assert.deepStrictEqual([current.highest, current.lowest], [reference.highest, reference.lowest])
            }
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
            if (Baseline) assert.deepStrictEqual(snapshot(main), snapshot(create(Baseline).compute()))
        })
    }
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
            if (Baseline) assert.deepStrictEqual(expected, snapshot(configure(Baseline, input, options).compute()))
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
    console.log(`\n${passed} deterministic regression groups passed${Baseline ? '; exact baseline comparisons passed' : ''}.`)
}

const benchmark = Baseline => {
    const rows = Number(option('--rows') ?? 10000), repeats = Number(option('--repeats') ?? 7)
    assert.ok(Number.isInteger(rows) && rows >= 256 && rows <= 100000, '--rows must be 256..100000')
    assert.ok(Number.isInteger(repeats) && repeats >= 3 && repeats <= 30, '--repeats must be 3..30')
    const input = makeInput(rows)
    const entries = Baseline ? [['baseline', Baseline], ['current', OHLCV_INDICATORS]] : [['current', OHLCV_INDICATORS]]
    const samples = Object.fromEntries(entries.map(([name]) => [name, { compute: [], output: [] }]))
    for (let repetition = -2; repetition < repeats; repetition++) {
        // Alternate order to reduce warm-up/GC order bias. No timing assertions.
        for (const [name, Ctor] of repetition % 2 ? [...entries].reverse() : entries) {
            global.gc?.()
            const main = new Ctor({ input, config: { timeZone: 'UTC' } })
                .ema(10, { lag: 3 }).sma(20, { lag: 3 }).rsi(14, { retLogs: true, lag: 2 })
                .donchianChannels(128, 0, { lag: 2 }).donchianChannels(255, 5, { lag: 1 })
                .volumeOscillator(5, 10, { retLogs: true, lag: 2 }).lag(['close', 'volume'], 3)
            const start = performance.now()
            main.compute()
            const computed = performance.now()
            const output = main.getData({ skipNull: false, dateFormat: 'milliseconds' })
            const converted = performance.now()
            assert.equal(output.length, rows)
            if (repetition >= 0) { samples[name].compute.push(computed - start); samples[name].output.push(converted - computed) }
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
        const samples = { reference: [], core: [] }, storage = {}, last = {}
        const entries = [['reference', TradingSignals], ['core', Core]]
        for (let repetition = -2; repetition < repeats; repetition++) {
            for (const [name, lib] of repetition % 2 ? [...entries].reverse() : entries) {
                const instance = test.create(lib, 32), input = test.candle ? candles : prices
                const start = performance.now()
                for (const value of input) instance.update(value)
                const elapsed = performance.now() - start
                if (repetition >= 0) samples[name].push(elapsed)
                last[name] = readCoreResult(instance)
                if (repetition === repeats - 1) storage[name] = retainedStorage(instance)
            }
        }
        assert.deepStrictEqual(last.core, last.reference)
        const median = values => {
            const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2)
            return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
        }
        results[test.name] = {
            'reference ms': Number(median(samples.reference).toFixed(3)),
            'core ms': Number(median(samples.core).toFixed(3)),
            'reference array slots': storage.reference.slots,
            'core array slots': storage.core.slots,
            'core typed bytes': storage.core.bytes
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
