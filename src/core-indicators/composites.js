import { Indicator } from './indicator.js'
import { FasterSMA } from './movingAverages.js'

export class FasterBollingerBands extends Indicator {
  constructor(interval, deviationMultiplier = 2) {
    super()
    this.interval = interval
    this.deviationMultiplier = deviationMultiplier
    this.prices = new Float64Array(interval)
    this.count = 0
    this.head = 0
  }

  update(price) {
    // Custom Array-backed columns may contain raw values whose addition must not be coerced.
    if (typeof price !== 'number' && !Array.isArray(this.prices)) {
      this.prices = Array.from(this.prices)
    }

    if (this.count < this.interval) {
      this.prices[this.count++] = price
      return
    }

    // The first full window is deliberately skipped, matching the original warm-up.
    this.prices[this.head] = price
    this.head = (this.head + 1) % this.interval

    let sum = 0
    let slot = this.head
    for (let i = 0; i < this.count; i++) {
      sum += this.prices[slot]
      if (++slot === this.interval) slot = 0
    }
    const middle = this.count ? sum / this.count : 0
    let deviationMiddle = middle
    if (!deviationMiddle && Array.isArray(this.prices)) {
      // Match the original average || fallback, including repeated raw-value coercion.
      sum = 0
      slot = this.head
      for (let i = 0; i < this.count; i++) {
        sum += this.prices[slot]
        if (++slot === this.interval) slot = 0
      }
      deviationMiddle = this.count ? sum / this.count : 0
    }

    // Re-sum in chronological order; a rolling variance changes floating-point results.
    let squaredSum = 0
    slot = this.head
    for (let i = 0; i < this.count; i++) {
      const difference = this.prices[slot] - deviationMiddle
      squaredSum += difference * difference
      if (++slot === this.interval) slot = 0
    }
    const standardDeviation = Math.sqrt(this.count ? squaredSum / this.count : 0)

    return (this.result = {
      lower: middle - standardDeviation * this.deviationMultiplier,
      middle,
      upper: middle + standardDeviation * this.deviationMultiplier
    })
  }
}

export class FasterMACD extends Indicator {
  constructor(short, long, signal) {
    super()
    this.short = short
    this.long = long
    this.signal = signal
    this.pricesCounter = 0
  }

  update(price, replace = false) {
    if (!replace || this.pricesCounter === 0) this.pricesCounter++

    const short = this.short.update(price, replace)
    const long = this.long.update(price, replace)

    if (this.pricesCounter > this.long.interval) this.pricesCounter--
    if (this.pricesCounter === this.long.interval) {
      const macd = short - long
      const signal = this.signal.update(macd, replace)
      return (this.result = { histogram: macd - signal, macd, signal })
    }
  }
}

export class FasterStochasticOscillator extends Indicator {
  constructor(n, m, p) {
    super()
    this.n = n
    this.m = m
    this.p = p
    this.periodM = new FasterSMA(m)
    this.periodP = new FasterSMA(p)
    // Keep candle references: callers may reuse or mutate objects retained in the window.
    this.candles = new Array(n)
    this.count = 0
    this.head = 0
  }

  update(candle) {
    if (this.count < this.n) {
      this.candles[this.count++] = candle
    } else {
      this.candles[this.head] = candle
      this.head = (this.head + 1) % this.n
    }

    if (this.count === this.n) {
      let highest = -Infinity
      let lowest = Infinity
      let slot = this.head
      for (let i = 0; i < this.count; i++) {
        highest = Math.max(highest, this.candles[slot].high)
        if (++slot === this.n) slot = 0
      }
      slot = this.head
      for (let i = 0; i < this.count; i++) {
        lowest = Math.min(lowest, this.candles[slot].low)
        if (++slot === this.n) slot = 0
      }

      const divisor = highest - lowest
      const fastK = ((candle.close - lowest) * 100) / (divisor === 0 ? 1 : divisor)
      const stochK = this.periodM.update(fastK)
      // Zero and NaN deliberately skip periodP, while still producing a result.
      const stochD = stochK && this.periodP.update(stochK)
      if (stochK !== undefined && stochD !== undefined) {
        return (this.result = { stochD, stochK })
      }
    }
  }
}
