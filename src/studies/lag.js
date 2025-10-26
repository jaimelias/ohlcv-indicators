import { buildArray, getArrayType } from "../utilities/assignTypes.js"

export const lag = (main, index, colKeys, lookback) => {

  
  
  const { verticalOhlcv, len, priceBased } = main

  if(index === 0)
  {
    for (const targetKey of colKeys) {
      if (!verticalOhlcv.hasOwnProperty(targetKey)) {
        throw new Error(
        `Lag processing invoked by col "${targetKey}" was not found in "verticalOhlcv".`
        )
      }

      const addToPriceBased = priceBased.has(targetKey)

      for (let step = 1; step <= lookback; step++) {
        const key = `${targetKey}_lag_${step}`

        if(addToPriceBased) priceBased.add(key)

        const thisArrType = getArrayType(targetKey, verticalOhlcv[targetKey])

        verticalOhlcv[key] = buildArray(thisArrType, len)
      }   
    }
  }

  for (const targetKey of colKeys) {
    const currentColumn = verticalOhlcv[targetKey]

    // Populate the lagged values each tick:
    for (let step = 1; step <= lookback; step++) {
      const key = `${targetKey}_lag_${step}`
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
