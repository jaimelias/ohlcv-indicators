export const VolumeProfile = (BigNumber, ohlcv, numBins = 10) => {
  const { open, high, low, close, volume } = ohlcv;

  // Determine the range of prices
  const lowPrice = BigNumber.min(...low);
  const highPrice = BigNumber.max(...high);
  const binSize = highPrice.minus(lowPrice).dividedBy(numBins);
  const zero = BigNumber(0);

  // Initialize totals
  const totals = {
    upVolume: zero,
    downVolume: zero,
    grossVolume: zero,
  };

  // Initialize bins
  const bins = Array.from({ length: numBins }, (_, i) => ({
    price: lowPrice.plus(binSize.multipliedBy(i)),
    upVolume: zero,
    downVolume: zero,
    grossVolume: zero,
  }));

  // Precompute binSize inversely to use multiplication instead of division in the loop
  const inverseBinSize = BigNumber(1).dividedBy(binSize);

  // Distribute volume into bins
  for (let i = 0; i < close.length; i++) {
    const currentClose = close[i];
    const currentOpen = open[i];
    const currentHigh = high[i];
    const currentLow = low[i];
    const currentVolume = volume[i];

    const upVolume = currentClose.isGreaterThanOrEqualTo(currentOpen) ? currentVolume : zero;
    const downVolume = currentClose.isLessThan(currentOpen) ? currentVolume : zero;

    const lowIndex = Math.max(0, currentLow.minus(lowPrice).multipliedBy(inverseBinSize).integerValue(BigNumber.ROUND_FLOOR).toNumber());
    const highIndex = Math.min(numBins, currentHigh.minus(lowPrice).multipliedBy(inverseBinSize).integerValue(BigNumber.ROUND_CEIL).toNumber());

    for (let j = lowIndex; j < highIndex; j++) {
      bins[j].upVolume = bins[j].upVolume.plus(upVolume);
      bins[j].downVolume = bins[j].downVolume.plus(downVolume);
      bins[j].grossVolume = bins[j].grossVolume.plus(upVolume.plus(downVolume));
    }
  }

  // Sum totals outside the loop
  for (const { upVolume, downVolume, grossVolume } of bins) {
    totals.upVolume = totals.upVolume.plus(upVolume);
    totals.downVolume = totals.downVolume.plus(downVolume);
    totals.grossVolume = totals.grossVolume.plus(grossVolume);
    totals.netVolume = totals.upVolume.minus(totals.downVolume);
  }

  return bins;
};
