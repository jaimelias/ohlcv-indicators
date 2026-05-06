export const isNumber = v => v != null && Number.isFinite(v)


export const mathLog = (a, b) => {


  const epsilon = 0.001
  
  // Add epsilon to avoid log(0)
  if (a === 0) a = epsilon
  if (b === 0) b = epsilon

  // Validate a and b have the same sign
  if (Math.sign(a) !== Math.sign(b)) {
    throw new Error(`[BUG] Params must have the same sign in mathLog a=${a} b=${b}.`)
  }

  // If both negative, flip signs — log requires positive values
  if (a < 0) { a = -a; b = -b }

  const log = Math.log(a / b)

  if (!isNumber(log)) throw new Error(`[BUG] Invalid params passed to mathLog a=${a} b=${b}.`)

  return log
}