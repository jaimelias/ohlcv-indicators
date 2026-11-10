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

Serve the repository's `dist/ohlcv-indicators.min.js` with your application. The bundle exposes the class as `OHLCV_INDICATORS`:

```html
<script src="./dist/ohlcv-indicators.min.js"></script>
<script>
  const Indicators = OHLCV_INDICATORS;
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
| `volume` | Finite number greater than or equal to zero. Stored in a `Float64Array`; fractional values are preserved. |
| `date` | Optional. Prefer a valid `Date` or an ISO string with `Z` or an explicit timezone offset. Required by `dateTime()`. |
| Extra columns | Supported; columns and storage types are inferred from the first row. |

Use the full OHLCV shape shown above. The constructor checks for `close`, but the calculation loop also uses `open` for `mid_price`; different indicators require other columns.

Clean numeric strings such as `'102.50'` are also accepted. Use a consistent numeric representation for all OHLC fields. With `precision: true`, OHLC values **must** be numeric strings; see [precision mode](#precision-mode).

Required indicator inputs are checked at row zero. Subsequent rows are not comprehensively validated for performance, so validate your dataset before passing it in. Do not rely on the library to reject every malformed row. Numeric storage uses ordinary JavaScript numbers and their precision limits.

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

All methods below return the instance for chaining. Periods and lookbacks are measured in rows, not minutes or days. Most period parameters must be positive integers within the input length; allow extra history for warm-up. `scoreMomentum()` also accepts lookbacks beyond the available history, leaving its output `NaN` until enough rows exist. Avoid repeating configurations that produce the same output names.

Defaults are shown below. `target` means the numeric source column; `lag: n` creates output copies from each of the previous `1` through `n` rows. `retLogs` selects natural-log-based features, not application logging; see each indicator's formula below.

| Method | Options and behavior |
| --- | --- |
| `ema(size = 5, options = {})` | Exponential moving average, or logged distance `ln(target / EMA)` and change `ln(currentEMA / previousEMA)`. `{ target: 'close', lag: 0, retLogs: false }`. |
| `sma(size = 5, options = {})` | Simple moving average, or logged distance `ln(target / SMA)` and change `ln(currentSMA / previousSMA)`. `{ target: 'close', lag: 0, retLogs: false }`. |
| `bollingerBands(size = 20, stdDev = 2, options = {})` | Upper, middle, and lower close-price bands, or logarithmic width and position. `{ lag: 0, retLogs: false }`. |
| `donchianChannels(size = 20, offset = 0, options = {})` | Rolling high/low channel and midpoint, or logarithmic width and position. `{ lag: 0, retLogs: false }`; positive offset shifts the channel window into the past, not the close used for position. |
| `macd(fast = 12, slow = 26, signal = 9, options = {})` | Difference, signal (`dea`), and histogram. `{ target: 'close', lag: 0 }`. |
| `rsi(size = 14, options = {})` | RSI and a same-period SMA of RSI. `{ target: 'close', lag: 0, retLogs: false }`. |
| `mfi(size = 14, options = {})` | Money flow index using high, low, close, and volume. `{ lag: 0, retLogs: false }`; logged output uses `mathLog(MFI, 50)`. |
| `stochastic(kPeriod = 14, kSlowingPeriod = 3, dPeriod = 3, options = {})` | K and D outputs. `{ lag: 0, retLogs }`; explicitly supply `retLogs: false` or `true` in this version. |
| `atr(size = 14, options = {})` | Average true range. `{ lag: 0, retLogs: false }`. |
| `adx(size = 14, options = {})` | Average directional index. `{ lag: 0, retLogs: false }`. |
| `heikenAshi(smoothLength = null, afterSmoothLength = null, options = {})` | Heiken-Ashi body/wick/range returns and direction counter, not raw HA OHLC columns. `{ lag: 0, retLogs: false }`; use either two `null`s or two positive smoothing periods. |
| `relativeVolume(size = 10, options = {})` | Current volume / previous completed volume-SMA window, or its natural log, excluding the current sample from the denominator. `{ lag: 0, retLogs: false }`. |
| `volumeDelta(options = {})` | Candle-direction-based signed volume, delta high/low/close, and direction counter; not trade-by-trade bid/ask delta. `{ lag: 0 }`. |
| `volumeOscillator(fast = 5, slow = 10, options = {})` | One output: percentage difference, or `ln(fastVolumeEMA / slowVolumeEMA)` when logged. `{ lag: 0, retLogs: false }`. |
| `candleFeatures(options = {})` | Change, gap, body, wick, and range returns. `{ lag: 0, colKeys: [], retLogs: false }`. Extra `colKeys` compare current close to each selected price column, not that column's previous value. |
| `scoreMomentum(lookbacks = DEFAULT_LOOKBACKS)` | Weighted sum of closing-price log returns. Accepts only a lookbacks array of `{ sessions, weight }`; defaults to 21/63/126/252 rows with weights 0.10/0.30/0.40/0.20. |
| `zscore(rollingWindow = 200, colKeys, options = {})` | Population z-scores over each column's recent rows, or across selected columns within the current row. `{ lag: 0, rowWise: false }`; row-wise mode requires window `1` and at least two targets. Each window can be registered only once per instance. |
| `dateTime(options = {})` | Calendar features from `date`. `{ lag: 0, oneHot: false }`. |
| `crossPairs(pairs = [], options = {})` | Signed direction/run counters for `{ fast, slow }` pairs. `{ limit: null, oneHot: false }`; `slow` can be a column name or numeric constant. Call once with all pairs. |
| `lag(colKeys = ['close'], lookback = 1)` | Copies existing columns into `<column>_lag_1`, ..., `<column>_lag_<lookback>`. |

### Output names and units

Examples of names: `ema_5`, `sma_5_open`, `rsi_14`, `rsi_sma_14`, `mfi_14`, `atr_14`, `relative_volume_10`, and `volume_oscillator_5_10`.

A single Bollinger configuration normally uses `bollinger_bands_upper`, `bollinger_bands_middle`, and `bollinger_bands_lower`. With `useFullNames: true`, `.bollingerBands(20, 2)` adds `_20_2`. MACD and Donchian also expand their names when multiple configurations are registered. Use full names for persistent downstream schemas, and inspect `Object.keys(instance.getLastValues())` rather than guessing names.

For `retLogs: true`, RSI, MFI, and stochastic use `ln(value / 50)`, ADX uses `ln(value / 20)`, and ATR uses `ln(ATR / close)`. Their logged columns replace the corresponding raw outputs.

EMA and SMA each emit two columns with `retLogs: true`: `<prefix>_distance` uses `mathLog(currentTarget, currentAverage)`, and `<prefix>_change` uses `mathLog(currentAverage, previousAverage)`. The prefix is `ret_log_ema_<size>` or `ret_log_sma_<size>`, with `_<target>` appended for non-close sources. For example, `.sma(3, { target: 'open', retLogs: true })` produces `ret_log_sma_3_open_distance` and `ret_log_sma_3_open_change`. Distance becomes available when the average is stable; change needs a previous stable average too.

Relative volume's logged output is `ret_log_relative_volume_<size>`, containing `ln(currentVolume / previousCompletedSMA)`. This compares volume to its prior completed average, not to the previous volume observation. Raw mode is the default for all three methods.

Logged mode replaces the raw outputs, and generated lags cover only the selected outputs: both distance and change for moving averages, or the single ratio for relative volume. Register both modes to obtain raw and logged outputs; raw/log instances have independent state. Logs and their lags are dimensionless numbers even with `precision: true`. Logged ATR and its lags are also dimensionless.

```js
const logFeatures = new OHLCV_INDICATORS({ input })
  .ema(3, { retLogs: true, lag: 1 })
  .sma(3, { target: 'open', retLogs: true })
  .relativeVolume(3, { retLogs: true });

