/**
 * Builds a flattened lookback feature vector or returns null if any value is non‐finite.
 *
 * @param {string[]} featureCols                – list of feature column keys
 * @param {Object}   instances                  – your instances object (with crossPairs)
 * @param {number}   flatFeaturesColLen         – total number of flattened feature slots
 * @param {string}   type                       – a string used only for error reporting
 * @param {number}   index                      – current time index
 * @param {number}   lookbackAbs                – number of lags to include
 * @param {Object}   verticalOhlcv              – an object mapping each key to its time series array
 * @returns {number[]\|null}                    – the feature vector or null if exiting early
 */
export const buildTrainX = ({
  featureCols,
  flatFeaturesColLen,
  type,
  index,
  lookbackAbs,
  main
}) => {

  const {verticalOhlcv} = main

  let shouldExit = false

  // --- BUILD A FLATTENED LIST OF “COLUMN SLOTS” ---
  const slots = [];
  for (const key of featureCols) {
    if (key.startsWith('one_hot_') || key.startsWith('pca_')) {

      const colSize = verticalOhlcv[key][index].length

      for (let bit = 0; bit < colSize; bit++) {
        slots.push({ key, bit });
      }
    } else {
      slots.push({ key });
    }
  }

  if (slots.length !== flatFeaturesColLen) {
    throw new Error(
      `slots (${slots.length}) ≠ flatFeaturesColLen (${flatFeaturesColLen}) in ${type} index ${index}`
    );
  }

  // --- ALLOCATE AND FILL trainX ---
  const trainX = new Array(flatFeaturesColLen * lookbackAbs).fill(NaN);

  for (let lag = 0; lag < lookbackAbs; lag++) {
    const tIdx = index - lag;

    for (let s = 0; s < slots.length; s++) {
      const { key, bit } = slots[s];
      const cell = verticalOhlcv[key][tIdx];
      const value = (bit != null) ? cell[bit] : cell;

      if (!Number.isFinite(value)) {
        shouldExit = true;
        break;
      }
      trainX[lag * flatFeaturesColLen + s] = value;
    }

    if (shouldExit) break;
  }

  if (shouldExit) {
    return null;
  }

  return trainX;
};
