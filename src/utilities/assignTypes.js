import { classifyNum } from "./numberUtilities.js";
import { selectDateFormatter } from "./dateUtilities.js";

const numberKeys = new Set(['open', 'high', 'low', 'close'])

export const buildArray = (arrayType, len) => {
  const ctorMap = {
    Array:        Array,
    Float64Array: Float64Array,
    Int32Array:   Int32Array,
    Uint8Array:   Uint8Array,
    Int16Array:   Int16Array,
  }

  const Ctor = ctorMap[arrayType];
  if (!Ctor || typeof Ctor.from !== 'function') {
    throw new Error(`Unsupported array type: ${arrayType}`);
  }
  // Arrays get nulls, typed-arrays get NaNs
  const fillValue = arrayType === 'Array' ? null : NaN;
  // Ctor.from({ length }, mapFn) works for Array *and* all TypedArrays
  return Ctor.from({ length: len }, () => fillValue);
}

export const assignTypes = main => {
  const {firstRow, notNumberKeys} = main
  const inputTypes  = {}
  const arrayTypes  = {}

  for (const [colName, cellValue] of Object.entries(firstRow)) {

    if (colName === 'date') {
      inputTypes[colName] = selectDateFormatter(cellValue, true)
      arrayTypes[colName] = 'Array'
      notNumberKeys.add(colName)
    }
    else if(colName === 'volume')
    {
      inputTypes[colName] = classifyNum(cellValue, true)
      arrayTypes[colName] = 'Int32Array'
      notNumberKeys.add(colName)
    }
    else if(numberKeys.has(colName))
    {
      inputTypes[colName] = classifyNum(cellValue, true)
      arrayTypes[colName] = 'Float64Array'
    } else {
      const thisType = classifyNum(cellValue, false)
      inputTypes[colName] = thisType
      arrayTypes[colName] = (thisType === 'number') ? 'Float64Array' : 'Array'

      if(!thisType.startsWith('number'))
      {
        notNumberKeys.add(colName)
      }

    }
  }

  return { inputTypes, arrayTypes }
}