const savedLogConfig = JSON.parse(JSON.stringify(logFeatures.exportConfig()));
const replayedLogFeatures = new OHLCV_INDICATORS({ input, config: savedLogConfig });
console.log(replayedLogFeatures.getLastValues().ret_log_ema_3_distance);
console.log(replayedLogFeatures.getLastValues().ret_log_ema_3_change);
```

EMA and SMA skip missing/non-finite targets and leave unavailable outputs `NaN`; logged values use the shared `mathLog()` behavior described below. Relative volume's logged ratio requires positive operands and a finite positive ratio, otherwise it stays `NaN`. Relative volume skips zero-volume rows without updating its state. MACD and volume delta have no `retLogs` option.

`volumeOscillator()` also emits only the selected output:

- `retLogs: false` creates `volume_oscillator_<fast>_<slow>` containing `100 * (fastEMA - slowEMA) / slowEMA`.
- `retLogs: true` creates `ret_log_volume_oscillator_<fast>_<slow>` containing `mathLog(fastEMA, slowEMA)`; it does **not** create the percentage column.

Its `lag` option generates lags only for that selected column. To obtain both forms, register both modes before computation, for example `.volumeOscillator(5, 10, { lag: 2 }).volumeOscillator(5, 10, { retLogs: true, lag: 2 })`. Each mode has independent EMA state; both outputs and their lags are dimensionless.

Non-log candle and Heiken-Ashi returns are fractions, not percentages: `0.01` means 1%. Unavailable indicator values can remain `NaN`. The shared `mathLog()` helper substitutes `0.001` for a zero numerator or denominator and throws for incompatible signs or a non-finite result; its zero handling is not literal `ln(0)`. Heiken-Ashi uses this helper, while candle features calculate log ratios directly.

### Bollinger and Donchian: logarithmic channel features

With `{ retLogs: true }`, these methods replace their three raw price columns with two dimensionless features. Given upper bound `U`, lower bound `L`, and the current candle's close `C`:

```text
logRange = ln(U / L)
width = logRange / 2
position = 2 * ln(C / L) / logRange - 1
```

`position` is `-1` at the lower bound, `+1` at the upper bound, and `0` at their geometric midpoint, `sqrt(U * L)`. Breakouts remain below `-1` or above `+1`; values are not clipped. These describe the current channel, not returns from the previous candle. Donchian's `offset` shifts only the bounds: position always compares the **current close** to that historical channel.

The compact output names are `ret_log_bollinger_bands_width`, `ret_log_bollinger_bands_position`, `ret_log_donchian_channel_width`, and `ret_log_donchian_channel_position`. With `useFullNames: true` or more than one registration of the same method (counting both modes), they append `_<size>_<stdDev>` for Bollinger or `_<size>_<offset>` for Donchian. Prefer full names for a stable downstream schema.

This example reuses the five quick-start candles and includes saved-config replay:

```js
const channelFeatures = new OHLCV_INDICATORS({
  input,
  config: { useFullNames: true },
})
  .bollingerBands(3, 2, { retLogs: true, lag: 1 })
  .donchianChannels(3, 1, { retLogs: true, lag: 1 });

