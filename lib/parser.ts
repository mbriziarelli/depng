import { constants } from "./constants.ts";
import { CrcCalculator } from "./crc.ts";
import { Depnog } from "./types.ts";

export class Parser {
  private _options: Depnog.Options;
  private _hasIHDR: boolean;
  private _hasIEND: boolean;
  private _emittedHeadersFinished: boolean;

  public constructor(options: Depnog.Options, dependencies) {
    this._options = options;
    options.checkCRC = options.checkCRC !== false;

    this._hasIHDR = false;
    this._hasIEND = false;
    this._emittedHeadersFinished = false;

    // input flags/metadata
    this._palette = [];
    this._colorType = 0;

    this._chunks = {};
    this._chunks[constants.TYPE_IHDR] = this._handleIHDR.bind(this);
    this._chunks[constants.TYPE_IEND] = this._handleIEND.bind(this);
    this._chunks[constants.TYPE_IDAT] = this._handleIDAT.bind(this);
    this._chunks[constants.TYPE_PLTE] = this._handlePLTE.bind(this);
    this._chunks[constants.TYPE_tRNS] = this._handleTRNS.bind(this);
    this._chunks[constants.TYPE_gAMA] = this._handleGAMA.bind(this);

    this.read = dependencies.read;
    this.error = dependencies.error;
    this.metadata = dependencies.metadata;
    this.gamma = dependencies.gamma;
    this.transColor = dependencies.transColor;
    this.palette = dependencies.palette;
    this.parsed = dependencies.parsed;
    this.inflateData = dependencies.inflateData;
    this.finished = dependencies.finished;
    this.simpleTransparency = dependencies.simpleTransparency;
    this.headersFinished = dependencies.headersFinished || function () {};
  }

  public start() {
    this.read(constants.PNG_SIGNATURE.length, this._parseSignature.bind(this));
  }

  private _parseSignature(data) {
    const signature = constants.PNG_SIGNATURE;

    for (let i = 0; i < signature.length; i++) {
      if (data[i] !== signature[i]) {
        this.error(new Error("Invalid file signature"));
        return;
      }
    }
    this.read(8, this._parseChunkBegin.bind(this));
  }

  private _parseChunkBegin(data) {
    // chunk content length
    const length = data.readUInt32BE(0);

    // chunk type
    const type = data.readUInt32BE(4);
    let name = "";
    for (let i = 4; i < 8; i++) {
      name += String.fromCharCode(data[i]);
    }

    //console.log('chunk ', name, length);

    // chunk flags
    const ancillary = Boolean(data[4] & 0x20); // or critical
    //    priv = Boolean(data[5] & 0x20), // or public
    //    safeToCopy = Boolean(data[7] & 0x20); // or unsafe

    if (!this._hasIHDR && type !== constants.TYPE_IHDR) {
      this.error(new Error("Expected IHDR on beggining"));
      return;
    }

    this._crc = new CrcCalculator();
    this._crc.write(Buffer.from(name));

    if (this._chunks[type]) {
      return this._chunks[type](length);
    }

    if (!ancillary) {
      this.error(new Error("Unsupported critical chunk type " + name));
      return;
    }

    this.read(length + 4, this._skipChunk.bind(this));
  }

  private _skipChunk(/*data*/) {
    this.read(8, this._parseChunkBegin.bind(this));
  }

  private _handleChunkEnd() {
    this.read(4, this._parseChunkEnd.bind(this));
  }

  private _parseChunkEnd(data) {
    const fileCrc = data.readInt32BE(0);
    const calcCrc = this._crc.crc32();

    // check CRC
    if (this._options.checkCRC && calcCrc !== fileCrc) {
      this.error(new Error("Crc error - " + fileCrc + " - " + calcCrc));
      return;
    }

    if (!this._hasIEND) {
      this.read(8, this._parseChunkBegin.bind(this));
    }
  }

