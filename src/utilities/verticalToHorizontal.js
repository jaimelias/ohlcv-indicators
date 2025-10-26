import { dateOutputFormaters } from "./dateUtilities.js" 
import { outputNumberFormatter } from "./numberUtilities.js"

export const verticalToHorizontal = ({main, skipNull = false, startIndex = 0, dateFormat}) => {

  const {verticalOhlcv, invalidValueIndex, len, verticalOhlcvKeyNames, verticalOhlcvTempCols, priceBased, precision, precisionMultiplier} = main

  if (verticalOhlcvKeyNames.length === 0) return []
  
  const skipNullIndex = skipNull && invalidValueIndex >= 0 ? invalidValueIndex + 1 : 0
  const maxStartIndex = Math.max(skipNullIndex, startIndex)
  const diffLen = len - maxStartIndex
  const result = Array.from({ length: diffLen }, () => ({}))
  const formatter = {}
  
  for(const key of verticalOhlcvKeyNames) {
      if(precision && priceBased.has(key)) {
          formatter[key] = (num, mul) => outputNumberFormatter.precisionNumberCleanString(num, mul)
      }
      else {
          formatter[key] = v => v
      }
  }

   for(const [key, arr] of Object.entries(verticalOhlcv)){
    if(verticalOhlcvTempCols.has(key)) continue

    for (let i = maxStartIndex; i < len; i++)
    {
      if(key === 'date')
      {
        result[i - maxStartIndex][key] = dateOutputFormaters[dateFormat](arr[i])
      } 
      else
      {
        result[i - maxStartIndex][key] = formatter[key](arr[i], precisionMultiplier)
      }
    }
  }

  return result
}
