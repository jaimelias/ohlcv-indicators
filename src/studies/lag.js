import { initializeColumns } from "../core-functions/initializeColumns.js"

export const lag = (main, index, colKeys, lookback) => {

  
  
  const { verticalOhlcv, priceBased } = main

  if(index === 0)
  {
    for (const targetKey of colKeys) {
      if (!verticalOhlcv.hasOwnProperty(targetKey)) {
        throw new Error(
        `Lag processing invoked by col "${targetKey}" was not found in "verticalOhlcv".`
        )
      }

      const addToPriceBased = priceBased.has(targetKey)
      const type = Array.isArray(verticalOhlcv[targetKey]) ? 'Array' : 'Float64Array'
      const columns = []

      for (let step = 1; step <= lookback; step++) {
        const key = `${targetKey}_lag_${step}`

        columns.push({ key, type, priceBased: addToPriceBased, includeInLag: false })
      }   

      initializeColumns(main, columns)
    }
  }

  for (const targetKey of colKeys) {
    const currentColumn = verticalOhlcv[targetKey]
    const missingValue = Array.isArray(currentColumn) ? null : NaN

    // Populate the lagged values each tick:
    for (let step = 1; step <= lookback; step++) {
      const key = `${targetKey}_lag_${step}`
      const laggedIndex = index - step
      const value =
        laggedIndex < 0 || currentColumn[laggedIndex] == null
          ? missingValue
          : currentColumn[laggedIndex]

      main.pushToMain({ index, key, value })

    }
  }

}
