import { addPrecisionAsNumber, revertPrecisionAsNumber } from "./precisionMultiplier.js";

export const inputNumberFormatter = {
  number: n => n,
  numberCleanString: n => Number(n),
  precisionNumberCleanString: (strNum, multiplier) => addPrecisionAsNumber(strNum, multiplier)
}

export const outputNumberFormatter = {
  number: n => n,
  numberCleanString: n => n,
  precisionNumberCleanString: (strNum, multiplier) => revertPrecisionAsNumber(strNum, multiplier)
}

export const classifyNum = (num, throwError = false, precision = false) => {

  const cleanRe = /^-?\d+(\.\d+)?$/;
  const isNumber = typeof num === 'number' && !Number.isNaN(num)
  const isString = typeof num === 'string'
  const isCleanString = isString && cleanRe.test(num)

  if(precision === true) {
    if(isCleanString) return 'precisionNumberCleanString'

    if(throwError) throw new Error('Invalid number forma')
    return typeof num
  }
  else {
    if(isNumber) return 'number'
    else if(isCleanString) return 'numberCleanString'
  }

  if(throwError) throw new TypeError('Invalid input: expected a number or numeric string')
  return typeof num
}