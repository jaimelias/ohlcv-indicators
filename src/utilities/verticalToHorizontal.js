export const verticalToHorizontal = (
  skipNull = false, 
  main,
  startIndex = 0
) => {

  const {precisionMultiplier, priceBased, precision, verticalOhlcv, invalidValueIndex, len, verticalOhlcvKeyNames} = main

  if (verticalOhlcvKeyNames.length === 0) return []
  
  const skipNullIndex = skipNull && invalidValueIndex >= 0 ? invalidValueIndex + 1 : 0
  const maxStartIndex = Math.max(skipNullIndex, startIndex)
  const diffLen = len - maxStartIndex
  const result = new Array(diffLen)

  for (let i = maxStartIndex; i < len; i++) {
    const row = {};
    for (let j = 0; j < verticalOhlcvKeyNames.length; j++) {
      const key = verticalOhlcvKeyNames[j]
      const value = verticalOhlcv[key][i]

      row[key] = (precision && priceBased.has(key)) ? value / precisionMultiplier : value
      
    }

    result[i - maxStartIndex] = row
  }
  
  return result
};
