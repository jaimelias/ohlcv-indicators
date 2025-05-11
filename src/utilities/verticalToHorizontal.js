export const verticalToHorizontal = (
  skipNull = false, 
  main
) => {

  const {precisionMultiplier, priceBased, precision, verticalOhlcv, invalidValueIndex, len, verticalOhlcvKeyNames} = main

  if (verticalOhlcvKeyNames.length === 0) return []
  
  const startIndex = skipNull && invalidValueIndex >= 0 ? invalidValueIndex + 1 : 0
  const diffLen = len - startIndex
  const result = new Array(diffLen)

  
  for (let i = startIndex; i < len; i++) {
    const row = {};
    for (let j = 0; j < verticalOhlcvKeyNames.length; j++) {
      const key = verticalOhlcvKeyNames[j]
      const value = verticalOhlcv[key][i]

      row[key] = (precision && priceBased.includes(key)) ? value / precisionMultiplier : value
      
    }

    result[i - startIndex] = row
  }
  
  return result
};
