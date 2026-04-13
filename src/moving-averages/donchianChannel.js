export const donchianChannels = (main, index, size, offset, options) => {
  const { verticalOhlcv, instances, len, inputParams, priceBased, useFullNames } = main
  const { lag: outputLag = 0 } = options
  const indicatorKey = `${size}_${offset}`

  // ---- INIT (only at first bar) ----
  if (index === 0) {
    const numberOfIndicators = inputParams.filter(o => o.key === 'donchianChannels').length
    const useIndexedKeys = numberOfIndicators > 1 || useFullNames

    const getKey = name =>
      useIndexedKeys
        ? `donchian_channel_${name}_${indicatorKey}`
        : `donchian_channel_${name}`

    const keys = ['upper', 'basis', 'lower'].map(getKey)

    for (const k of keys) {
      priceBased.add(k)
    }

    if (!instances.donchian_channel) {
      instances.donchian_channel = { numberOfIndicators, settings: {} }
    }

    instances.donchian_channel.numberOfIndicators = numberOfIndicators
    instances.donchian_channel.settings[indicatorKey] = { maxDeque: [], minDeque: [] }

    Object.assign(
      verticalOhlcv,
      Object.fromEntries(keys.map(k => [k, new Float64Array(len).fill(NaN)]))
    )

    if (outputLag > 0) {
      main.lag(keys, outputLag)
    }
  }

  // ---- PER-BAR COMPUTATION ----
  const { numberOfIndicators, settings } = instances.donchian_channel
  const useIndexedKeys = numberOfIndicators > 1 || useFullNames

  const getKey = name =>
    useIndexedKeys
      ? `donchian_channel_${name}_${indicatorKey}`
      : `donchian_channel_${name}`

  const { maxDeque, minDeque } = settings[indicatorKey]
  const current = index - offset
  const start = current - size + 1

  const outKeys = ['upper', 'basis', 'lower'].map(getKey)

  if (start < 0 || current + 1 > len) {
    outKeys.forEach(key =>
      main.pushToMain({ index, key, value: NaN })
    )
    return true
  }

  const { high: highs, low: lows } = verticalOhlcv

  const update = (dq, arr, cmp) => {
    while (dq.length && dq[0] < start) dq.shift()
    while (dq.length && cmp(arr[dq.at(-1)], arr[current])) dq.pop()
    dq.push(current)
  }

  update(maxDeque, highs, (a, b) => a <= b)
  update(minDeque, lows, (a, b) => a >= b)

  const hasBounds = maxDeque.length && minDeque.length
  const upper = hasBounds ? highs[maxDeque[0]] : NaN
  const lower = hasBounds ? lows[minDeque[0]] : NaN
  const basis = hasBounds ? (upper + lower) / 2 : NaN

  main.pushToMain({ index, key: getKey('upper'), value: upper })
  main.pushToMain({ index, key: getKey('basis'), value: basis })
  main.pushToMain({ index, key: getKey('lower'), value: lower })

  return true
}