const savedChannelConfig = JSON.parse(JSON.stringify(channelFeatures.exportConfig()));
const replayedChannels = new OHLCV_INDICATORS({ input, config: savedChannelConfig });
const lastChannel = replayedChannels.getLastValues();
console.log(lastChannel.ret_log_bollinger_bands_width_3_2);
console.log(lastChannel.ret_log_donchian_channel_position_3_1);
console.log(lastChannel.ret_log_donchian_channel_position_3_1_lag_1);
```

Both bounds must be finite, positive, ordered (`U >= L`), and have a finite representable ratio. Invalid bounds leave both features `NaN`. In particular, Bollinger's lower band can be zero or negative despite valid positive input prices; it is not clamped and there is no fallback transform. Valid equal bounds produce width `0`, but position remains `NaN` because it is undefined. Width depends only on the bounds; an invalid close or close/bound ratio leaves position `NaN` without discarding an otherwise valid width.

The default is `{ retLogs: false }`. To obtain raw bands as well, register the same method again in raw mode before computation; raw/log variants maintain independent state. Each registration generates lags only for its selected outputs. Logged columns and their lags are not price-based and remain dimensionless in precision mode. No absolute log-center column is allocated: two numeric outputs instead of three save approximately `8 * input.length * (1 + lag)` bytes per registration.

A flat or otherwise invalid final channel can make default `getData()` return `[]`, because `skipNull` removes the prefix through the last invalid row. Use `getData({ skipNull: false })` to inspect these rows and their `NaN` positions.

### Momentum score: weighted log returns

`scoreMomentum()` sums `weight * ln(currentClose / closeFromSessionsRowsAgo)` for each lookback. It emits one dimensionless score, without normalizing the supplied weights. Positive scores indicate weighted upward movement and negative scores downward movement.

The default lookbacks are:

```js
[
  { sessions: 21, weight: 0.10 },
  { sessions: 63, weight: 0.30 },
  { sessions: 126, weight: 0.40 },
  { sessions: 252, weight: 0.20 },
]
```

Custom lookbacks must form a nonempty array with unique positive-integer `sessions`. Each weight must be a finite number between `0.1` and `1`, and the sum must not exceed `1`, allowing a floating-point tolerance of `1e-9`. The method accepts only `lookbacks`; it has no options, `retLogs`, or generated-lag parameter. Use an explicit `.lag()` registration when needed.

This example uses the five quick-start candles:

```js
const momentum = new OHLCV_INDICATORS({ input })
  .scoreMomentum([
    { sessions: 1, weight: 0.4 },
    { sessions: 3, weight: 0.6 },
  ])
  .lag(['score_momentum'], 1);

