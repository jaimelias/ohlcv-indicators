export const oneHotEncode = (idx, size) => {
    const vec = new Uint8Array(size)
    vec[idx] = 1
    return vec
}