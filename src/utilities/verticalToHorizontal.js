import { dateOutputFormaters } from "./dateUtilities.js" 
import { outputNumberFormatter } from "./numberUtilities.js"

export const verticalToHorizontal = ({main, skipNull = false, startIndex = 0, dateFormat}) => {

  const {verticalOhlcv, invalidValueIndex, len, verticalOhlcvKeyNames, verticalOhlcvTempCols, priceBased, precision, precisionMultiplier} = main

  

  if (verticalOhlcvKeyNames.length === 0) return []
  
  const skipNullIndex = skipNull && invalidValueIndex >= 0 ? invalidValueIndex + 1 : 0
  const maxStartIndex = Math.max(skipNullIndex, startIndex)
  const diffLen = len - maxStartIndex
  const result = Array.from({ length: diffLen }, () => ({}))

  for(const [key, arr] of Object.entries(verticalOhlcv)){
    if(verticalOhlcvTempCols.has(key)) continue

    if(key === 'date')
    {
      const formatter = dateOutputFormaters[dateFormat]
      for (let i = maxStartIndex; i < len; i++)
      {
        result[i - maxStartIndex][key] = formatter(arr[i])
      }
    }
    else if(precision && priceBased.has(key))
    {
      const formatter = outputNumberFormatter.precisionNumberCleanString
      for (let i = maxStartIndex; i < len; i++)
      {
        const value = arr[i]
        result[i - maxStartIndex][key] = value == null || Number.isNaN(value)
          ? value
          : formatter(value, precisionMultiplier)
      }
    }
    else
    {
      for (let i = maxStartIndex; i < len; i++)
      {
        result[i - maxStartIndex][key] = arr[i]
      }
    }
  }

  return result
}
