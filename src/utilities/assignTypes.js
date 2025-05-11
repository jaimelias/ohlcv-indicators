import { classifyNum } from "./numberUtilities.js";
import { selectDateFormatter } from "./dateUtilities.js";

const numberKeys = ['open', 'high', 'low', 'close']

export const buildArray = (arrayType, len) => {
  if(arrayType === 'Array') return new Array(len).fill(null)
  if(arrayType === 'Float64Array') return new Float64Array(len).fill(NaN)
  if(arrayType === 'Int32Array') return new Int32Array(len).fill(NaN)
}

export const assignTypes = firstRow => {
  const inputTypes  = {}
  const arrayTypes  = {}

  for (const [colName, cellValue] of Object.entries(firstRow)) {

    if (colName === 'date') {
      inputTypes[colName] = selectDateFormatter(cellValue, true)
      arrayTypes[colName] = 'Array'
    }
    else if(colName === 'volume')
    {
      inputTypes[colName] = classifyNum(cellValue, true)
      arrayTypes[colName] = 'Int32Array'
    }
    else if(numberKeys.includes(colName))
    {
      inputTypes[colName] = classifyNum(cellValue, true)
      arrayTypes[colName] = 'Float64Array'
    } else {
      const thisType = classifyNum(cellValue, false)
      inputTypes[colName] = thisType
      arrayTypes[colName] = (thisType === 'number') ? 'Float64Array' : 'Array'
    }
  }

  return { inputTypes, arrayTypes }
}
