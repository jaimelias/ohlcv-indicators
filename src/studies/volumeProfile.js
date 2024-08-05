export const volumeProfile = (main, numBins, daysBack = 1, targetDateKey) => {

  let {ohlcv} = main

  const filteredOhlcv = filterLastDays(ohlcv, daysBack, targetDateKey)
  const vP = calculateBins(filteredOhlcv, numBins)
  const vp_high = vP.nodes.high.price
  const vp_low = vP.nodes.low.price

  return {
    volume_profile_high: [vp_high],
    volume_profile_low: [vp_low]
  }
}


export const calculateBins = (ohlcv, numBins = 5) => {
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

  const nodes = getPointsOfControl(bins);
  return { bins, nodes };
}

const getPointsOfControl = bins => {
  if (!bins || bins.length === 0) {
    throw new Error('Bins array is empty or not provided');
  }

  let high = bins[0];
  let low = bins[0];

  bins.forEach(bin => {
    if (bin.grossVolume > high.grossVolume) {
      high = bin;
    }

    if (bin.grossVolume < low.grossVolume) {
      low = bin;
    }
  });

  return {high, low}
}


const filterLastDays = (data, daysBack, targetDateKey) => {
  // Get the latest date and calculate the cutoff date
  const latestDate = new Date(data[targetDateKey][data[targetDateKey].length - 1]);
  const prevDays = new Date(latestDate);
  prevDays.setDate(prevDays.getDate() - daysBack);
  prevDays.setHours(0, 0, 0, 0);

  // Initialize result object
  const result = {
    open: [],
    high: [],
    low: [],
    close: [],
    volume: [],
    [targetDateKey]: [],
  };

  // Filter and transform data in a single pass
  for (let i = 0; i < data[targetDateKey].length; i++) {
    const currentDate = new Date(data[targetDateKey][i]);
    if (currentDate >= prevDays) {
      result.open.push(data.open[i]);
      result.high.push(data.high[i]);
      result.low.push(data.low[i]);
      result.close.push(data.close[i]);
      result.volume.push(data.volume[i]);
      result[targetDateKey].push(data[targetDateKey][i]);
    }
  }

  return result;
};
