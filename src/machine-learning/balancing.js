export const countUniqueLabels = Y => {
  // 1. Guard against empty or non-array input
  if (!Array.isArray(Y) || Y.length === 0) {
    return 1
  }

  // 2. Detect if Y is 2D or 1D
  const is2D = Array.isArray(Y[0])
  const nCols = is2D ? Y[0].length : 1

  let total = 0

  // 3. For each column, collect uniques in a single pass
  for (let col = 0; col < nCols; col++) {
    const seen = new Set()
    for (let row = 0; row < Y.length; row++) {
      // pick the cell: Y[row][col] if 2D, or Y[row] if 1D
      const cell = is2D ? Y[row][col] : Y[row]
      seen.add(cell)
    }
    total += seen.size
  }

  // 4. Return “sum of uniques per column”
  return total
}

// X and Y can have multivariable or univariable rows
export const oversampleXY = (X, Y) => {
  if (!Array.isArray(X) || !Array.isArray(Y)) {
    throw new TypeError('Both X and Y must be arrays');
  }
  if (X.length !== Y.length) {
    throw new Error('X and Y must have the same length');
  }
  if (Y.length === 0) {
    return { X: [], Y: [] };
  }

  // 2) Group X-values by label using a Map
  const groups = Y.reduce((map, label, i) => {
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(X[i]);
    return map;
  }, new Map());

  // 3) Find the largest group size
  let maxSize = 0;
  for (const arr of groups.values()) {
    if (arr.length > maxSize) maxSize = arr.length;
  }

  // 4) Build the oversampled arrays
  const outX = [];
  const outY = [];
  for (const [label, xArr] of groups.entries()) {
    const sz = xArr.length;
    for (let i = 0; i < maxSize; i++) {
      outX.push(xArr[i % sz]);
      outY.push(label);
    }
  }

  return { X: outX, Y: outY };
};
