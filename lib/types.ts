import { Buffer } from "https://deno.land/std@0.89.0/node/buffer.ts";

export declare namespace Depnog {
  // Pack types used in packer.ts
  enum PackType {
    IHDR = 0x49484452,
    IEND = 0x49454e44,
    IDAT = 0x49444154,
    PLTE = 0x504c5445,
    tRNS = 0x74524e53,
    gAMA = 0x67414d41,
  }

  // Color Types
  enum ColorType {
    GrayScale = 0,
    Palette = 1,
    Color = 2,
    Alpha = 4,
    PaletteColor = Palette + Color,
    ColorAlpha = Color + Alpha,
  }

  // PNB color component size in bits
  type BitDepth = 8 | 16;

  interface Color {
    red?: number;
    green?: number;
    blue?: number;
  }

  interface Options {
    // use this with height if you want to create png from scratch (default: 0)
    width?: number;
    // use this with width if you want to create png from scratch (default: 0)
    height?: number;
    // whether to fill the png created from scratch with 0 (default: false)
    fill?: boolean;
    // whether parser should be strict about checksums in source stream (default: true)
    checkCRC?: boolean;
    // chunk size used for deflating data chunks, this should be power of 2 and must not be less than 256 and more than 32*1024 (default: 32 kB)
    deflateChunkSize?: number;
    // compression level for deflate (default: 9)
    deflateLevel?: number;
    // compression strategy for deflate (default: 3)
    deflateStrategy: number;
    // deflate stream factory (default: zlib.createDeflate)
    deflateFactory?: any;
    // png filtering method for scanlines (default: -1 => auto, accepts array of numbers 0-4)
    filterType?: any;
    // the output colorType - see constants. 0 = grayscale, no alpha, 2 = color, no alpha, 4 = grayscale & alpha, 6 = color & alpha. Default currently 6, but in the future may calculate best mode.
    colorType?: ColorType;
    // the input colorType - see constants. Default is 6 (RGBA)
    inputColorType?: ColorType;
    // the bitDepth of the output, 8 or 16 bits. Input data is expected to have this bit depth. 16 bit data is expected in the system endianness (Default: 8)
    bitDepth?: BitDepth;
    // whether the input bitmap has 4 bytes per pixel (rgb and alpha) or 3 (rgb - no alpha).
    inputHasAlpha?: boolean;
    // an object containing red, green, and blue values between 0 and 255 that is used when packing a PNG if alpha is not to be included (default: 255,255,255)
    bgColor?: Color;
  }

  interface Read {
    length: number;
    allowLess: boolean;
    func: (_: Buffer) => void;
  }
}
