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

export const computeFlatFeaturesLen = (featureCols, instances, type, verticalOhlcv, index) => {
  
  if (!instances.hasOwnProperty('crossPairs')) {

    throw new Error(`Property "instances.crossPairs" not found for ${type}`)

  }

  let flatFeaturesColLen = 0

  for (const key of featureCols) {

    if (key.startsWith('one_hot_')) {

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


export const getFeaturedKeys = ({trainingCols, findGroups, verticalOhlcv, scaledGroups, type}) => {

  const featureCols = [...trainingCols, ...(findGroupsFunc(findGroups, scaledGroups))]

    if (featureCols.length === 0) {
      throw new Error(`No "featureCols" available in "${type}"`)
    }

    // sanity‐check that all features exist
    for(const featureKey of featureCols)
    {
      if(!verticalOhlcv.hasOwnProperty(featureKey)) throw new Error(`Feature "${featureKey}" not found in verticalOhlcv for "${type}".`)
    }

    return featureCols
}

export const updateClassifierMetrics = ({metrics, trueLabel, predictedLabel}) => {

  metrics.total++

  const labelKey = `label_${predictedLabel.toString()}`

  if(!metrics.labels.hasOwnProperty(labelKey))
  {
    metrics.labels[labelKey] = 0
  }

  if(predictedLabel === trueLabel){
    metrics.correct++
    metrics.labels[labelKey]++
  }

  metrics.accuracy = metrics.correct / metrics.total
}