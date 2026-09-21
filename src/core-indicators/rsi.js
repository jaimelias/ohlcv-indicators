import { NumberIndicator } from './indicator.js';
import { FasterWSMA } from './movingAverages.js';

export class FasterRSI extends NumberIndicator {
  constructor(interval, SmoothingIndicator = FasterWSMA) {
    super();
    this.interval = interval;
    this.avgGain = new SmoothingIndicator(interval);
    this.avgLoss = new SmoothingIndicator(interval);
    this.maxValue = 100;
    this.priceCount = 0;
    this.previousPrice = undefined;
    this.currentPrice = undefined;
  }

  update(price, replace = false) {
    // Only the latest two prices are needed, including repeated replacements.
    if (!replace || this.priceCount === 0) {
      this.previousPrice = this.currentPrice;
      if (this.priceCount < 2) this.priceCount++;
    }
    this.currentPrice = price;
    if (this.priceCount < 2) return;

    const previousPrice = this.previousPrice;
    if (price > previousPrice) {
      this.avgLoss.update(0, replace);
      this.avgGain.update(price - previousPrice, replace);
    } else {
      this.avgLoss.update(previousPrice - price, replace);
      this.avgGain.update(0, replace);
    }

    if (this.avgGain.isStable) {
      const avgLoss = this.avgLoss.getResult();
      if (avgLoss === 0) return this.setResult(100, replace);
      const relativeStrength = this.avgGain.getResult() / avgLoss;
      return this.setResult(this.maxValue - this.maxValue / (relativeStrength + 1), replace);
    }
  }
}
