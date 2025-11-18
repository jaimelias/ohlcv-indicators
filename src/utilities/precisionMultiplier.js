
//calcPrecisionMultiplier is calculated once, using the open, high, low and close values of the first row
//the multiplier (min 10000) is store in constructor

export const calcPrecisionMultiplier = main => {
  const { precision, firstRow, initialPriceBased } = main
  if (precision === false) return 1

  let maxMultiplier = 1

  for (const [key, strNum] of Object.entries(firstRow)) {
    if (!initialPriceBased.has(key)) continue

    if (typeof strNum !== 'string' || !/^\d+(\.\d+)?$/.test(strNum))  {
      throw new Error(
        `If "precision" is set to true all the "open", "high", "low" and "close" values must be numeric strings like "123.45" with no commas or currency symbols. Property "${key}" had the value "${strNum}" type ${typeof strNum}.`
      )
    }

    const [integerStr, decimals = ''] = strNum.split('.')
    const integer = Number(integerStr)

    let decimalPrecision = 4

    // Treat any non-zero integer (positive or negative) as "normal"
    if (Math.abs(integer) === 0) {
      const decimalsLen = decimals.length
      const countDecimals = Math.max(4, decimalsLen)

      // index of first non-zero decimal digit, -1 if none
      const firstNonZeroIndex = decimals.search(/[1-9]/)

      if (firstNonZeroIndex === -1) {
        // 0, 0.0, 0.0000... -> nothing special to preserve
        decimalPrecision = countDecimals
      } else {
        // Give extra headroom after the first non-zero digit
        const extra = 5 // tweak as you like
        const needed = firstNonZeroIndex + 1 + extra
        decimalPrecision = Math.max(countDecimals, needed)
      }
    }

    // Optional: cap exponent to keep numbers sane
    const multiplier = 10 ** decimalPrecision

    if (multiplier > maxMultiplier) maxMultiplier = multiplier
  }

  return maxMultiplier
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