  private _handleIHDR(length) {
    this.read(length, this._parseIHDR.bind(this));
  }
  private _parseIHDR(data) {
    this._crc.write(data);

    const width = data.readUInt32BE(0);
    const height = data.readUInt32BE(4);
    const depth = data[8];
    const colorType = data[9]; // bits: 1 palette, 2 color, 4 alpha
    const compr = data[10];
    const filter = data[11];
    const interlace = data[12];

    // console.log('    width', width, 'height', height,
    //     'depth', depth, 'colorType', colorType,
    //     'compr', compr, 'filter', filter, 'interlace', interlace
    // );

    if (
      depth !== 8 &&
      depth !== 4 &&
      depth !== 2 &&
      depth !== 1 &&
      depth !== 16
    ) {
      this.error(new Error("Unsupported bit depth " + depth));
      return;
    }
    if (!(colorType in constants.COLORTYPE_TO_BPP_MAP)) {
      this.error(new Error("Unsupported color type"));
      return;
    }
    if (compr !== 0) {
      this.error(new Error("Unsupported compression method"));
      return;
    }
    if (filter !== 0) {
      this.error(new Error("Unsupported filter method"));
      return;
    }
    if (interlace !== 0 && interlace !== 1) {
      this.error(new Error("Unsupported interlace method"));
      return;
    }

    this._colorType = colorType;

    const bpp = constants.COLORTYPE_TO_BPP_MAP[this._colorType];

    this._hasIHDR = true;

    this.metadata({
      width: width,
      height: height,
      depth: depth,
      interlace: Boolean(interlace),
      palette: Boolean(colorType & constants.COLORTYPE_PALETTE),
      color: Boolean(colorType & constants.COLORTYPE_COLOR),
      alpha: Boolean(colorType & constants.COLORTYPE_ALPHA),
      bpp: bpp,
      colorType: colorType,
    });

    this._handleChunkEnd();
  }

  private _handlePLTE(length) {
    this.read(length, this._parsePLTE.bind(this));
  }
  private _parsePLTE(data) {
    this._crc.write(data);

    const entries = Math.floor(data.length / 3);
    // console.log('Palette:', entries);

    for (let i = 0; i < entries; i++) {
      this._palette.push([data[i * 3], data[i * 3 + 1], data[i * 3 + 2], 0xff]);
    }

    this.palette(this._palette);

    this._handleChunkEnd();
  }

  private _handleTRNS(length) {
    this.simpleTransparency();
    this.read(length, this._parseTRNS.bind(this));
  }

  private _parseTRNS(data) {
    this._crc.write(data);

    // palette
    if (this._colorType === constants.COLORTYPE_PALETTE_COLOR) {
      if (this._palette.length === 0) {
        this.error(new Error("Transparency chunk must be after palette"));
        return;
      }
      if (data.length > this._palette.length) {
        this.error(new Error("More transparent colors than palette size"));
        return;
      }
      for (let i = 0; i < data.length; i++) {
        this._palette[i][3] = data[i];
      }
      this.palette(this._palette);
    }

    // for colorType 0 (grayscale) and 2 (rgb)
    // there might be one gray/color defined as transparent
    if (this._colorType === constants.COLORTYPE_GRAYSCALE) {
      // grey, 2 bytes
      this.transColor([data.readUInt16BE(0)]);
    }
    if (this._colorType === constants.COLORTYPE_COLOR) {
      this.transColor([
        data.readUInt16BE(0),
        data.readUInt16BE(2),
        data.readUInt16BE(4),
      ]);
    }

    this._handleChunkEnd();
  }

  private _handleGAMA(length) {
    this.read(length, this._parseGAMA.bind(this));
  }
  private _parseGAMA(data) {
    this._crc.write(data);
    this.gamma(data.readUInt32BE(0) / constants.GAMMA_DIVISION);

    this._handleChunkEnd();
  }

  private _handleIDAT(length) {
    if (!this._emittedHeadersFinished) {
      this._emittedHeadersFinished = true;
      this.headersFinished();
    }
    this.read(-length, this._parseIDAT.bind(this, length));
  }

  private _parseIDAT(length, data) {
    this._crc.write(data);

    if (
      this._colorType === constants.COLORTYPE_PALETTE_COLOR &&
      this._palette.length === 0
    ) {
      throw new Error("Expected palette not found");
    }

    this.inflateData(data);
    const leftOverLength = length - data.length;

    if (leftOverLength > 0) {
      this._handleIDAT(leftOverLength);
    } else {
      this._handleChunkEnd();
    }
  }

  private _handleIEND(length) {
    this.read(length, this._parseIEND.bind(this));
  }

  private _parseIEND(data) {
    this._crc.write(data);

    this._hasIEND = true;
    this._handleChunkEnd();

    if (this.finished) {
      this.finished();
    }
  }
}
