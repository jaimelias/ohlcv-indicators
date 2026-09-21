import { NumberIndicator } from './indicator.js';
import { FasterWSMA } from './movingAverages.js';

export class FasterTR extends NumberIndicator {
  constructor() {
    super();
    this.previousCandle = undefined;
    this.twoPreviousCandle = undefined;
  }

  update(candle, replace = false) {
    const { high, low } = candle;
    const highLow = high - low;
    if (this.previousCandle && replace) this.previousCandle = this.twoPreviousCandle;
    if (this.previousCandle) {
      const highClose = Math.abs(high - this.previousCandle.close);
      const lowClose = Math.abs(low - this.previousCandle.close);
      this.twoPreviousCandle = this.previousCandle;
      this.previousCandle = candle;
      return this.setResult(Math.max(highLow, highClose, lowClose), replace);
    }
    this.twoPreviousCandle = this.previousCandle;
    this.previousCandle = candle;
    return this.setResult(highLow, replace);
  }
}

export class FasterATR extends NumberIndicator {
  constructor(interval, SmoothingIndicator = FasterWSMA) {
    super();
    this.interval = interval;
    this.tr = new FasterTR();
    this.smoothing = new SmoothingIndicator(interval);
  }

  update(candle, replace = false) {
    const trueRange = this.tr.update(candle, replace);
    this.smoothing.update(trueRange, replace);
    if (this.smoothing.isStable) return this.setResult(this.smoothing.getResult(), replace);
  }
}

export class FasterDX extends NumberIndicator {
  constructor(interval, SmoothingIndicator = FasterWSMA) {
    super();
    this.interval = interval;
    this.atr = new FasterATR(interval, SmoothingIndicator);
    this.movesDown = new SmoothingIndicator(interval);
    this.movesUp = new SmoothingIndicator(interval);
    this.previousCandle = undefined;
    this.mdi = undefined;
    this.pdi = undefined;
  }

  updateState(candle, pdm = 0, mdm = 0) {
    this.atr.update(candle);
    this.movesUp.update(pdm);
    this.movesDown.update(mdm);
    this.previousCandle = candle;
  }

  update(candle) {
    if (!this.previousCandle) {
      this.updateState(candle);
      return;
    }
    const higherHigh = candle.high - this.previousCandle.high;
    const lowerLow = this.previousCandle.low - candle.low;
    const pdm = higherHigh < 0 || higherHigh < lowerLow ? 0 : higherHigh;
    const mdm = lowerLow < 0 || lowerLow < higherHigh ? 0 : lowerLow;
    this.updateState(candle, pdm, mdm);

    if (this.movesUp.isStable) {
      const atr = this.atr.getResult();
      this.pdi = this.movesUp.getResult() / atr;
      this.mdi = this.movesDown.getResult() / atr;
      const dmDiff = Math.abs(this.pdi - this.mdi);
      const dmSum = this.pdi + this.mdi;
      if (dmSum === 0) return this.setResult(0, false);
      return this.setResult((dmDiff / dmSum) * 100, false);
    }
  }
}

export class FasterADX extends NumberIndicator {
  constructor(interval, SmoothingIndicator = FasterWSMA) {
    super();
    this.interval = interval;
    this.adx = new SmoothingIndicator(interval);
    this.dx = new FasterDX(interval, SmoothingIndicator);
  }

  get mdi() {
    return this.dx.mdi;
  }

  get pdi() {
    return this.dx.pdi;
  }

  update(candle, replace = false) {
    // DX/smoothing intentionally advance on replace, matching the existing API.
    const result = this.dx.update(candle);
    if (result !== undefined) this.adx.update(result);
    if (this.adx.isStable) return this.setResult(this.adx.getResult(), replace);
  }
}
