export const verticalToHorizontal = (
  skipNull = false, 
  main,
  startIndex = 0
) => {

  const {precisionMultiplier, priceBased, precision, verticalOhlcv, invalidValueIndex, len, verticalOhlcvKeyNames, verticalOhlcvTempCols} = main

  if (verticalOhlcvKeyNames.length === 0) return []
  
  const skipNullIndex = skipNull && invalidValueIndex >= 0 ? invalidValueIndex + 1 : 0
  const maxStartIndex = Math.max(skipNullIndex, startIndex)
  const diffLen = len - maxStartIndex
  const result = Array.from({ length: diffLen }, () => ({}))

   for(const [key, arr] of Object.entries(verticalOhlcv)){
    if(verticalOhlcvTempCols.has(key)) continue
    const shouldApplyPrecision = priceBased.has(key) && precision

    for (let i = maxStartIndex; i < len; i++)
    {
      result[i - maxStartIndex][key] = (shouldApplyPrecision)
        ? arr[i] / precisionMultiplier 
        : arr[i]
    }
  }

  return result
}
