# OHLCV Indicators

Compute technical indicators and features from an array of market candles. Configure the calculations with a chain of methods, then get the results as ordinary JavaScript objects.

**OHLCV** means **open, high, low, close, and volume**. Each input row represents one candle. The library is useful for preparing backtest data, building feature datasets, and calculating indicators for trading applications; it does not fetch market data or execute trades.

This README describes the API in this repository. Keep the same library version when reproducing stored configurations.

## Contents

- [Install and quick start](#install-and-quick-start)
- [Input requirements](#input-requirements)
- [How calculation and output work](#how-calculation-and-output-work)
- [Constructor options](#constructor-options)
- [Indicator reference](#indicator-reference)
- [Advanced: combine indicators and lagged features](#advanced-combine-indicators-and-lagged-features)
- [Save and reuse a configuration](#save-and-reuse-a-configuration)
- [Advanced: custom columns with portable callbacks](#advanced-custom-columns-with-portable-callbacks)
- [Precision mode](#precision-mode)
- [Current limitations and troubleshooting](#current-limitations-and-troubleshooting)
- [Notes for developers and LLMs](#notes-for-developers-and-llms)

## Install and quick start

```sh
npm install ohlcv-indicators
```

Use ES modules: save your script as `.mjs`, or set `"type": "module"` in your application's `package.json`.

### Calculate a simple moving average

A moving average smooths prices over a window. `sma(3)` averages the latest three closing prices.

```js
import OHLCV_INDICATORS from 'ohlcv-indicators';

const input = [
  { date: '2024-01-01T00:00:00Z', open: 100, high: 103, low: 99, close: 102, volume: 1000 },
  { date: '2024-01-02T00:00:00Z', open: 102, high: 105, low: 101, close: 104, volume: 1200 },
  { date: '2024-01-03T00:00:00Z', open: 104, high: 105, low: 100, close: 102, volume: 900 },
  { date: '2024-01-04T00:00:00Z', open: 102, high: 107, low: 101, close: 106, volume: 1500 },
  { date: '2024-01-05T00:00:00Z', open: 106, high: 109, low: 105, close: 108, volume: 1300 },
];

const study = new OHLCV_INDICATORS({
  input,
  config: { timeZone: 'UTC', dateFormat: 'iso' },
}).sma(3);

const rows = study.getData();
console.table(rows);

const latest = study.getLastValues();
console.log(latest.close); // 108
console.log(latest.sma_3); // 105.33333333333333
```

`rows` contains the last three candles: the first two do not yet have enough history for the average. Each result includes the original columns, `mid_price` (`(open + close) / 2`), and `sma_3`.

To keep the warm-up rows too:

```js
// Reuses the already computed study; it does not calculate the indicators again.
const allRows = study.getData({ skipNull: false });
console.log(allRows.length); // 5
console.log(allRows[0].sma_3); // NaN: not enough history yet
```

Later examples reuse `input` and the import above unless they define their own data.

### Browser bundle

Serve the repository's `dist/ohlcv-indicators.min.js` with your application. The current bundle exposes the class through `OHLCV_INDICATORS.default`:

```html
<script src="./dist/ohlcv-indicators.min.js"></script>
<script>
  const Indicators = OHLCV_INDICATORS.default;
  const candles = [
    { open: 10, high: 12, low: 9, close: 11, volume: 100 },
    { open: 11, high: 13, low: 10, close: 12, volume: 120 },
    { open: 12, high: 14, low: 11, close: 13, volume: 110 },
  ];
  console.log(new Indicators({ input: candles }).sma(2).getLastValues());
</script>
```

Use a modern JavaScript runtime with typed arrays and `Intl.DateTimeFormat` support. Browser bundling does not imply that every host environment has been tested.

## Input requirements

Provide a nonempty array ordered **oldest to newest**, with consistent columns and value types. The library does not sort candles, fill missing timestamps, or resample their intervals.

| Field | Recommended input |
| --- | --- |
| `open`, `high`, `low`, `close` | Finite numbers greater than zero. Whole-number prices are valid too. |
| `volume` | Integer greater than or equal to zero; currently limited to `0`–`2147483647` by `Int32Array` storage. |
| `date` | Optional. Prefer a valid `Date` or an ISO string with `Z` or an explicit timezone offset. Required by `dateTime()`. |
| Extra columns | Supported; columns and storage types are inferred from the first row. |

Use the full OHLCV shape shown above. The constructor checks for `close`, but the calculation loop also uses `open` for `mid_price`; different indicators require other columns.

Clean numeric strings such as `'102.50'` are also accepted. Use a consistent numeric representation for all OHLC fields. With `precision: true`, OHLC values **must** be numeric strings; see [precision mode](#precision-mode).

Required indicator inputs are checked at row zero. Subsequent rows are not comprehensively validated for performance, so validate your dataset before passing it in. In particular, integer storage can truncate fractional volume or wrap oversized values before a handler sees them. Do not rely on the library to reject every malformed row.

## How calculation and output work

1. Construct an instance with input candles.
2. Chain all indicators and features you want.
3. Call `compute()`, `getData()`, or `getLastValues()` to calculate once.

| Method | Result |
| --- | --- |
| `compute()` | Calculates and returns the instance, without building output row objects. |
| `getData({ skipNull?, dateFormat? })` | Calculates if needed and returns an array of rows. |
| `getLastValues({ dateFormat? })` | Calculates if needed and returns one final row, even if it contains unavailable values. |
| `exportConfig()` | Returns a fresh JSON-safe configuration without triggering calculation. |

Register everything before calculation. You cannot append indicators or new candles to a computed instance. Create another instance to change the setup or process another dataset. `getLastValues()` still computes the full input history; it is not a streaming update API.

### Warm-up and missing values

Numeric outputs generally start as `NaN` until sufficient history exists. Combined indicators may need more rows than their period alone suggests. For example, RSI also produces an SMA of RSI, which needs additional history.

`skipNull: true` is the default. It returns only the suffix **after the last row containing any `NaN`, `null`, or `undefined` column value**. It does not just remove individual bad rows. A late missing value can therefore discard many earlier valid rows; an invalid final row can make the result `[]`. This check is not a general finite-number check: `Infinity` is not filtered by it.

Use `getData({ skipNull: false })` when debugging or when you need one output row for every input row. Missing values remain missing; they are not replaced with zero.

`relativeVolume()`, `volumeDelta()`, and `volumeOscillator()` deliberately skip zero-volume candles without updating their indicator state. Their output on those candles stays `NaN`, and their warm-up can take more calendar rows.

## Constructor options

```js
const configured = new OHLCV_INDICATORS({
  input,
  ticker: 'EXAMPLE',
  chunkProcess: 2000,
  config: {
    schemaVersion: 1,
    precision: false,
    useFullNames: true,
    inputParams: null,
    dateFormat: 'iso',
    skipNull: false,
    timeZone: 'UTC',
  },
}).ema(3);
```

Only `input` is required. Put calculation and output settings inside `config`, not at the constructor's top level.

| Option | Default | Meaning |
| --- | --- | --- |
| `ticker` | `null` | Optional label used in some validation messages; does not load data. |
| `chunkProcess` | `2000` | Loop chunk size, integer `100`–`50000`. Processing remains synchronous and retains full output columns. |
| `config.schemaVersion` | `1` | Configuration format version, not the package version. |
| `config.precision` | `false` | Enables fixed-point input conversion from price strings. |
| `config.useFullNames` | `false` | Includes parameter suffixes in indicators with optional compact names. |
| `config.inputParams` | `null` | Saved indicator declarations. An array, even `[]`, triggers calculation during construction. |
| `config.dateFormat` | `'milliseconds'` | Default date representation in returned rows. |
| `config.skipNull` | `true` | Default invalid-prefix handling for `getData()`. |
| `config.timeZone` | Runtime timezone | Explicit timezone for `dateTime()` calendar features; saved in exports. |

Supported output date formats: `milliseconds`, `seconds`, `iso` / `toISOString`, `object` (a `Date`), `string` / `toString`, and `toUTCString`. Getter overrides do not change exported defaults. Prefer `iso`, `milliseconds`, or `seconds` for portable output; local string formatting depends on the runtime.

## Indicator reference

All methods below return the instance for chaining. Periods and lookbacks are measured in rows, not minutes or days. Periods must be positive integers within the input length; allow extra history for warm-up. Avoid repeating configurations that produce the same output names.

Defaults are shown below. `target` means the numeric source column; `lag: n` creates output copies from each of the previous `1` through `n` rows. `retLogs` means natural-log ratios, not application logging.

| Method | Options and behavior |
| --- | --- |
| `ema(size = 5, options = {})` | Exponential moving average. `{ target: 'close', lag: 0 }`. |
| `sma(size = 5, options = {})` | Simple moving average. `{ target: 'close', lag: 0 }`. |
| `bollingerBands(size = 20, stdDev = 2, options = {})` | Upper, middle, and lower close-price bands. `{ lag: 0 }`. |
| `donchianChannels(size = 20, offset = 0, options = {})` | Rolling high/low channel and midpoint. `{ lag: 0 }`; positive offset shifts the window into the past. |
| `macd(fast = 12, slow = 26, signal = 9, options = {})` | Difference, signal (`dea`), and histogram. `{ target: 'close', lag: 0 }`. |
| `rsi(size = 14, options = {})` | RSI and a same-period SMA of RSI. `{ target: 'close', lag: 0, retLogs: false }`. |
| `stochastic(kPeriod = 14, kSlowingPeriod = 3, dPeriod = 3, options = {})` | K and D outputs. `{ lag: 0, retLogs }`; explicitly supply `retLogs: false` or `true` in this version. |
| `atr(size = 14, options = {})` | Average true range. `{ lag: 0, retLogs: false }`. |
| `adx(size = 14, options = {})` | Average directional index. `{ lag: 0, retLogs: false }`. |
| `heikenAshi(smoothLength = null, afterSmoothLength = null, options = {})` | Heiken-Ashi body/wick/range returns and direction counter, not raw HA OHLC columns. `{ lag: 0, retLogs: false }`; use either two `null`s or two positive smoothing periods. |
| `relativeVolume(size = 10, options = {})` | Current volume / previous completed volume-SMA window, excluding the current sample from the denominator. `{ lag: 0 }`. |
| `volumeDelta(options = {})` | Candle-direction-based signed volume, delta high/low/close, and direction counter; not trade-by-trade bid/ask delta. `{ lag: 0 }`. |
| `volumeOscillator(fast = 5, slow = 10, options = {})` | `100 * (fastVolumeEMA - slowVolumeEMA) / slowVolumeEMA`. `{ lag: 0, retLogs: false }`. |
| `candleFeatures(options = {})` | Change, gap, body, wick, and range returns. `{ lag: 0, colKeys: [], retLogs: false }`. Extra `colKeys` compare current close to each selected price column, not that column's previous value. |
| `dateTime(options = {})` | Calendar features from `date`. `{ lag: 0, oneHot: false }`. |
| `crossPairs(pairs = [], options = {})` | Signed direction/run counters for `{ fast, slow }` pairs. `{ limit: null, oneHot: false }`; `slow` can be a column name or numeric constant. Call once with all pairs. |
| `mapCols(newCols = ['change'], callback = null, options = {})` | Custom columns. `{ lag: 0, isPriceBased: false, callbackParams: {} }`. See the callback example below. |
| `lag(colKeys = ['close'], lookback = 1)` | Copies existing columns into `<column>_lag_1`, ..., `<column>_lag_<lookback>`. |

### Output names and units

Examples of names: `ema_5`, `sma_5_open`, `rsi_14`, `rsi_sma_14`, `atr_14`, `relative_volume_10`, and `volume_oscillator_5_10`.

A single Bollinger configuration normally uses `bollinger_bands_upper`, `bollinger_bands_middle`, and `bollinger_bands_lower`. With `useFullNames: true`, `.bollingerBands(20, 2)` adds `_20_2`. MACD and Donchian also expand their names when multiple configurations are registered. Use full names for persistent downstream schemas, and inspect `Object.keys(instance.getLastValues())` rather than guessing names.

For `retLogs: true`, RSI and stochastic use `ln(value / 50)`, ADX uses `ln(value / 20)`, and ATR uses `ln(ATR / close)`. Their logged columns replace the corresponding raw outputs. Volume oscillator is different: it keeps its percentage column and **adds** `ret_log_volume_oscillator_<fast>_<slow>` containing `ln(fastEMA / slowEMA)`.

Non-log candle and Heiken-Ashi returns are fractions, not percentages: `0.01` means 1%. Unavailable indicator values can remain `NaN`. The shared `mathLog()` helper substitutes `0.001` for a zero numerator or denominator and throws for incompatible signs or a non-finite result; its zero handling is not literal `ln(0)`. Candle and Heiken-Ashi features have their own log calculations.

## Advanced: combine indicators and lagged features

This runnable example generates deterministic demonstration candles. Replace them with your own chronological dataset in a real application.

```js
const history = Array.from({ length: 160 }, (_, i) => {
  const open = 100 + i * 0.1 + Math.sin(i / 5);
  const close = open + Math.cos(i / 3) * 0.8;
  return {
    date: new Date(Date.UTC(2024, 0, 1) + i * 3600000).toISOString(),
    open,
    high: Math.max(open, close) + 1,
    low: Math.min(open, close) - 1,
    close,
    volume: 1000 + (i % 20) * 25,
  };
});

const features = new OHLCV_INDICATORS({
  input: history,
  config: { useFullNames: true, timeZone: 'UTC', dateFormat: 'iso' },
})
  .ema(5, { lag: 2 })
  .ema(20)
  .rsi(14)
  .macd(12, 26, 9)
  .bollingerBands(20, 2)
  .donchianChannels(20, 1)
  .stochastic(14, 3, 3, { retLogs: false })
  .atr(14)
  .adx(14)
  .relativeVolume(10)
  .volumeOscillator(5, 10, { retLogs: true })
  .candleFeatures({ retLogs: true })
  .dateTime({ oneHot: true })
  .crossPairs([{ fast: 'close', slow: 'open' }], { limit: 5, oneHot: true })
  .lag(['close', 'volume'], 2);

const featureRows = features.getData();
const lastFeature = features.getLastValues();
console.log(featureRows.length);
console.log(lastFeature.ema_5_lag_1); // EMA value from the previous row
console.log(lastFeature.macd_histogram_12_26_9);
console.log(lastFeature.one_hot_hour); // Uint8Array of length 24
```

Register producers before consumers: for example, create a custom column before asking `lag()` to read it. Do not create the same lag twice using both an indicator's `lag` option and an explicit `.lag()` call.

A lag always refers to an earlier row, not an earlier nonzero-volume row. Features on the current candle can depend on its final high, low, close, and volume; account for candle completion when using them in a backtest.

Numeric `dateTime()` weekdays use Monday = 1 through Sunday = 7. One-hot weekdays instead use Sunday at index 0 through Saturday at index 6. One-hot values are `Uint8Array` vectors; convert with `Array.from(vector)` if another tool needs plain arrays. One-hot calendar output omits the year.

## Save and reuse a configuration

`exportConfig()` saves **the recipe**, not the candles or computed values. It includes indicator declarations, precision/naming settings, date output defaults, and timezone. It excludes `input`, `ticker`, `chunkProcess`, buffers, and indicator state.

The following Node.js example writes the recipe to a file, loads it, and reproduces the result. It reuses the quick-start `input`.

```js
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const original = new OHLCV_INDICATORS({
  input,
  config: { timeZone: 'UTC', dateFormat: 'iso', useFullNames: true },
})
  .sma(3, { lag: 1 })
  .volumeOscillator(2, 3, { retLogs: true });

// Export before computing. Exporting afterward gives the same recipe.
const storedConfig = original.exportConfig();
await writeFile('./indicator-config.json', JSON.stringify(storedConfig, null, 2));

const expectedRows = original.getData();
assert.deepStrictEqual(original.exportConfig(), storedConfig);

// Later, or in another process using the same library version:
const loadedConfig = JSON.parse(await readFile('./indicator-config.json', 'utf8'));
const restored = new OHLCV_INDICATORS({ input, config: loadedConfig });
assert.deepStrictEqual(restored.getData(), expectedRows);

// Reuse the exact same saved object again; the constructor does not mutate it.
const restoredAgain = new OHLCV_INDICATORS({ input, config: loadedConfig });
assert.deepStrictEqual(restoredAgain.getData(), expectedRows);

// Apply the same recipe to a different dataset. Results depend on that data.
const onOtherHistory = new OHLCV_INDICATORS({ input: history, config: loadedConfig });
console.log(onOtherHistory.getLastValues());
```

The last two lines use `history` from the advanced example. In a browser, store the same JSON text in your chosen storage instead of using `node:fs/promises`.

Important replay rules:

- Passing `config.inputParams` as an array computes immediately, even if it is empty. Do **not** chain more indicators onto a restored instance.
- Preserve the whole exported config; saving only `inputParams` loses settings that affect the result.
- For identical results, reuse identical ordered input, the same library version, the same callback implementations, and unambiguous dates. The config schema version alone does not pin library behavior.
- Exported objects are independent copies. Runtime-generated lag jobs are not added to the saved declarations; replay regenerates them from their options.
- Custom callbacks must be registered in each process before importing their configs. Function source and closures are not serialized.
- Configuration values must be JSON-safe. Functions without registered names, `undefined`, `NaN`, `Infinity`, circular references, and non-plain objects cannot be exported as configuration.

JSON safety applies to exported **configuration**, not arbitrary result rows. Serializing results converts `NaN` to `null`, and typed-array vectors are not serialized as ordinary arrays automatically.

## Advanced: custom columns with portable callbacks

`mapCols()` runs a callback once per input row. It receives `{ index, main, params }`; input and previously calculated columns are available at `main.verticalOhlcv[column][index]`.

Register a versioned callback name so that its configuration can be saved and replayed. This example reuses `input` from the quick start and the `assert` import from the save-and-reuse example:

```js
const bodyPercent = ({ index, main, params }) => {
  const { open, close } = main.verticalOhlcv;
  return {
    body_percent: ((close[index] - open[index]) / open[index]) * params.scale,
  };
};

OHLCV_INDICATORS.registerMapCallback('body-percent.v1', bodyPercent);

const custom = new OHLCV_INDICATORS({
  input,
  config: { timeZone: 'UTC', dateFormat: 'iso' },
}).mapCols(['body_percent'], 'body-percent.v1', {
  callbackParams: { scale: 100 },
  lag: 1,
});

const customConfig = JSON.parse(JSON.stringify(custom.exportConfig()));
const customRows = custom.getData();
const customReplay = new OHLCV_INDICATORS({ input, config: customConfig });
assert.deepStrictEqual(customReplay.getData(), customRows);
console.log(customReplay.getLastValues().body_percent);
```

In a new process, define and register `body-percent.v1` before constructing `customReplay`. Registration is runtime-local. Do not replace an existing callback name with different code; register `body-percent.v2` instead.

Callback guidelines:

- Declare every output name in `newCols`, return only those keys, and do not overwrite existing columns.
- Return `null` or `undefined` to leave that row's custom outputs unavailable.
- Put configurable values in JSON-safe `callbackParams`. Do not depend on changing closure state, randomness, clocks, or external services if you need reproducible replay.
- Treat `main` as read-only apart from returning your declared values. Do not mutate input, internal queues, configuration, or other columns.
- With precision mode, price columns in `verticalOhlcv` are scaled internal values. Ratios such as the example above cancel that scale. Use `isPriceBased: true` only for custom outputs that remain in scaled price units; that option requires `precision: true`.

You may pass an unregistered function directly for local use, but `exportConfig()` will throw until it has a registered name. The built-in callback name `default` is reserved. With no callback, `.mapCols()` creates `change = 100 * (close[i] - open[i - 1]) / open[i - 1]`, not the usual close-to-close return; use an explicit callback when you want another formula.

## Precision mode

Use numeric strings for all OHLC prices when enabling precision:

```js
const stringPrices = input.map(row => ({
  ...row,
  open: row.open.toFixed(4),
  high: row.high.toFixed(4),
  low: row.low.toFixed(4),
  close: row.close.toFixed(4),
}));

const fixedPoint = new OHLCV_INDICATORS({
  input: stringPrices,
  config: { precision: true, timeZone: 'UTC', dateFormat: 'iso' },
}).sma(3);

console.log(fixedPoint.getLastValues().sma_3); // 105.3333
```

Prices are scaled internally using a shared multiplier derived from the first row, then price-based outputs are restored to ordinary numbers. This is **not arbitrary-precision decimal arithmetic**: calculations still use JavaScript numbers. Extra decimal places beyond the chosen scale are truncated, including fractional scaled indicator results during output conversion. Keep scaled prices within JavaScript's safe-integer range and use a consistent decimal scale throughout your dataset.

## Current limitations and troubleshooting

- **“Already computed” error:** register all methods before calling any getter or `compute()`. Imported configs already computed during construction.
- **Empty output:** inspect `getData({ skipNull: false })`. You may need more history, or a late missing/zero-volume row may have moved the `skipNull` cutoff.
- **Stochastic options error:** explicitly call, for example, `.stochastic(14, 3, 3, { retLogs: false })`; the current implementation does not supply that boolean's default.
- **A derived target fails at row zero:** source validation requires positive finite values at the first row for non-volume targets. This restricts using warming-up outputs (such as an EMA) or signed/zero-valued custom columns as inputs to another indicator or `crossPairs()`. Registering the producer first does not bypass that validation.
- **Date errors:** use `Date` objects or timezone-qualified ISO strings consistently. Numeric millisecond input currently has a formatter-name mismatch; wrap it with `new Date(timestampMs)` first. Millisecond *output* is supported. Local/timezone-less strings can parse differently across runtimes.
- **Unexpected volume:** storage is signed 32-bit integer. Normalize data externally; larger counts and fractional volumes are not preserved.
- **Logged ATR with precision:** the current handler marks even logged ATR as price-based, so `precision: true` rescales that dimensionless output incorrectly. Avoid that combination until corrected; use `precision: false` for logged ATR.
- **MACD on a non-price target:** its outputs are always marked price-based. With `precision: true`, targets such as volume or a custom ratio are therefore rescaled incorrectly; use `precision: false` for those targets.
- **Comparing raw and logged variants:** use separate instances for ADX, stochastic, or Heiken-Ashi at identical periods/smoothing settings. Their raw/log variants can share internal state despite having different output names.
- **Cross one-hot output:** provide a finite integer `limit` of at least 2 (within the input length) when `oneHot: true` so the vector has a meaningful fixed size.

These are descriptions of the current implementation, not promises that invalid inputs will always throw. No data cleaning or strategy decisions are performed for you.

## Notes for developers and LLMs

Use this section as a compact implementation contract, alongside [AGENTS.md](./AGENTS.md).

- Public entry point: default ESM export `OHLCV_INDICATORS` from `index.js`. Constructor shape: `{ input, ticker?, chunkProcess?, config? }`. There are no public `scaler()` or `vidya()` methods.
- Registration is separate from execution. `inputParams` contains immutable declarations; `executionParams` is the mutable runtime queue. Never serialize runtime instances, buffers, generated jobs, or resolved callback functions.
- Handlers execute chronologically, allocate columns on `index === 0`, and keep rolling state in `main.instances`. The runtime is column-oriented even though input and returned data are row-oriented.
- `initializeColumns()` owns output allocation, naming collision checks, price metadata, and generated lags. Numeric outputs normally use `Float64Array` with `NaN`; object/one-hot columns use arrays. Volume input uses `Int32Array`.
- `src/core-indicators/` contains the local numeric indicator classes used at runtime. `trading-signals` is retained as a regression reference, not a production indicator import. Preserve warm-up, arithmetic order, and intentional zero/NaN behavior when changing these classes.
- Full output storage grows with both row count and column count. Each `Float64Array` column uses approximately `8 * input.length` bytes, excluding other overhead. Lags add full columns; `getData()` allocates row objects on each call. Request only needed features, or use `getLastValues()` when you only need the final row.
- `chunkProcess` does not turn the API into asynchronous, streaming, or bounded-memory processing. Create a new instance for each independent run and retain the input separately if you need replay.
- Read the implementation for exact output naming and formulas; do not assume every third-party indicator convention or parameter combination is supported.

### Development checks

From a checkout with dependencies installed:

```sh
npm test
npm test -- --benchmark --rows 20000 --repeats 9
npm run build
git diff --check
```

`test/test.js` runs deterministic local regressions by default, including indicator behavior, configuration replay, and core-class comparisons. `npm test -- --live` is an optional integration demo requiring its configured market-data service. Build the browser bundle with `npm run build`; do not edit the minified file manually.

The package declares the ISC license. Adapted core indicator code retains its upstream MIT notice; preserve that notice when redistributing it and the generated bundle's accompanying license file.
