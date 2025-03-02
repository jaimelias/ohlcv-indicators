
export const verticalToHorizontal = (obj, skipNull = false, precision, precisionMultiplier, priceBased) => {
    const keys = Object.keys(obj)
    if (keys.length === 0) return []
    
    const len = obj[keys[0]].length
    // If not skipping null values, preallocate the result array for maximum efficiency.
    const result = skipNull ? [] : new Array(len)
    
    for (let i = 0; i < len; i++) {
      let shouldSkip = false
      const row = {}
      
      for (let j = 0; j < keys.length; j++) {
        const key = keys[j]
        const value = obj[key][i]
        
        if (skipNull && (value === null || value === undefined)) {
          shouldSkip = true
          break;
        }

        row[key] = (precision && priceBased.includes(key)) ? value / precisionMultiplier : value
      }
      
      if (!shouldSkip) {
        // When skipping null rows, push valid rows dynamically.
        if (skipNull) {
          result.push(row)
        } else {
          result[i] = row
        }
      }
    }
    
    return result
  }