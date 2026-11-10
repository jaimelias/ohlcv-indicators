import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import OHLCV from '../index.js';

const near = (actual, expected) => {
    if (Number.isNaN(expected)) assert.ok(Number.isNaN(actual), `${actual} should be NaN`);
    else assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
};
const freeze = value => {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
};
const rawRows = (length = 12) => Array.from({ length }, (_, i) => ({
    open: 100 + i, high: 104 + i, low: 98 + i, close: 102 + i,
    volume: 100 + i, a: i - 3, b: i + 3, c: i + 9, feature: 2 + i / 7
}));
const population = values => {
    if (!values.every(Number.isFinite)) return values.map(() => NaN);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    return values.map(value => variance > 0 ? (value - mean) / Math.sqrt(variance) : NaN);
};

// Exact pre-change temporal output, including invalid-value recovery and chunk boundaries.
const temporalInput = Array.from({length: 260}, (_, i) => ({open: 100 + i/10, high: 102 + i/10,
    low: 99 + i/10, close: 101 + i/10 + Math.sin(i/3), volume: i%7,
    feature: i===61 || i===191 ? NaN : Math.cos(i/5)*4}));
const temporal = explicitFalse => new OHLCV({input: temporalInput, chunkProcess: 100}).sma(3)
    .zscore(5, ['close', 'sma_3', 'feature'], explicitFalse ? {lag: 2, rowWise: false} : {lag: 2})
    .zscore(1, ['close'], explicitFalse ? {rowWise: false} : {});
const temporalStudy = temporal(false);
const originalTemporalRows = temporalStudy.getData({skipNull:false});
assert.equal(createHash('sha256').update(JSON.stringify(originalTemporalRows)).digest('hex'),
    'de272c0e460ce87a10120e3ba3ce1572c679ed6d553c0ac465f9fb30e08e64fe');
assert.deepEqual(temporal(true).getData({skipNull:false}), originalTemporalRows);
const oldConfig = temporalStudy.exportConfig();
for (const job of oldConfig.inputParams) if (job.key === 'zscore') delete job.params[2].rowWise;
assert.deepEqual(new OHLCV({input:temporalInput, config: freeze(oldConfig)}).getData({skipNull:false}), originalTemporalRows);

const input = rawRows();
const study = new OHLCV({input}).zscore(1, ['a', 'b', 'c'], {rowWise: true, lag: 2});
const saved = freeze(JSON.parse(JSON.stringify(study.exportConfig())));
const output = study.getData({skipNull:false});
for (let i = 0; i < output.length; i++) {
    const expected = population([input[i].a, input[i].b, input[i].c]);
    ['a', 'b', 'c'].forEach((target, t) => near(output[i][`zscore_1_${target}`], expected[t]));
    if (i >= 2) ['a', 'b', 'c'].forEach(target => near(output[i][`zscore_1_${target}_lag_2`], output[i-2][`zscore_1_${target}`]));
}
near(output[0].zscore_1_a, -Math.sqrt(1.5));
near(output[0].zscore_1_b, 0);
near(output[0].zscore_1_c, Math.sqrt(1.5));
const single = new OHLCV({input:rawRows(1), config:{useFullNames:true}}).zscore(1, ['a','b'], {rowWise:true}).getLastValues();
near(single.zscore_1_a, -1);
near(single.zscore_1_b, 1);
assert.ok(Number.isNaN(output[0].zscore_1_a_lag_1));
assert.equal(study.getData().length, input.length - 2);
assert.deepEqual(study.exportConfig(), saved);
assert.equal(saved.inputParams[0].params[2].rowWise, true);
assert.equal(saved.inputParams.length, 1);
for (let run = 0; run < 2; run++) {
    const replay = new OHLCV({input, config:saved});
    assert.deepEqual(replay.getData({skipNull:false}), output);
    assert.deepEqual(replay.exportConfig(), saved);
}
for (const target of ['a', 'b', 'c']) {
    assert.ok(study.verticalOhlcv[`zscore_1_${target}`] instanceof Float64Array);
    assert.ok(!study.priceBased.has(`zscore_1_${target}`));
    assert.ok(!study.priceBased.has(`zscore_1_${target}_lag_2`));
}
const copy = study.exportConfig();
copy.inputParams[0].params[1].push('unrelated');
assert.deepEqual(study.exportConfig(), saved);
const explicitLag = new OHLCV({input}).zscore(1, ['a', 'b', 'c'], {rowWise:true}).lag(['zscore_1_a', 'zscore_1_b', 'zscore_1_c'], 2);
assert.deepEqual(explicitLag.getData({skipNull:false}), output);

