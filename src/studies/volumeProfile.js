//volume profile can not be concatenated to the main class

export const VolumeProfile = (BigNumber, ohlcv, numBins = 10) => {

  const { open, high, low, close, volume } = ohlcv;

  // Determine the range of prices
  const lowPrice = BigNumber.min(...low);
  const highPrice = BigNumber.max(...high);
  const binSize = highPrice.minus(lowPrice).dividedBy(numBins);

  // Initialize bins
  const bins = Array.from({ length: numBins }, (_, i) => ({
    price: lowPrice.plus(binSize.multipliedBy(i)),
    upVolume: new BigNumber(0),
    downVolume: new BigNumber(0)
  }));

  // Precompute binSize inversely to use multiplication instead of division in the loop
  const inverseBinSize = new BigNumber(1).dividedBy(binSize);

  // Distribute volume into bins
  const numDataPoints = close.length;
  for (let i = 0; i < numDataPoints; i++) {
    const currentOpen = open[i];
    const currentHigh = high[i];
    const currentLow = low[i];
    const currentClose = close[i];
    const currentVolume = volume[i];

    const upVolume = currentClose.isGreaterThanOrEqualTo(currentOpen) ? currentVolume : new BigNumber(0);
    const downVolume = currentClose.isLessThan(currentOpen) ? currentVolume : new BigNumber(0);

    const lowIndex = currentLow.minus(lowPrice).multipliedBy(inverseBinSize).integerValue(BigNumber.ROUND_FLOOR).toNumber();
    const highIndex = currentHigh.minus(lowPrice).multipliedBy(inverseBinSize).integerValue(BigNumber.ROUND_CEIL).toNumber();

    for (let j = Math.max(lowIndex, 0); j < Math.min(highIndex, numBins); j++) {
      bins[j].upVolume = bins[j].upVolume.plus(upVolume);
      bins[j].downVolume = bins[j].downVolume.plus(downVolume);
    }
  }

  return bins

}