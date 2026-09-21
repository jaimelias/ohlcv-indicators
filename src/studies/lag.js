import { initializeColumns } from "../core-functions/initializeColumns.js"

const lagColumnsKey = Symbol('lagColumns')

export const lag = (main, index, colKeys, lookback) => {

  const { verticalOhlcv, priceBased, instances } = main

  if(index === 0)
  {
    const lagColumns = new Map()

    for (const targetKey of colKeys) {
      if (!verticalOhlcv.hasOwnProperty(targetKey)) {
        throw new Error(
        `Lag processing invoked by col "${targetKey}" was not found in "verticalOhlcv".`
        )
      }

      const addToPriceBased = priceBased.has(targetKey)
      const type = Array.isArray(verticalOhlcv[targetKey]) ? 'Array' : 'Float64Array'
      const columns = []
      const keyNames = []

      for (let step = 1; step <= lookback; step++) {
        const key = `${targetKey}_lag_${step}`

        columns.push({ key, type, priceBased: addToPriceBased, includeInLag: false })
        keyNames.push(key)
      }   

      initializeColumns(main, columns)
      lagColumns.set(targetKey, keyNames)
    }

    // colKeys belongs to the runtime queue; keep cached names out of exported params.
    if (!instances[lagColumnsKey]) instances[lagColumnsKey] = new WeakMap()
    instances[lagColumnsKey].set(colKeys, lagColumns)
  }

  const lagColumns = instances[lagColumnsKey]?.get(colKeys)

  for (const targetKey of colKeys) {
    const keyNames = lagColumns?.get(targetKey)
    const currentColumn = verticalOhlcv[targetKey]
    const missingValue = Array.isArray(currentColumn) ? null : NaN

    // Populate the lagged values each tick:
    for (let step = 1; step <= lookback; step++) {
      // Runtime callbacks may change the target list or lookback after initialization.
      const key = keyNames?.[step - 1] ?? `${targetKey}_lag_${step}`
      const laggedIndex = index - step
      const value =
        laggedIndex < 0 || currentColumn[laggedIndex] == null
          ? missingValue
          : currentColumn[laggedIndex]

      main.pushToMain({ index, key, value })

    }
  }

}
