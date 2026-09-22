# Core indicators

Local numeric `Faster*` indicator implementations. The existing constructor arguments, `update(value,
replace?)`, `isStable`, and `getResult()` interface remain available. The
numeric series also retain result/extrema and replacement semantics. These
use ordinary JavaScript numbers, not arbitrary-precision decimal arithmetic.

```js
import { FasterEMA } from './index.js'

const ema = new FasterEMA(14)
ema.update(price)
const value = ema.isStable ? ema.getResult() : NaN
```

`getResult()` still throws `NotEnoughDataError` during warm-up for API
compatibility. All readiness checks are non-throwing; project handlers check
readiness before reading. EMA still returns its provisional result from
`update()` before it becomes stable, so do not substitute that return value
for a readiness-checked read.

## Storage and calculation choices

- EMA uses scalar state and a readiness counter.
- SMA uses a bounded circular `Float64Array`. It sums oldest to newest to
  preserve floating-point rounding and recovery after NaN/Infinity. It remains
  O(period) per update rather than adopting a different running-sum formula.
- WSMA releases its seed SMA after initialization, then updates in O(1).
- RSI retains two prices instead of the entire input history.
- MACD uses a capped counter instead of retaining an unused price window.
- Bollinger uses a bounded numeric ring and two ordered passes, without
  intermediate deviation arrays. Its size + 1 warm-up is intentional.
- Stochastic uses a bounded candle-reference ring, scans extrema without
  temporary arrays, and preserves the original zero/NaN smoothing behavior.
- TR/ATR/DX/ADX retain the existing arithmetic and replacement behavior.

Scalar rings switch once to a bounded ordinary Array if a non-number is
provided. This preserves existing JavaScript coercion for custom mapped
columns without adding object storage for normal numeric input. NaN and
Infinity remain numeric values and do not trigger this fallback. Candle
references are retained where the reference implementation observes mutations
of previously supplied objects. Private buffer layouts intentionally differ.

## Verification

`npm test` checks known core results and fixed behavior traces captured before
runtime optimizations, checks bounded retained storage, and exercises all
public indicators, precision/log modes, lags, callbacks, and config replay.
These checks are self-contained: no third-party indicator library or test
oracle is installed. Preserve the trace expectations unless intentionally
changing the corresponding behavior.

`node test/test.js --baseline /path/to/original/index.js --benchmark` also
compares the full pipeline with a pre-change checkout. Benchmarks report
local timings and retained array slots/buffer bytes, not total heap usage or
performance guarantees. Results must remain exact; changing summation order,
warm-up, or quirks is a separate behavior change.

Adapted portions retain the upstream MIT notice in `indicator.js`, also
preserved in the generated distribution's license notice.