const lastMomentum = momentum.getLastValues();
console.log(lastMomentum.score_momentum);
console.log(lastMomentum.score_momentum_lag_1);
```

The compact name is `score_momentum`. With `useFullNames: true` or multiple `scoreMomentum()` registrations, append each lookback's `_<sessions>_<weight>` in array order. The example above would then produce `score_momentum_1_0.4_3_0.6`; use that full name for explicit lags. Duplicate configurations that produce the same output name throw during computation. The score and its lags remain dimensionless in precision mode.

A largest lookback of `N` requires `N + 1` input rows. Defaults therefore require **253 rows** before the first score. A requested data limit does not guarantee that a provider returns that much history; check the actual input length. With intraday candles, `sessions` counts candles, not trading days.

Row-zero close validation requires a positive finite value. After warm-up, an invalid current or selected historical close, or an unrepresentable ratio/result, leaves the score `NaN`. Zero volume does not affect the calculation. `getLastValues()` can return `NaN` when history is insufficient, and default `getData()` can return `[]`.

### Z-scores: historical and row-wise

`zscore(rollingWindow = 200, colKeys, { lag = 0, rowWise = false } = {})` supports two ways to normalize selected numeric columns. Both use population variance and return dimensionless values. `rowWise` must be a boolean.

`colKeys` is required and must be a nonempty array of unique, nonempty column names. Each target column must exist when the handler initializes; register its producer first. A target's first values may be unavailable. Finite negative and zero values are valid inputs in either mode.

With **`rowWise: false`**, each target is compared to its own latest `rollingWindow` values, **including the current row**:

```text
mean = sum(windowValues) / rollingWindow
variance = sum((windowValue - mean)²) / rollingWindow
zscore = (currentValue - mean) / sqrt(variance)
```

`rollingWindow` must be a positive integer no greater than the input length. To use the default window while selecting targets, call `.zscore(undefined, ['close'])` on at least 200 input rows.

This example also uses the quick-start candles:

```js
const normalized = new OHLCV_INDICATORS({ input })
  .sma(2)
  .zscore(3, ['close', 'sma_2'], { lag: 1 });

const lastNormalized = normalized.getLastValues();
console.log(lastNormalized.zscore_3_close);
console.log(lastNormalized.zscore_3_sma_2);
console.log(lastNormalized.zscore_3_sma_2_lag_1);
```

Each target needs a complete window of consecutive finite values. A missing or non-finite observation resets only that target's warm-up; other targets continue independently. Outputs remain `NaN` until a full valid window exists again. Constant historical windows, including every historical window of size 1, have zero standard deviation and produce `NaN`.

With **`rowWise: true`**, `rollingWindow` must be **exactly `1`** and `colKeys` must contain **at least two targets**. The comparison group contains only the selected values from the current row:

```text
columnCount = colKeys.length
mean = sum(selectedValuesInCurrentRow) / columnCount
variance = sum((selectedValue - mean)²) / columnCount
output[target] = (currentTargetValue - mean) / sqrt(variance)
```

This example compares the four price columns on each quick-start candle:

```js
const rowNormalized = new OHLCV_INDICATORS({ input })
  .zscore(1, ['open', 'high', 'low', 'close'], { rowWise: true, lag: 1 });

