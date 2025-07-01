export const oneHotEncode = (idx, size) => {
    const vec = new Uint8Array(size)
    vec[idx] = 1
    return vec
}

export const logMlTraining = ({featureCols, flatFeaturesColLen, type, trainingSize}) => {

    const oneHotTxt = (featureCols.length !== flatFeaturesColLen) ? ' (including flat one-hot encoded array values) ' : ''
    console.log(`---\nInitialized "${type}" with ${flatFeaturesColLen} features ${oneHotTxt} and ${trainingSize} rows: \n${JSON.stringify(featureCols)}\n\n`)
}

export const normalizeMinMax = (value, min, max, [validMin, validMax]) => {
    const clamped = Math.min(Math.max(value, min), max)
    return ((clamped - min) / (max - min)) * (validMax - validMin) + validMin
}
  
export const normalizeZScore = (value, mean, std) => {
    return std === 0 ? 0 : (value - mean) / std
}

export const findGroupsFunc = (findGroups, scaledGroups) => {

    const output = []

    if(findGroups.length > 0)
    {
        for(let g = 0; g < findGroups.length; g++)
        {
            const group = findGroups[g]
            const {type, size = null, groupName = null} = group

            let groupKey = (size !== null) ? `${type}_${size}` : `${type}_${groupName}`

            if(!scaledGroups.hasOwnProperty(groupKey)) throw new Error(`Scaled group (${groupKey}) not found for regressor.options.findGroups[${g}]: ${JSON.stringify(group)}`)
            output.push(...scaledGroups[groupKey])
        }
    }

    return output
}

export const computeFlatFeaturesLen = (featureCols, verticalOhlcv, index) => {
  
  let flatFeaturesColLen = 0

  for (const key of featureCols) {

    if(!verticalOhlcv.hasOwnProperty(key)) throw new Error(`Property "${key}" not found in "verticalOhlcv".`)

    const val = verticalOhlcv[key][index]

    if(typeof val === 'undefined' || val === null || Number.isNaN(val)) throw new Error(`Invalid value of property "${key}".`)

    if (key.startsWith('one_hot_') || key.startsWith('pca_')) {

      const colSize = verticalOhlcv[key][index].length

      flatFeaturesColLen += colSize

    } else {

      flatFeaturesColLen += 1

    }
  }

  return flatFeaturesColLen
}


export const countUniqueLabels = Y => {
  // If Y[0] isn't an array, treat Y as a single-column 2D array
  const data = Array.isArray(Y[0]) ? Y : Y.map(v => [v]);

  // Number of columns in our (possibly wrapped) data
  const nCols = data[0].length;

  // Sum up the unique values in each column
  const totalLabels = Array.from({ length: nCols }).reduce((sum, _, col) => {
    const uniques = new Set(data.map(row => row[col]));
    return sum + uniques.size;
  }, 0);

  // Return count + 1 (same as before)
  return totalLabels + 1;
}


export const getFeaturedKeys = ({trainingCols, findGroups, verticalOhlcv, scaledGroups}) => {

  const featureCols = [...trainingCols, ...(findGroupsFunc(findGroups, scaledGroups))]


  if (featureCols.length === 0) {
    return []
  }

  let keyNotFound = false

  // sanity‐check that all features exist
  for(let x = 0; x < featureCols.length; x++)
  {
    const featureKey = featureCols[x]

    if(!verticalOhlcv.hasOwnProperty(featureKey)) {
      keyNotFound = true
      break
    }
  }
  
  if(keyNotFound) return []

  return featureCols
}

export const updateClassifierMetrics = ({ metrics, trueLabel, predictedLabel }) => {
  // Increment overall counters
  metrics.total = (metrics.total || 0) + 1
  metrics.correct = (metrics.correct || 0)

  // Initialize per‐label stats container if needed
  metrics.labels = metrics.labels || {}

  const labelKey = predictedLabel.toString()
  // Ensure we have a slot for this label
  if (!metrics.labels[labelKey]) {
    metrics.labels[labelKey] = { total: 0, correct: 0, accuracy: 0 }
  }

  // Update this label’s total predictions
  metrics.labels[labelKey].total++

  // If correct, bump both overall and per-label correct counters
  if (predictedLabel === trueLabel) {
    metrics.correct++
    metrics.labels[labelKey].correct++
  }

  // Recompute overall accuracy
  metrics.accuracy = metrics.correct / metrics.total

  // Recompute accuracy for each label
  for (const key in metrics.labels) {
    const stats = metrics.labels[key]
    stats.accuracy = stats.correct / stats.total
  }
}
