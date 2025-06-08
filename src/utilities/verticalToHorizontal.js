import { dateOutputFormaters } from "./dateUtilities.js" 

export const verticalToHorizontal = ({main, skipNull = false, startIndex = 0, dateFormat}) => {

  const {precisionMultiplier, precision, verticalOhlcv, invalidValueIndex, len, verticalOhlcvKeyNames, verticalOhlcvTempCols, notNumberKeys} = main

  if (verticalOhlcvKeyNames.length === 0) return []
  
  const skipNullIndex = skipNull && invalidValueIndex >= 0 ? invalidValueIndex + 1 : 0
  const maxStartIndex = Math.max(skipNullIndex, startIndex)
  const diffLen = len - maxStartIndex
  const result = Array.from({ length: diffLen }, () => ({}))

   for(const [key, arr] of Object.entries(verticalOhlcv)){
    if(verticalOhlcvTempCols.has(key)) continue
    const shouldApplyPrecision = precision && !notNumberKeys.has(key)

    for (let i = maxStartIndex; i < len; i++)
    {
      if(shouldApplyPrecision)
      {
        result[i - maxStartIndex][key] = arr[i] / precisionMultiplier 

      }
      else if(key === 'date')
      {
        result[i - maxStartIndex][key] = dateOutputFormaters[dateFormat](arr[i])
      } 
      else
      {
        result[i - maxStartIndex][key] = arr[i]
      }
    }
  }

  return result
}