// All-or-nothing observations, constants, and immediate next-row recovery.
for (const invalid of [NaN, Infinity, -Infinity, undefined, 'invalid']) {
    const data = rawRows(5);
    data[1].b = invalid;
    data[3].a = data[3].b = data[3].c = 0;
    const test = new OHLCV({input:data}).zscore(1, ['a', 'b', 'c'], {rowWise:true});
    const result = test.getData({skipNull:false});
    for (const t of ['a', 'b', 'c']) {
        assert.ok(Number.isNaN(result[1][`zscore_1_${t}`]));
        assert.ok(Number.isNaN(result[3][`zscore_1_${t}`]));
        assert.ok(Number.isFinite(result[2][`zscore_1_${t}`]));
        assert.ok(Number.isFinite(result[4][`zscore_1_${t}`]));
    }
    assert.equal(test.getData().length, 1);
}
const warmed = new OHLCV({input}).sma(3).zscore(1, ['close', 'sma_3'], {rowWise:true, lag:1});
const warmRows = warmed.getData({skipNull:false});
for (const i of [0, 1]) {
    assert.ok(Number.isNaN(warmRows[i].zscore_1_close));
    assert.ok(Number.isNaN(warmRows[i].zscore_1_sma_3));
}
assert.ok(Number.isFinite(warmRows[2].zscore_1_close));
assert.ok(Number.isFinite(warmRows[3].zscore_1_close_lag_1));
const finalInvalid = rawRows(3);
finalInvalid.at(-1).a = NaN;
assert.deepEqual(new OHLCV({input:finalInvalid}).zscore(1,['a','b'],{rowWise:true}).getData(), []);

// Dimensionless outputs must not depend on internal fixed-point price scaling.
const strings = input.map(row => ({...row, open:row.open.toFixed(4), high:row.high.toFixed(4), low:row.low.toFixed(4), close:row.close.toFixed(4)}));
for (const targets of [['open', 'high', 'low', 'close'], ['close', 'feature'], ['close', 'sma_3', 'feature']]) {
    const make = (data, precision) => new OHLCV({input:data, config:{precision}}).sma(3).zscore(1, targets, {rowWise:true, lag:1});
    const numeric = make(input, false).getData({skipNull:false});
    const precise = make(strings, true);
    const preciseRows = precise.getData({skipNull:false});
    for (let i = 0; i < input.length; i++) for (const target of targets) near(preciseRows[i][`zscore_1_${target}`], numeric[i][`zscore_1_${target}`]);
    assert.deepEqual(new OHLCV({input:strings, config:precise.exportConfig()}).getData({skipNull:false}), preciseRows);
}

const rowOptions = {rowWise:true};
const validationInput = rawRows(260);
for (const params of [[2,['a','b'],rowOptions], [200,['a','b'],rowOptions], [undefined,['a','b'],rowOptions],
    [1,['a'],rowOptions], [1,[],rowOptions], [1,['a','a'],rowOptions], [1,['a',''],rowOptions],
    [1,['a','b'],{rowWise:'true'}], [1,['a','b'],{rowWise:0}], [1,['a','b'],{rowWise:null}],
    [1,['a','b'],{rowWise:undefined}], [1,['a','b'],{rowWise:true,lag:0.5}],
    [1,['a','b'],{rowWise:true,lag:-1}], [1,['a','b'],{rowWise:true,other:1}]]) {
    assert.throws(() => new OHLCV({input:validationInput}).zscore(...params));
    assert.throws(() => new OHLCV({input:validationInput, config:{inputParams:[{key:'zscore',params}]}}));
}
assert.throws(() => new OHLCV({input}).zscore(1,['a','missing'],rowOptions).compute(), /Target column.*missing/);
for (const firstRowWise of [true, false]) {
    assert.throws(() => new OHLCV({input}).zscore(1,['a','b'],{rowWise:firstRowWise}).zscore(1,['a','c'],{rowWise:!firstRowWise}), /already registered/);
    assert.throws(() => new OHLCV({input, config:{inputParams:[
        {key:'zscore',params:[1,['a','b'],{rowWise:firstRowWise}]},
        {key:'zscore',params:[1,['a','c'],{rowWise:!firstRowWise}]}
    ]}}), /already registered/);
}
const combined = new OHLCV({input}).zscore(1,['a','b'],rowOptions).zscore(3,['close']);
assert.ok(Number.isFinite(combined.getLastValues().zscore_3_close));
assert.throws(() => study.zscore(1,['a','b'],rowOptions), /already computed/);
const busy = new OHLCV({input});
busy.isComputing = true;
assert.throws(() => busy.zscore(1,['a','b'],rowOptions), /in progress/);

if (process.argv[2]) {
    const context = vm.createContext({inputJSON:JSON.stringify(input)});
    vm.runInContext(readFileSync(process.argv[2], 'utf8'), context);
    const browser = vm.runInContext('new OHLCV_INDICATORS({input:JSON.parse(inputJSON)}).zscore(1,["a","b","c"],{rowWise:true,lag:2}).getLastValues()', context);
    ['a','b','c'].forEach(target => near(browser[`zscore_1_${target}`], output.at(-1)[`zscore_1_${target}`]));
}
console.log('Temporal exact-regression and row-wise zscore checks passed.');
