import zlib from "zlib";
import { Buffer } from "https://deno.land/std@0.89.0/node/buffer.ts";
import { constants } from "./constants.ts";
import { CrcCalculator } from "./crc.ts";
import { packBits } from "./bitpacker.ts";
import { packFilter } from "./filter_pack.ts";
import { Depnog } from "./types.ts";

export class Packer {
  private _options: Depnog.Options;

  private static supportedColorTypes = [
    Depnog.ColorType.GrayScale,
    Depnog.ColorType.Color,
    Depnog.ColorType.ColorAlpha,
    Depnog.ColorType.Alpha,
  ];

  private static supportedInputColorTypes = [
    Depnog.ColorType.GrayScale,
    Depnog.ColorType.Color,
    Depnog.ColorType.ColorAlpha,
    Depnog.ColorType.Alpha,
  ];

  private static supportedBitDepth: Depnog.BitDepth[] = [8, 16];

  public constructor(options: Depnog.Options) {
    this._options = { ...options };

    this._options.deflateChunkSize = options.deflateChunkSize ?? 32 * 1024;
    this._options.deflateLevel = options.deflateLevel ?? 9;
    this._options.deflateStrategy = options.deflateStrategy ?? 3;
    this._options.inputHasAlpha = options.inputHasAlpha ?? true;
    this._options.deflateFactory = options.deflateFactory || zlib.createDeflate;
    this._options.bitDepth = options.bitDepth ?? 8;
    this._options.colorType = options.colorType ?? Depnog.ColorType.ColorAlpha;
    this._options.inputColorType = options.inputColorType ??
      Depnog.ColorType.ColorAlpha;

    if (!Packer.supportedColorTypes.includes(this._options.colorType)) {
      throw new Error(
        `option color type:${this._options.colorType} is not supported at present`,
      );
    }

    if (
      !Packer.supportedInputColorTypes.includes(this._options.inputColorType)
    ) {
      throw new Error(
        `option input color type:${this._options.inputColorType} is not supported at present`,
      );
    }

    if (!Packer.supportedBitDepth.includes(this._options.bitDepth)) {
      throw new Error(
        `option bit depth:${this._options.bitDepth} is not supported at present`,
      );
    }
  }

  public getDeflateOptions() {
    return {
      chunkSize: this._options.deflateChunkSize,
      level: this._options.deflateLevel,
      strategy: this._options.deflateStrategy,
    };
  }

  public createDeflate() {
    return this._options.deflateFactory(this.getDeflateOptions());
  }

  public filterData(data: Buffer, width: number, height: number) {
    // convert to correct format for filtering (e.g. right bpp and bit depth)
    const packedData = packBits(data, width, height, this._options);
    // filter pixel data
    const bpp = constants.COLORTYPE_TO_BPP_MAP[this._options.colorType];
    const filteredData = packFilter(
      packedData,
      width,
      height,
      this._options,
      bpp,
    );

    return filteredData;
  }

  private _packChunk(type: Depnog.PackType, data?: Buffer) {
    const len = data ? data.length : 0;
    const buf = new Buffer(len + 12);

    buf.writeUInt32BE(len, 0);
    buf.writeUInt32BE(type, 4);

    if (data) {
      data.copy(buf, 8);
    }

    buf.writeInt32BE(
      CrcCalculator.crc32(buf.slice(4, buf.length - 4)),
      buf.length - 4,
    );
    return buf;
  }

  public packGAMA(gamma: number) {
    const buf = new Buffer(4);
    buf.writeUInt32BE(Math.floor(gamma * constants.GAMMA_DIVISION), 0);
    return this._packChunk(Depnog.PackType.gAMA, buf);
  }

  public packIHDR(width: number, height: number) {
    const buf = new Buffer(13);
    buf.writeUInt32BE(width, 0);
    buf.writeUInt32BE(height, 4);
    buf[8] = this._options.bitDepth; // Bit depth
    buf[9] = this._options.colorType; // colorType
    buf[10] = 0; // compression
    buf[11] = 0; // filter
    buf[12] = 0; // interlace

    return this._packChunk(Depnog.PackType.IHDR, buf);
  }

  public packIDAT(data: Buffer) {
    return this._packChunk(Depnog.PackType.IDAT, data);
  }

  public packIEND() {
    return this._packChunk(Depnog.PackType.IEND);
  }
}
