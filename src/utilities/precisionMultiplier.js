// ------------------------------
// calcPrecisionMultiplier (unchanged semantics)
// ------------------------------
export const calcPrecisionMultiplier = main => {
  const { precision, firstRow, initialPriceBased } = main;
  if (precision === false) return 1

  const multipliers = []

  const err = 'If "precision" is set to true all the "open", "high", "low" and "close" values must be numeric strings like "123.45" with no commas or currency symbols.'

  for (const [key, strNum] of Object.entries(firstRow)) {

    if(!initialPriceBased.has(key)) continue
    
    if (typeof strNum !== 'string' || !/^-?\d+(\.\d+)?$/.test(strNum)) {
      throw new Error(`${err} 
        Property "${key}" had the value "${strNum}" type ${typeof strNum}.`)
    }

    if (!new Set(['open', 'high', 'low', 'close']).has(key)) continue;

    const [, decimals = ''] = strNum.split('.')
    const decimalPrecision = Math.max(4, decimals.length)
    multipliers.push(Math.pow(10, decimalPrecision)) // returns Number
  }

  if (multipliers.length === 0) return 1
  return Math.max(...multipliers)
}

// ------------------------------
// Precise BigInt-based helpers (no `n` literals)
// ------------------------------
export const addPrecisionExact = (strNum, mul) => {
  if (typeof strNum !== 'string') throw new Error('addPrecisionExact expects a string when precision=true')

  const negative = strNum.charAt(0) === '-'
  const s = negative ? strNum.slice(1) : strNum
  const [intPart, decPart = ''] = s.split('.')

  // Compute decimals from mul (mul expected as 10^decimals)
  const mulStr = String(mul);
  const decimals = (mul === 1) ? 0 : (mulStr.length - 1)

  const decPadded = decPart.padEnd(decimals, '0').slice(0, decimals); // pad or trim
  const integerString = intPart + decPadded // e.g. "12" + "3400" => "123400"

  // Use BigInt constructor (no n-literals)
  let result = BigInt(integerString || '0'); // handle "0" or empty
  if (negative) result = -result
  return result
}

export const revertPrecisionExact = (num, mul) => {


  // Convert input to BigInt without using literal suffixes
  const big = (typeof num === 'bigint') ? num : BigInt(parseInt(num))
  const neg = big < BigInt(0)
  const abs = neg ? -big : big

  const mulBig = BigInt(mul);
  if (mulBig === BigInt(1)) {
    const s = abs.toString()
    return neg ? `-${s}` : s
  }

  const intPart = abs / mulBig
  const fracPart = abs % mulBig

  const decimals = String(mul).length - 1
  const fracStr = fracPart.toString().padStart(decimals, '0')

  // Remove trailing zeros in fractional part (optional)
  const trimmedFrac = fracStr.replace(/0+$/, '')
  const result = trimmedFrac.length === 0
    ? intPart.toString()
    : `${intPart.toString()}.${trimmedFrac}`

  return neg ? `-${result}` : result
}

// ------------------------------
// Convenience wrappers (Numbers) — may lose precision
// ------------------------------
export const addPrecisionAsNumber = (strNum, mul) => {

  const big = addPrecisionExact(strNum, mul)
  
  return Number(big)
}

export const revertPrecisionAsNumber = (num, mul) => {

  const asStr = revertPrecisionExact(num, mul)
  return Number(asStr)
}
