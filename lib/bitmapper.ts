import { Buffer } from "https://deno.land/std@0.89.0/node/buffer.ts";
import { getImagePasses, getInterlaceIterator } from "./interlace.ts";

const pixelBppMapper = [
  // 0 - dummy entry
  () => undefined,

  // 1 - L
  // 0: 0, 1: 0, 2: 0, 3: 0xff
  (
    pxData: Buffer,
    data: Buffer,
    pxPos: number,
    rawPos: number,
  ) => {
    if (rawPos === data.length) {
      throw new Error("Ran out of data");
    }

    const pixel = data[rawPos];
    pxData[pxPos] = pixel;
    pxData[pxPos + 1] = pixel;
    pxData[pxPos + 2] = pixel;
    pxData[pxPos + 3] = 0xff;
  },

  // 2 - LA
  // 0: 0, 1: 0, 2: 0, 3: 1
  (
    pxData: Buffer,
    data: Buffer,
    pxPos: number,
    rawPos: number,
  ) => {
    if (rawPos + 1 >= data.length) {
      throw new Error("Ran out of data");
    }

    const pixel = data[rawPos];
    pxData[pxPos] = pixel;
    pxData[pxPos + 1] = pixel;
    pxData[pxPos + 2] = pixel;
    pxData[pxPos + 3] = data[rawPos + 1];
  },

  // 3 - RGB
  // 0: 0, 1: 1, 2: 2, 3: 0xff
  (
    pxData: Buffer,
    data: Buffer,
    pxPos: number,
    rawPos: number,
  ) => {
    if (rawPos + 2 >= data.length) {
      throw new Error("Ran out of data");
    }

    pxData[pxPos] = data[rawPos];
    pxData[pxPos + 1] = data[rawPos + 1];
    pxData[pxPos + 2] = data[rawPos + 2];
    pxData[pxPos + 3] = 0xff;
  },

  // 4 - RGBA
  // 0: 0, 1: 1, 2: 2, 3: 3
  (
    pxData: Buffer,
    data: Buffer,
    pxPos: number,
    rawPos: number,
  ) => {
    if (rawPos + 3 >= data.length) {
      throw new Error("Ran out of data");
    }

    pxData[pxPos] = data[rawPos];
    pxData[pxPos + 1] = data[rawPos + 1];
    pxData[pxPos + 2] = data[rawPos + 2];
    pxData[pxPos + 3] = data[rawPos + 3];
  },
];

const pixelBppCustomMapper = [
  // 0 - dummy entry
  () => undefined,

  // 1 - L
  // 0: 0, 1: 0, 2: 0, 3: 0xff
  (
    pxData: Buffer,
    pixelData: Buffer,
    pxPos: number,
    maxBit: number,
  ) => {
    const pixel = pixelData[0];
    pxData[pxPos] = pixel;
    pxData[pxPos + 1] = pixel;
    pxData[pxPos + 2] = pixel;
    pxData[pxPos + 3] = maxBit;
  },

  // 2 - LA
  // 0: 0, 1: 0, 2: 0, 3: 1
  (pxData: Buffer, pixelData: Buffer, pxPos: number) => {
    const pixel = pixelData[0];
    pxData[pxPos] = pixel;
    pxData[pxPos + 1] = pixel;
    pxData[pxPos + 2] = pixel;
    pxData[pxPos + 3] = pixelData[1];
  },

  // 3 - RGB
  // 0: 0, 1: 1, 2: 2, 3: 0xff
  (
    pxData: Buffer,
    pixelData: Buffer,
    pxPos: number,
    maxBit: number,
  ) => {
    pxData[pxPos] = pixelData[0];
    pxData[pxPos + 1] = pixelData[1];
    pxData[pxPos + 2] = pixelData[2];
    pxData[pxPos + 3] = maxBit;
  },

  // 4 - RGBA
  // 0: 0, 1: 1, 2: 2, 3: 3
  (pxData: Buffer, pixelData: Buffer, pxPos: number) => {
    pxData[pxPos] = pixelData[0];
    pxData[pxPos + 1] = pixelData[1];
    pxData[pxPos + 2] = pixelData[2];
    pxData[pxPos + 3] = pixelData[3];
  },
];

