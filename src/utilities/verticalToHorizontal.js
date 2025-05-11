export const verticalToHorizontal = (
  obj, 
  skipNull = false, 
  precision, 
  precisionMultiplier, 
  priceBased, 
  invalidValueIndex = 0
) => {
  const keys = Object.keys(obj);
  if (keys.length === 0) return [];
  
  const startIndex = skipNull && invalidValueIndex >= 0 ? invalidValueIndex + 1 : 0
  const endIndex = obj[keys[0]].length
  const len = endIndex - startIndex
  const result = new Array(len)

  
  for (let i = startIndex; i < endIndex; i++) {
    const row = {};
    for (let j = 0; j < keys.length; j++) {
      const key = keys[j]
      const value = obj[key][i]

      row[key] = (precision && priceBased.includes(key)) ? value / precisionMultiplier : value
      
    }

    result[i - startIndex] = row
  }
  
  return result
};
