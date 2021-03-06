import paethPredictor from "./paeth-predictor.ts";

function filterNone(
  pxData,
  pxPos: number,
  byteWidth: number,
  rawData,
  rawPos: number,
) {
  for (let x = 0; x < byteWidth; x++) {
    rawData[rawPos + x] = pxData[pxPos + x];
  }
}

function filterSumNone(pxData, pxPos: number, byteWidth: number) {
  let sum = 0;
  const length = pxPos + byteWidth;

  for (let i = pxPos; i < length; i++) {
    sum += Math.abs(pxData[i]);
  }
  return sum;
}

function filterSub(
  pxData,
  pxPos: number,
  byteWidth: number,
  rawData,
  rawPos: number,
  bpp: number,
) {
  for (let x = 0; x < byteWidth; x++) {
    const left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    const val = pxData[pxPos + x] - left;

    rawData[rawPos + x] = val;
  }
}

function filterSumSub(pxData, pxPos: number, byteWidth: number, bpp: number) {
  let sum = 0;
  for (let x = 0; x < byteWidth; x++) {
    const left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    const val = pxData[pxPos + x] - left;

    sum += Math.abs(val);
  }

  return sum;
}

function filterUp(
  pxData,
  pxPos: number,
  byteWidth: number,
  rawData,
  rawPos: number,
) {
  for (let x = 0; x < byteWidth; x++) {
    const up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
    const val = pxData[pxPos + x] - up;

    rawData[rawPos + x] = val;
  }
}

function filterSumUp(pxData, pxPos: number, byteWidth: number) {
  let sum = 0;
  const length = pxPos + byteWidth;
  for (let x = pxPos; x < length; x++) {
    const up = pxPos > 0 ? pxData[x - byteWidth] : 0;
    const val = pxData[x] - up;

    sum += Math.abs(val);
  }

  return sum;
}

function filterAvg(
  pxData,
  pxPos: number,
  byteWidth: number,
  rawData,
  rawPos: number,
  bpp: number,
) {
  for (let x = 0; x < byteWidth; x++) {
    const left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    const up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
    const val = pxData[pxPos + x] - ((left + up) >> 1);

    rawData[rawPos + x] = val;
  }
}

function filterSumAvg(pxData, pxPos: number, byteWidth: number, bpp: number) {
  let sum = 0;
  for (let x = 0; x < byteWidth; x++) {
    const left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    const up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
    const val = pxData[pxPos + x] - ((left + up) >> 1);

    sum += Math.abs(val);
  }

  return sum;
}

function filterPaeth(
  pxData,
  pxPos: number,
  byteWidth: number,
  rawData,
  rawPos: number,
  bpp: number,
) {
  for (let x = 0; x < byteWidth; x++) {
    const left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    const up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
    const upleft = pxPos > 0 && x >= bpp
      ? pxData[pxPos + x - (byteWidth + bpp)]
      : 0;
    const val = pxData[pxPos + x] - paethPredictor(left, up, upleft);

    rawData[rawPos + x] = val;
  }
}

function filterSumPaeth(pxData, pxPos: number, byteWidth: number, bpp: number) {
  let sum = 0;
  for (let x = 0; x < byteWidth; x++) {
    const left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    const up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
    const upleft = pxPos > 0 && x >= bpp
      ? pxData[pxPos + x - (byteWidth + bpp)]
      : 0;
    const val = pxData[pxPos + x] - paethPredictor(left, up, upleft);

    sum += Math.abs(val);
  }

  return sum;
}

const filters = {
  0: filterNone,
  1: filterSub,
  2: filterUp,
  3: filterAvg,
  4: filterPaeth,
};

const filterSums = {
  0: filterSumNone,
  1: filterSumSub,
  2: filterSumUp,
  3: filterSumAvg,
  4: filterSumPaeth,
};

export function packFilter(
  pxData,
  width: number,
  height: number,
  options,
  bpp: number,
) {
  let filterTypes;
  if (!("filterType" in options) || options.filterType === -1) {
    filterTypes = [0, 1, 2, 3, 4];
  } else if (typeof options.filterType === "number") {
    filterTypes = [options.filterType];
  } else {
    throw new Error("unrecognised filter types");
  }

  if (options.bitDepth === 16) {
    bpp *= 2;
  }
  const byteWidth = width * bpp;
  let rawPos = 0;
  let pxPos = 0;
  const rawData = Buffer.alloc((byteWidth + 1) * height);

  let sel = filterTypes[0];

  for (let y = 0; y < height; y++) {
    if (filterTypes.length > 1) {
      // find best filter for this line (with lowest sum of values)
      let min = Infinity;

      for (let i = 0; i < filterTypes.length; i++) {
        const sum = filterSums[filterTypes[i]](pxData, pxPos, byteWidth, bpp);
        if (sum < min) {
          sel = filterTypes[i];
          min = sum;
        }
      }
    }

    rawData[rawPos] = sel;
    rawPos++;
    filters[sel](pxData, pxPos, byteWidth, rawData, rawPos, bpp);
    rawPos += byteWidth;
    pxPos += byteWidth;
  }

  return rawData;
}

export default packFilter;
