import { buildArray, getArrayType } from "../utilities/assignTypes.js"

export const lag = (main, index, colKeys, lookback) => {

  
  
  const { verticalOhlcv, len } = main

  if(index === 0)
  {
    for (const colKey of colKeys) {
      if (!verticalOhlcv.hasOwnProperty(colKey)) {
          throw new Error(
          `Lag processing invoked by col "${colKey}" was not found in "verticalOhlcv".`
          )
      }

      for (let step = 1; step <= lookback; step++) {
          const key = `${colKey}_lag_${step}`
          const thisArrType = getArrayType(colKey, verticalOhlcv[colKey])

          verticalOhlcv[key] = buildArray(thisArrType, len)
      }   
    }
  }

  for (const colKey of colKeys) {
    const currentColumn = verticalOhlcv[colKey]

    // Populate the lagged values each tick:
    for (let step = 1; step <= lookback; step++) {
      const key = `${colKey}_lag_${step}`
      const laggedIndex = index - step
      const value =
        laggedIndex < 0 || currentColumn[laggedIndex] === undefined
          ? null
          : currentColumn[laggedIndex]

      main.pushToMain({ index, key, value })

    }
  }

  return true
}
