
//calcPrecisionMultiplier is calculated once, using the open, high, low and close values of the first row
//the multiplier (1000000000) is store in constructor
export const calcPrecisionMultiplier = main => {
  const { precision, firstRow, initialPriceBased, priceBased } = main;
  if (precision === false) return 1

  const multipliers = []

  const err = 'If "precision" is set to true all the "open", "high", "low" and "close" values must be numeric strings like "123.45" with no commas or currency symbols.'

  for (const [key, strNum] of Object.entries(firstRow)) {

    if(!initialPriceBased.has(key)) continue
    
    if (typeof strNum !== 'string' || !/^-?\d+(\.\d+)?$/.test(strNum)) {
      throw new Error(`${err} 
        Property "${key}" had the value "${strNum}" type ${typeof strNum}.`)
    }

    if (!priceBased.has(key)) continue

    const [integerStr, decimals = ''] = strNum.split('.')
    const integer = Number(integerStr)
    const decimalPrecision = integer > 0 ? 4 : Math.max(4, decimals.length)
    multipliers.push(Math.pow(10, decimalPrecision))
  }

  if (multipliers.length === 0) return 1

  const maxMultiplier = 10 ** 9 //1000000000

  return Math.min(maxMultiplier, Math.max(...multipliers))
}

//this function converts the strNum into a integer * multiplier
export const addPrecisionAsNumber = (strNum, multiplier) => {
  if (typeof strNum !== 'string') throw new Error('addPrecisionExact expects a string when precision=true')

  const negative = strNum.charAt(0) === '-'
  const s = negative ? strNum.slice(1) : strNum
  const [intPart, decPart = ''] = s.split('.')

  // Compute decimals from multiplier (multiplier expected as 10^decimals)
  const mulStr = String(multiplier);
  const decimals = (multiplier === 1) ? 0 : (mulStr.length - 1)

  const decPadded = decPart.padEnd(decimals, '0').slice(0, decimals); // pad or trim
  const integerString = intPart + decPadded // e.g. "12" + "3400" => "123400"

  let result = parseInt(integerString || '0', 10)

  if (negative) result = -result

  return result
}


//this function converts the outputs the number generated in addPrecisionAsNumber / multiplier
export const revertPrecisionAsNumber = (num, multiplier) => {
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    throw new Error('revertPrecisionAsNumber expects a finite number')
  }

  const negative = num < 0
  let abs = Math.abs(num)

  // Make sure we're working with an integer, mirroring addPrecisionAsNumber
  abs = Math.trunc(abs)

  const decimals = (multiplier === 1) ? 0 : (String(multiplier).length - 1)

  if (decimals === 0) {
    // No fractional part; just restore sign
    return negative ? -abs : abs
  }

  // Integer division and remainder
  const intPart = Math.trunc(abs / multiplier)
  const fracPart = abs % multiplier

  // Build fractional string with leading zeros, then trim trailing zeros
  let fracStr = String(fracPart).padStart(decimals, '0')
  fracStr = fracStr.replace(/0+$/, '')

  const resultStr = fracStr.length === 0
    ? String(intPart)
    : `${intPart}.${fracStr}`

  return Number(negative ? `-${resultStr}` : resultStr)
}