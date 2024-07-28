export const VolumeProfile = (ohlcv, numBins = 10) => {
  const { open, high, low, close, volume } = ohlcv;

  // Determine the range of prices
  const lowPrice = Math.min(...low);
  const highPrice = Math.max(...high);
  const binSize = (highPrice - lowPrice) / numBins;
  const zero = 0;

  // Initialize totals
  const totals = {
    upVolume: zero,
    downVolume: zero,
    grossVolume: zero,
  };

  // Initialize bins
  const bins = Array.from({ length: numBins }, (_, i) => ({
    price: lowPrice + binSize * i,
    upVolume: zero,
    downVolume: zero,
    grossVolume: zero,
  }));

  // Precompute binSize inversely to use multiplication instead of division in the loop
  const inverseBinSize = 1 / binSize;

  // Distribute volume into bins
  for (let i = 0; i < close.length; i++) {
    const currentClose = close[i];
    const currentOpen = open[i];
    const currentHigh = high[i];
    const currentLow = low[i];
    const currentVolume = volume[i];

    const upVolume = currentClose >= currentOpen ? currentVolume : zero;
    const downVolume = currentClose < currentOpen ? currentVolume : zero;

    const lowIndex = Math.max(0, Math.floor((currentLow - lowPrice) * inverseBinSize));
    const highIndex = Math.min(numBins, Math.ceil((currentHigh - lowPrice) * inverseBinSize));

    for (let j = lowIndex; j < highIndex; j++) {
      bins[j].upVolume += upVolume;
      bins[j].downVolume += downVolume;
      bins[j].grossVolume += (upVolume + downVolume);
    }
  }

  // Sum totals outside the loop
  for (const { upVolume, downVolume, grossVolume } of bins) {
    totals.upVolume += upVolume;
    totals.downVolume += downVolume;
    totals.grossVolume += grossVolume;
  }

  const nodes = findVolumeNodes(bins);
  return { bins, nodes };
}

const findVolumeNodes = bins => {
  if (!bins || bins.length === 0) {
    throw new Error('Bins array is empty or not provided');
  }

  let highestVolumeNode = bins[0];
  let lowestVolumeNode = bins[0];

  bins.forEach(bin => {
    if (bin.grossVolume > highestVolumeNode.grossVolume) {
      highestVolumeNode = bin;
    }

    if (bin.grossVolume < lowestVolumeNode.grossVolume) {
      lowestVolumeNode = bin;
    }
  });

  return {
    highestVolumeNode,
    lowestVolumeNode
  };
}