const lastRowNormalized = rowNormalized.getLastValues();
console.log(lastRowNormalized.zscore_1_close);
console.log(lastRowNormalized.zscore_1_close_lag_1);
```

Row-wise mode starts as soon as every selected source has a finite current value; it has no additional historical warm-up. If any selected value is missing or non-finite, **all row-wise outputs for that row** remain `NaN`, keeping the comparison group fixed. Calculation resumes on the next complete valid row. If all selected values are equal, variance is zero and all outputs remain `NaN`. Invalid arithmetic also leaves all outputs `NaN`.

Choose targets with comparable units. In precision mode, row-wise calculation divides price-based source values by the shared precision multiplier before comparison; other source values retain their units. This prevents internally scaled prices from dominating unscaled features solely because precision mode is enabled. The calculation uses the available internal source precision before output formatting.

For both modes, output names are `zscore_<rollingWindow>_<targetKey>`, regardless of `useFullNames`. `{ lag: n }` adds `<output>_lag_1` through `<output>_lag_n`. Outputs and their lags remain dimensionless in precision mode. Generated lags require additional history, and normal `skipNull` handling applies to every output. `lag` and `rowWise` are the supported options.

Only one `zscore` registration per `rollingWindow` is allowed on an instance, even with different targets, modes, or lag settings. Put all targets for that window in one `colKeys` array. Different windows can coexist, for example `.zscore(3, ['close']).zscore(1, ['open', 'close'], { rowWise: true })`. Duplicate windows are rejected during registration and saved-config replay. Config export/replay preserves the selected mode and parameters; omitting `rowWise` selects the default historical mode.

### Money flow index: raw, logged, and lagged

MFI weights typical price `(high + low + close) / 3` by volume, then compares positive and negative flow over the selected period. Rising typical prices contribute positive flow, falling prices negative flow, and unchanged prices zero. The result is `100 - 100 / (1 + positiveFlow / negativeFlow)`. See the [MFI calculation reference](https://www.tradingview.com/support/solutions/43000502348-money-flow-mfi/).

This example reuses the five quick-start candles, so it uses a short period:

```js
const moneyFlow = new OHLCV_INDICATORS({ input })
  .mfi(3, { lag: 1 })
  .mfi(3, { lag: 1, retLogs: true });

