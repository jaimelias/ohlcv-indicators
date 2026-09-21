# OHLCV Indicators Agent Guide

## Project

`ohlcv-indicators` is an ESM JavaScript library for computing stateful indicators over OHLCV rows. The public API is chainable and row-oriented, while the runtime stores data column-wise in typed arrays for backtesting and feature generation.

Input rows normally contain `open`, `high`, `low`, `close`, and `volume`; `date` is optional. Most studies require the full OHLC set even though the constructor currently enforces only `close`.

## Core design

1. `index.js` owns the `OHLCV_INDICATORS` class. Public indicator methods validate arguments and append `{ key, order?, params }` entries to `this.inputParams`; they do not calculate results immediately.
2. `compute()`, `getData()`, or `getLastValues()` starts the one-shot calculation. Do not allow indicators to be registered after computation.
3. `src/core-functions/mainLoop.js` creates input columns in `main.verticalOhlcv`, walks rows in chronological order, writes the raw row and `mid_price`, and invokes every queued handler from `mainFunctions`.
4. Indicator handlers initialize state and output columns when `index === 0`, keep rolling state in `main.instances`, update once per row, and write through `main.pushToMain()`.
5. Output columns start as `NaN` during warm-up or after an unexpected value. `areKeyValuesValid()` records the last invalid row in `main.invalidValueIndex`; `getData({ skipNull: true })` starts after that row.
6. `verticalToHorizontal()` converts the column store back to row objects. Temporary columns in `verticalOhlcvTempCols` are not returned.

### Indicator contract

- Add or change the public method in `index.js`, then import and register its runtime handler in `mainFunctions` in `src/core-functions/mainLoop.js`.
- At `index === 0`, validate required source columns, create a unique instance key, and allocate every enabled output as `new Float64Array(len).fill(NaN)` unless the output intentionally needs another representation.
- Preserve `NaN` for warm-up and invalid output. Never substitute zero for unavailable numeric data.
- Update each stateful instance exactly once per row. Reject duplicate configurations when they would share an instance or output key.
- For `lag > 0`, call `main.lag(outputKeys, lag)` after allocating all output columns. Include every enabled public output that should be lagged.
- Add an output to `main.priceBased` only when it remains in scaled price units. Ratios, percentages, return logs, counters, dates, volume, and one-hot vectors are not price-based.
- `retLogs` outputs use natural log ratios through `mathLog(a, b)` where applicable. Logged values are dimensionless.
- Keep output names deterministic. When multiple configurations are supported, include enough parameters and target information to prevent collisions.
- `trading-signals` supplies the stateful EMA, SMA, RSI, MACD, Bollinger Bands, stochastic, ATR, and ADX implementations.

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
- `src/core-functions/pushToMain.js` — column writes and per-row validity checks.
- `src/utilities/assignTypes.js` — input type inference, typed-array allocation, and array-type lookup used by lagging.
- `src/utilities/validators.js` — public API and queued-parameter validation.
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
- Run `git diff --check`, relevant Node smoke tests, and `npm run build`. `npm test` uses the local integration harness and may require its configured market-data service.