function bitRetriever(data: Buffer, depth: number) {
  let leftOver: number[] = [];
  let i = 0;

  function split() {
    if (i === data.length) {
      throw new Error("Ran out of data");
    }
    const byte = data[i];
    i++;
    switch (depth) {
      default:
        throw new Error("unrecognised depth");
      case 16: {
        const byte2 = data[i];
        i++;
        leftOver.push((byte << 8) + byte2);
        break;
      }
      case 4: {
        const byte2 = byte & 0x0f;
        const byte1 = byte >> 4;
        leftOver.push(byte1, byte2);
        break;
      }
      case 2: {
        const byte4 = byte & 3;
        const byte3 = (byte >> 2) & 3;
        const byte2 = (byte >> 4) & 3;
        const byte1 = (byte >> 6) & 3;
        leftOver.push(byte1, byte2, byte3, byte4);
        break;
      }
      case 1: {
        const byte8 = byte & 1;
        const byte7 = (byte >> 1) & 1;
        const byte6 = (byte >> 2) & 1;
        const byte5 = (byte >> 3) & 1;
        const byte4 = (byte >> 4) & 1;
        const byte3 = (byte >> 5) & 1;
        const byte2 = (byte >> 6) & 1;
        const byte1 = (byte >> 7) & 1;
        leftOver.push(byte1, byte2, byte3, byte4, byte5, byte6, byte7, byte8);
        break;
      }
    }
  }

  return {
    get: (count: number) => {
      while (leftOver.length < count) {
        split();
      }
      const returner = leftOver.slice(0, count);
      leftOver = leftOver.slice(count);
      return returner;
    },
    resetAfterLine: () => {
      leftOver.length = 0;
    },
    end: () => {
      if (i !== data.length) {
        throw new Error("extra data found");
      }
    },
  };
}

function mapImage8Bit(
  image,
  pxData: Buffer,
  getPxPos,
  bpp: number,
  data: Buffer,
  rawPos: number,
) {
  const imageWidth = image.width;
  const imageHeight = image.height;
  const imagePass = image.index;
  for (let y = 0; y < imageHeight; y++) {
    for (let x = 0; x < imageWidth; x++) {
      const pxPos = getPxPos(x, y, imagePass);
      pixelBppMapper[bpp](pxData, data, pxPos, rawPos);
      rawPos += bpp;
    }
  }
  return rawPos;
}

function mapImageCustomBit(
  image,
  pxData: Buffer,
  getPxPos,
  bpp: number,
  bits,
  maxBit: number,
) {
  const imageWidth = image.width;
  const imageHeight = image.height;
  const imagePass = image.index;
  for (let y = 0; y < imageHeight; y++) {
    for (let x = 0; x < imageWidth; x++) {
      const pixelData = bits.get(bpp);
      const pxPos = getPxPos(x, y, imagePass);
      pixelBppCustomMapper[bpp](pxData, pixelData, pxPos, maxBit);
    }
    bits.resetAfterLine();
  }
}

export function dataToBitMap(data: Buffer, bitmapInfo) {
  const width = bitmapInfo.width;
  const height = bitmapInfo.height;
  const depth = bitmapInfo.depth;
  const bpp = bitmapInfo.bpp;
  const interlace = bitmapInfo.interlace;
  let bits;

  if (depth !== 8) {
    bits = bitRetriever(data, depth);
  }
  let pxData;
  if (depth <= 8) {
    pxData = new Buffer(width * height * 4);
  } else {
    pxData = new Uint16Array(width * height * 4);
  }
  const maxBit = Math.pow(2, depth) - 1;
  let rawPos = 0;
  let images;
  let getPxPos;

  if (interlace) {
    images = getImagePasses(width, height);
    getPxPos = getInterlaceIterator(width);
  } else {
    let nonInterlacedPxPos = 0;
    getPxPos = () => {
      const returner = nonInterlacedPxPos;
      nonInterlacedPxPos += 4;
      return returner;
    };
    images = [{ width, height }];
  }

  for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
    if (depth === 8) {
      rawPos = mapImage8Bit(
        images[imageIndex],
        pxData,
        getPxPos,
        bpp,
        data,
        rawPos,
      );
    } else {
      mapImageCustomBit(
        images[imageIndex],
        pxData,
        getPxPos,
        bpp,
        bits,
        maxBit,
      );
    }
  }
  if (depth === 8) {
    if (rawPos !== data.length) {
      throw new Error("extra data found");
    }
  } else {
    bits.end();
  }

  return pxData;
}
