export const isNumber = v => v != null && Number.isFinite(v)

export const mathLog = (a, b) => {

  const log = Math.log(a / b)

  //checks if NaN, Infinity
  if(!isNumber(log)) throw new Error(`[BUG] Invalid params passed to mathLog a=${a} b=${b}.`)

  return log
}