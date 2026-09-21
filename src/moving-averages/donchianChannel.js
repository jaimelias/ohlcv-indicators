import { validateInputValues } from '../utilities/validators.js'
import { initializeColumns } from '../core-functions/initializeColumns.js'

export const donchianChannels = (main, index, size, offset, options) => {
  const { verticalOhlcv, instances, len, inputParams, useFullNames } = main
  const { lag: outputLag = 0 } = options
  const indicatorKey = `${size}_${offset}`

  // ---- INIT (only at first bar) ----
  if (index === 0) {
    validateInputValues({ high: true, low: true }, verticalOhlcv, index, 'donchianChannels')

    const numberOfIndicators = inputParams.filter(o => o.key === 'donchianChannels').length
    const useIndexedKeys = numberOfIndicators > 1 || useFullNames

    const getKey = name =>
      useIndexedKeys
        ? `donchian_channel_${name}_${indicatorKey}`
        : `donchian_channel_${name}`

    const keys = ['upper', 'basis', 'lower'].map(getKey)

    if (!instances.donchian_channel) {
      instances.donchian_channel = { numberOfIndicators, settings: {} }
    }

    instances.donchian_channel.numberOfIndicators = numberOfIndicators
    instances.donchian_channel.settings[indicatorKey] = {
      maxDeque: { indices: [], head: 0, length: 0 },
      minDeque: { indices: [], head: 0, length: 0 }
    }

    initializeColumns(main, keys.map(key => ({ key, priceBased: true })), { lag: outputLag })
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

  // No source candle is available yet.
  if (current < 0 || current >= len) return

  const { high: highs, low: lows } = verticalOhlcv

  const update = (dq, arr, cmp) => {
    const { indices } = dq
    while (dq.length && indices[dq.head] < start) {
      dq.head = (dq.head + 1) % size
      dq.length--
    }
    while (dq.length && cmp(arr[indices[(dq.head + dq.length - 1) % size]], arr[current])) {
      dq.length--
    }
    // Reuse at most size slots instead of moving entries or growing with the input.
    indices[(dq.head + dq.length) % size] = current
    dq.length++
  }

  update(maxDeque, highs, (a, b) => a <= b)
  update(minDeque, lows, (a, b) => a >= b)

  // Collect warm-up candles, but leave outputs as NaN until the window is complete.
  if (start < 0) return

  const hasBounds = maxDeque.length && minDeque.length
  const upper = hasBounds ? highs[maxDeque.indices[maxDeque.head]] : NaN
  const lower = hasBounds ? lows[minDeque.indices[minDeque.head]] : NaN
  const basis = hasBounds ? (upper + lower) / 2 : NaN

  main.pushToMain({ index, key: getKey('upper'), value: upper })
  main.pushToMain({ index, key: getKey('basis'), value: basis })
  main.pushToMain({ index, key: getKey('lower'), value: lower })

}
