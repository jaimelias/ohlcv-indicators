export const oneHotEncode = (idx, size) => {
    const vec = new Uint8Array(size)
    vec[idx] = 1
    return vec
}

export const normalizeMinMax = (value, min, max, [validMin, validMax]) => {
    const clamped = Math.min(Math.max(value, min), max)
    return ((clamped - min) / (max - min)) * (validMax - validMin) + validMin
}
  
export const normalizeZScore = (value, mean, std) => {
    return std === 0 ? 0 : (value - mean) / std
}

export const scaleByFeatureRange = (x, min, max) => {
  const center = (min + max) / 2
  const halfRange = (max - min) / 2
  const scaled = ((x - center) / halfRange) * 2

  return Math.max(-2, Math.min(2, scaled))
}