# OHLCV Indicators Agent Guide

## Project

`ohlcv-indicators` is an ESM JavaScript library for computing stateful indicators over OHLCV rows. The public API is chainable and row-oriented, while the runtime stores data column-wise in typed arrays for backtesting and feature generation.

Input rows normally contain `open`, `high`, `low`, `close`, and `volume`; `date` is optional. Most studies require the full OHLC set even though the constructor currently enforces only `close`.

## Core design

1. `index.js` owns the `OHLCV_INDICATORS` class. The constructor accepts `{ input, ticker?, chunkProcess?, config? }`. Public indicator methods validate arguments and register immutable `{ key, order?, params }` declarations through `_registerIndicator()`; they do not calculate results immediately.
2. `compute()`, `getData()`, or `getLastValues()` starts the one-shot calculation. Do not allow indicators to be registered after computation.
3. `compute()` copies declarations into `main.executionParams` and sorts only that runtime queue. `src/core-functions/mainLoop.js` creates input columns in `main.verticalOhlcv`, walks rows in chronological order, writes the raw row and `mid_price`, and invokes every queued handler from `mainFunctions`.
4. Indicator handlers initialize state and output columns when `index === 0`, keep rolling state in `main.instances`, update once per row, and write through `main.pushToMain()`.
5. Output columns start as `NaN` during warm-up or after an unexpected value. `areKeyValuesValid()` records the last invalid row in `main.invalidValueIndex`; `getData({ skipNull: true })` starts after that row.
6. `verticalToHorizontal()` converts the column store back to row objects. Temporary columns in `verticalOhlcvTempCols` are not returned.

### Indicator contract

- Add or change the public method in `index.js`, then import and register its runtime handler in `mainFunctions` in `src/core-functions/mainLoop.js`.
- At `index === 0`, validate required source columns, create a unique instance key, and declare outputs through `initializeColumns(main, columns, { lag })`. Each declaration has a `key` and optional `type`, `fill`, `enabled`, `priceBased`, and `includeInLag`; numeric outputs default to `Float64Array` filled with `NaN`.
- Preserve `NaN` for warm-up and invalid output. Never substitute zero for unavailable numeric data.
- Update each stateful instance exactly once per row. Reject duplicate configurations when they would share an instance or output key.
- Let `initializeColumns` append generated lag jobs only to `main.executionParams` after allocation, using only enabled outputs. Never call the public `main.lag()` during computation. Set `includeInLag: false` for explicit exclusions. Numeric lag columns use `Float64Array` to preserve missing values as `NaN`; object/one-hot lag columns use `Array` with `null`.
- Add an output to `main.priceBased` only when it remains in scaled price units. Ratios, percentages, return logs, counters, dates, volume, and one-hot vectors are not price-based.
- `retLogs` outputs use natural log ratios through `mathLog(a, b)` where applicable. Logged values are dimensionless.
- Keep output names deterministic. When multiple configurations are supported, include enough parameters and target information to prevent collisions.
- `src/core-indicators/` supplies compatible numeric EMA, SMA, WSMA, RSI, MACD, Bollinger Bands, stochastic, ATR, and ADX implementations. Use cheap `isStable` checks before `getResult()`; do not use exceptions for routine warm-up. The installed `trading-signals@5.0.4` remains a test oracle, not a production import.
- Preserve reference arithmetic order, warm-up, zero/NaN behavior, and update/replacement sequencing in core classes. SMA/Bollinger use bounded chronological rings rather than rolling sums that change rounding. RSI history and MACD counters must stay bounded; WSMA releases its seed window. Runtime state must never enter exported config.

## Configuration export and replay guards

- `config` contains `schemaVersion` (currently `1`), `precision`, `useFullNames`, `inputParams`, `dateFormat`, `skipNull`, and `timeZone`.
- Omitting `config.inputParams` (or setting it to `null`) creates a chainable instance. Supplying an array, including `[]`, imports independent copies and computes immediately.
- `exportConfig()` returns a new JSON-safe snapshot. Export before and after `compute()`, `getData()`, or `getLastValues()` must produce equivalent configuration. Never include generated lag jobs, indicator instances, buffers, cached column references, or resolved callback functions in that snapshot.
- `this.inputParams` is persistent configuration, not a work queue. Keep declarations deeply copied and frozen. Register public methods through `_registerIndicator()`; never sort, push into, or edit existing declarations directly. Runtime caching and parameter mutation belong only in `executionParams` or `instances`.
- Sorting and generated jobs must affect only `executionParams`. Import must never mutate the caller's config, even when the same saved object is replayed repeatedly. Exports must not share nested arrays or objects with the instance or the imported config.
- Every public indicator method must reject registration during or after computation. Preserve the `isComputing` reentrancy guard and the `isComputed` guard, including for `stochastic()`.
- `mapCols` accepts a callback function or a registered string name. Register portable callbacks with `OHLCV_INDICATORS.registerMapCallback('name.v1', callback)` before loading configs. The built-in callback uses the reserved name `default`. Never overwrite a registered name with different code; use a new versioned name.
- Callback arguments belong in `mapCols` options as JSON-safe `callbackParams`; callbacks receive them as `params` in `{ index, main, params }`. Resolve callbacks and copy their arguments only into the runtime queue. Registered callbacks must derive results from supplied input/params, not changing closure state, clocks, randomness, or external services.
- Unregistered callbacks may execute locally, but export must throw explicitly. Do not serialize function source, evaluate stored code, or silently let JSON replace functions, undefined, or non-finite numbers with null. Reject unsupported config versions, circular references, and non-JSON objects.
- `dateFormat` and `skipNull` in config are output defaults. Per-call getter overrides must not modify exported settings. `timeZone` is stored explicitly (defaults to the resolved runtime timezone) and controls `dateTime` calendar features through a per-instance formatter.
- Cross-runtime replay requires identical inputs, callback implementations, and library versions. Use unambiguous input dates (valid Date objects, supported timestamps, or ISO strings with `Z`/offsets). Timezone-less date strings and local `dateFormat: 'string'/'toString'` output still depend on runtime date parsing/formatting; prefer `iso`, `milliseconds`, or `seconds` for portable output.
- Verify JSON export/import both before and after computation, repeated reuse of one frozen saved config, nested-copy isolation, generated and explicit lags, callback resolution, constructor/output defaults, and calendar features across runtime timezones.