const lastMoneyFlow = moneyFlow.getLastValues();
console.log(lastMoneyFlow.mfi_3);             // Raw index, between 0 and 100
console.log(lastMoneyFlow.ret_log_mfi_3);     // 50 maps to 0; below 50 is negative
console.log(lastMoneyFlow.mfi_3_lag_1);       // Previous candle's MFI
```

For ordinary use, call `.mfi()` for period 14, or `.mfi(14, { lag: 2, retLogs: true })` for logged output and two lags. Logged output is named `ret_log_mfi_14`; raw and logged variants can coexist at the same period without sharing state. Both are dimensionless, including their lags, even with `precision: true`.

MFI needs one starting candle plus `size` flow observations: period 14 first becomes available at index 14 (the fifteenth row). Zero-volume candles contribute zero **and count toward this window**; unlike `relativeVolume`, `volumeDelta`, and `volumeOscillator`, MFI does not skip them. A positive-only window returns 100, a negative-only window returns 0, and a window with no directional flow returns `NaN`. Logged zero uses the existing `mathLog` epsilon behavior. Invalid flow/comparisons leave output `NaN` until they leave the window. Storage is bounded by the period; summation is chronological to avoid rolling-subtraction drift.

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
  .mfi(14, { lag: 2, retLogs: true })
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

Register producers before consumers: for example, register `.ema(5)` before asking `.lag(['ema_5'], 1)` to read its output. Do not create the same lag twice using both an indicator's `lag` option and an explicit `.lag()` call.

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
- For identical results, reuse identical ordered input, the same library version, and unambiguous dates. The config schema version alone does not pin library behavior.
- Exported objects are independent copies. Runtime-generated lag jobs are not added to the saved declarations; replay regenerates them from their options.
- Configuration values must be JSON-safe. Functions, `undefined`, `NaN`, `Infinity`, circular references, and non-plain objects are not supported as configuration.

JSON safety applies to exported **configuration**, not arbitrary result rows. Serializing results converts `NaN` to `null`, and typed-array vectors are not serialized as ordinary arrays automatically.

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
- **A derived target fails at row zero:** many handlers require positive finite values at the first row for non-volume targets. This restricts using warming-up outputs (such as an EMA) or signed/zero-valued extra input columns as inputs to those indicators or `crossPairs()`. Registering the producer first does not bypass their value validation. `zscore()` accepts these values: historical mode waits for a complete finite window, while row-wise mode waits for every selected source's current value. Its target columns must already exist in either mode.
- **Row-wise z-score validation or missing output:** use window `1`, at least two unique targets, and `{ rowWise: true }`. All selected values must be finite on the current row and must not all be equal; otherwise the entire row-wise output group remains `NaN`.
- **Date errors:** use `Date` objects or timezone-qualified ISO strings consistently. Numeric millisecond input currently has a formatter-name mismatch; wrap it with `new Date(timestampMs)` first. Millisecond *output* is supported. Local/timezone-less strings can parse differently across runtimes.
- **Unexpected volume:** inputs use `Float64Array` storage and JavaScript number precision. Fractional values are preserved, but integers above `Number.MAX_SAFE_INTEGER` cannot all be represented exactly.
- **MACD on a non-price target:** its outputs are always marked price-based. With `precision: true`, targets such as volume or a custom ratio are therefore rescaled incorrectly; use `precision: false` for those targets.
- **Comparing raw and logged variants:** use separate instances for ADX, stochastic, or Heiken-Ashi at identical periods/smoothing settings. Their raw/log variants can share internal state despite having different output names.
- **Cross one-hot output:** provide a finite integer `limit` of at least 2 (within the input length) when `oneHot: true` so the vector has a meaningful fixed size.

These are descriptions of the current implementation, not promises that invalid inputs will always throw. No data cleaning or strategy decisions are performed for you.

## Notes for developers and LLMs

Use this section as a compact implementation contract, alongside [AGENTS.md](./AGENTS.md).

- Public entry point: default ESM export `OHLCV_INDICATORS` from `index.js`. Constructor shape: `{ input, ticker?, chunkProcess?, config? }`.
- Registration is separate from execution. `inputParams` contains immutable declarations; `executionParams` is the mutable runtime queue. Never serialize runtime instances, buffers, or generated jobs. All configuration parameters must be JSON-safe.
- Handlers execute chronologically, allocate columns on `index === 0`, and keep rolling state in `main.instances`. The runtime is column-oriented even though input and returned data are row-oriented.
- `initializeColumns()` owns output allocation, naming collision checks, price metadata, and generated lags. Numeric outputs normally use `Float64Array` with `NaN`; object/one-hot columns use arrays. Volume input uses `Float64Array`.
- `src/core-indicators/` contains the local numeric indicator classes used at runtime, with no external indicator dependency. Self-contained tests cover known results and fixed behavior traces. Preserve warm-up, arithmetic order, and intentional zero/NaN behavior when changing these classes.
- Full output storage grows with both row count and column count. Each `Float64Array` column uses approximately `8 * input.length` bytes, excluding other overhead. Lags add full columns; `getData()` allocates row objects on each call. Request only needed features, or use `getLastValues()` when you only need the final row.
- `chunkProcess` does not turn the API into asynchronous, streaming, or bounded-memory processing. Create a new instance for each independent run and retain the input separately if you need replay.
- Read the implementation for exact output naming and formulas; do not assume every third-party indicator convention or parameter combination is supported.
