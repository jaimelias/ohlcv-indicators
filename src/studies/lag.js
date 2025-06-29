import { buildArray } from "../utilities/assignTypes.js"

export const lag = (main, index, colKeys, lookback) => {

  
  
  const { verticalOhlcv, len, arrayTypes } = main

  if(index === 0)
  {
    for (const colKey of colKeys) {
      if (!arrayTypes.hasOwnProperty(colKey)) {
          throw new Error(
          `Lag processing invoked by "${colKey}" expected arrayTypes to have a "${colKey}" property, but it wasn’t found.`
          )
      }

      for (let step = 1; step <= lookback; step++) {
          const key = `${colKey}_lag_${step}`
          verticalOhlcv[key] = buildArray(arrayTypes[colKey], len)
          arrayTypes[key] = arrayTypes[colKey]
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
