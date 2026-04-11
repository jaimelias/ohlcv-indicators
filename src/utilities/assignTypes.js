import { classifyNum } from "./numberUtilities.js";
import { selectDateFormatter } from "./dateUtilities.js";

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
  const {firstRow, precision, initialPriceBased} = main
  const inputTypes  = {}
  const arrayTypes  = {}

  const priceBasedInputTypes = new Map() // colName -> inputType

  for (const [colName, cellValue] of Object.entries(firstRow)) {

    if (colName === 'date') {
      inputTypes[colName] = selectDateFormatter(cellValue, true)
      arrayTypes[colName] = 'Array'
    }
    else if (colName === 'volume') {
      inputTypes[colName] = classifyNum(cellValue, true)
      arrayTypes[colName] = 'Int32Array'
    }
    else if (initialPriceBased.has(colName)) {
      inputTypes[colName] = classifyNum(cellValue, true, precision)
      arrayTypes[colName] = 'Float64Array'

      priceBasedInputTypes.set(colName, inputTypes[colName])
    }
    else {
      const thisType = classifyNum(cellValue, false, precision)
      inputTypes[colName] = thisType
      arrayTypes[colName] = (thisType === 'number') ? 'Float64Array' : 'Array'
    }
  }

  const uniqueInputTypes = new Set(priceBasedInputTypes.values())
  if (uniqueInputTypes.size > 1) {
    const details = [...priceBasedInputTypes.entries()]
      .map(([col, type]) => `${col}: "${type}"`)
      .join(', ')
    throw new Error(
      `Inconsistent types among price-based columns — ${details}. ` +
      `All initialPriceBased columns must share the same numeric type.`
    )
  }

  if(arrayTypes.hasOwnProperty('open') && arrayTypes.hasOwnProperty('close')){
    arrayTypes.mid_price = arrayTypes.open
    inputTypes.mid_price =  inputTypes.open
  }

  return { inputTypes, arrayTypes }
}

export const getArrayType = (key, arr) => {
  if (!arr || typeof arr !== 'object') {
    throw new TypeError(`Invalid array type: "${key}"`);
  }
  return arr.constructor.name;
}