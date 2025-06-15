export const oneHotEncode = (idx, size) => {
    const vec = new Uint8Array(size)
    vec[idx] = 1
    return vec
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
            const {type, size} = group
            if(!scaledGroups.hasOwnProperty(`${type}_${size}`)) throw new Error(`Scaled group (${`${type}_${size}`}) not found for regressor.options.findGroups[${g}]: ${JSON.stringify(group)}`)
            output.push(...scaledGroups[`${type}_${size}`])
        }
    }

    return output
}

export const computeFlatFeaturesLen = (featureCols, instances, type) => {
  if (!instances.hasOwnProperty('crossPairs')) {
    throw new Error(`Property "instances.crossPairs" not found for ${type}`);
  }

  let flatFeaturesColLen = 0;

  for (const key of featureCols) {
    if (key.startsWith('one_hot_')) {
      const pairInfo = instances.crossPairs[key];
      if (!pairInfo) {
        throw new Error(
          `Property "instances.crossPairs['${key}']" not found for ${type}`
        );
      }

      const { oneHotCols, uniqueValues } = pairInfo;
      const size = uniqueValues && typeof uniqueValues.size === 'number'
        ? uniqueValues.size
        : 0;

      // Si oneHotCols es un número, lo usamos; si no, usamos uniqueValues.size.
      const colSize = typeof oneHotCols === 'number' ? oneHotCols : size;
      flatFeaturesColLen += colSize;
    } else {
      flatFeaturesColLen += 1;
    }
  }

  return flatFeaturesColLen;
}