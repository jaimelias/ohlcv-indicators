import { classifyNum } from "./numberUtilities.js";
import { selectDateFormatter } from "./dateUtilities.js";

const numberKeys = new Set(['open', 'high', 'low', 'close'])

export const buildArray = (arrayType, len, fallbackValue) => {
  const ctorMap = {
    Array:        Array,
    Float64Array: Float64Array,
    Float32Array: Float32Array,
    Int32Array:   Int32Array,
    Uint8Array:   Uint8Array,
    Int8Array:   Int8Array,
    Int16Array:   Int16Array,
  }

  const Ctor = ctorMap[arrayType]
  if (!Ctor || typeof Ctor.from !== 'function') {
    throw new Error(`Unsupported array type: ${arrayType}`)
  }
  // Arrays get nulls, typed-arrays get NaNs

  let fillValue

  if(typeof fallbackValue !== 'undefined')
  {
    fillValue = fallbackValue
  } else {
    fillValue = arrayType === 'Array' ? null : NaN
  }

  
  // Ctor.from({ length }, mapFn) works for Array *and* all TypedArrays
  return Ctor.from({ length: len }, () => fillValue)
}

export const assignTypes = main => {
  const {firstRow} = main
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
    else if(numberKeys.has(colName))
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


export const getArrayType = (key, arr) => {
  if (!arr || typeof arr !== 'object') {
    throw new TypeError(`Invalid array type: "${key}"`);
  }
  return arr.constructor.name;
}