## Indicator files

### Moving averages and channels

- `src/moving-averages/movingAverages.js` — shared runtime for public `ema()` and `sma()`.
- `src/moving-averages/bollingerBands.js` — Bollinger upper, middle, and lower bands.
- `src/moving-averages/donchianChannel.js` — rolling Donchian upper, basis, and lower channels with optional offset.
- `src/moving-averages/heikenAshi.js` — optional pre/post-smoothed Heiken-Ashi structure returns and trend counter.
- `src/moving-averages/macd.js` — MACD difference, signal/DEA, and histogram for a selectable target.
- `src/moving-averages/relativeVolume.js` — current volume divided by the previous completed volume-SMA window.

### Oscillators and volume

- `src/oscillators/rsi.js` — RSI plus an SMA of RSI, optionally expressed as log ratios to 50.
- `src/oscillators/stochastic.js` — stochastic K and D, optionally expressed as log ratios to 50.
- `src/oscillators/volumeDelta.js` — signed per-bar volume and consecutive buy/sell direction counter.
- `src/oscillators/volumeOscillator.js` — percentage difference and optional log ratio between fast and slow volume EMAs.

### Volatility

- `src/volatility/atr.js` — ATR or its log ratio to close.
- `src/volatility/adx.js` — ADX or its log ratio to the neutral reference value.

### Studies and feature utilities

- `src/studies/candleFeatures.js` — candle change, gap, body, wick, range, mid-price, and selected price-target returns.
- `src/studies/dateTime.js` — numeric or one-hot calendar features.
- `src/studies/findCrosses.js` — signed intervals since a cross, optional clipping, and optional one-hot encoding.
- `src/studies/lag.js` — lag columns for existing vertical columns.
- `src/studies/mapCols.js` — custom user-defined columns produced by a callback.

## Minimum required helpers

- `src/core-functions/mainLoop.js` — handler registry and chronological execution engine.
- `src/core-indicators/index.js` — compatible `Faster*` class exports; `src/core-indicators/README.md` records storage choices and reference-compatibility constraints.
- `src/core-functions/initializeColumns.js` — output allocation using `main.len`, explicit type/fill overrides, price metadata, collision checks, and lag registration from the same declarations.
- `src/core-functions/pushToMain.js` — column writes and per-row validity checks.
- `src/utilities/assignTypes.js` — input type inference, typed-array allocation, and array-type lookup used by lagging.
- `src/utilities/validators.js` — public API and queued-parameter validation.
- `src/utilities/config.js` — strict configuration copying/freezing, schema version, named callback registration/resolution, and JSON-safe parameter export.
- `src/utilities/verticalToHorizontal.js` — output materialization, invalid-prefix skipping, temporary-column filtering, and precision restoration.
- `src/utilities/numberUtilities.js` — input/output numeric formatters, numeric classification, and volume-number predicates.
- `src/utilities/precisionMultiplier.js` — fixed-point conversion for exact price-string processing when `precision: true`.
- `src/utilities/math.js` — finite-number checks and safe natural log ratios.
- `src/utilities/dateUtilities.js` — date input detection/conversion and requested output formatting.
- `src/machine-learning/ml-utilities.js` — one-hot vector creation used by date and cross studies.

## Precision and storage rules

- With `precision: false`, price inputs use normal floating-point values.
- With `precision: true`, OHLC price strings are converted to fixed-point numbers using one shared multiplier. Price-based indicator outputs stay in those units internally and are restored only during output conversion.
- Volume is currently stored in an `Int32Array`; do not assume that integer typed arrays preserve `NaN`.
- `Array` columns are used for objects such as dates and one-hot vectors; numeric indicator outputs normally use `Float64Array`.

## Changes and verification

- Preserve unrelated working-tree changes; indicator files are frequently edited together.
- Do not edit `dist/ohlcv-indicators.min.js` manually. Run `npm run build` after source changes that should ship in the browser bundle.
- Use deterministic local OHLCV arrays to test warm-up boundaries, zero/invalid inputs, lagged columns, multiple configurations, `retLogs`, `precision: true`, and both `getData()` modes.
- Run `git diff --check`, `npm test`, and `npm run build`. `test/test.js` runs deterministic local regression checks by default; `npm test -- --live` runs the optional integration demo against its configured market-data service.
