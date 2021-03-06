import Stream from "stream";
import Parser from "./parser-async.ts";
import Packer from "./packer-async.ts";
import * as PNGSync from "./png-sync.ts";

export class PNG extends Stream {
  constructor(options) {
    super();

    options = options || {};

    // coerce pixel dimensions to integers (also coerces undefined -> 0):
    this.width = options.width | 0;
    this.height = options.height | 0;

    this.data = this.width > 0 && this.height > 0
      ? Buffer.alloc(4 * this.width * this.height)
      : null;

    if (options.fill && this.data) {
      this.data.fill(0);
    }

    this.gamma = 0;
    this.readable = this.writable = true;

    this._parser = new Parser(options);

    this._parser.on("error", this.emit.bind(this, "error"));
    this._parser.on("close", this._handleClose.bind(this));
    this._parser.on("metadata", this._metadata.bind(this));
    this._parser.on("gamma", this._gamma.bind(this));
    this._parser.on(
      "parsed",
      function (data) {
        this.data = data;
        this.emit("parsed", data);
      }.bind(this),
    );

    this._packer = new Packer(options);
    this._packer.on("data", this.emit.bind(this, "data"));
    this._packer.on("end", this.emit.bind(this, "end"));
    this._parser.on("close", this._handleClose.bind(this));
    this._packer.on("error", this.emit.bind(this, "error"));
  }

  static sync = PNGSync;

  pack() {
    if (!this.data || !this.data.length) {
      this.emit("error", "No data provided");
      return this;
    }

    process.nextTick(
      function () {
        this._packer.pack(this.data, this.width, this.height, this.gamma);
      }.bind(this),
    );

    return this;
  }

  parse(data, callback) {
    if (callback) {
      let onParsed, onError;

      onParsed = function (parsedData) {
        this.removeListener("error", onError);

        this.data = parsedData;
        callback(null, this);
      }.bind(this);

      onError = function (err) {
        this.removeListener("parsed", onParsed);

        callback(err, null);
      }.bind(this);

      this.once("parsed", onParsed);
      this.once("error", onError);
    }

    this.end(data);
    return this;
  }

  write(data) {
    this._parser.write(data);
    return true;
  }

  end(data) {
    this._parser.end(data);
  }

  _metadata(metadata) {
    this.width = metadata.width;
    this.height = metadata.height;

    this.emit("metadata", metadata);
  }

  _gamma(gamma) {
    this.gamma = gamma;
  }

  _handleClose() {
    if (!this._parser.writable && !this._packer.readable) {
      this.emit("close");
    }
  }

  static bitblt(src, dst, srcX, srcY, width, height, deltaX, deltaY) {
    // coerce pixel dimensions to integers (also coerces undefined -> 0):
    srcX |= 0;
    srcY |= 0;
    width |= 0;
    height |= 0;
    deltaX |= 0;
    deltaY |= 0;

    if (
      srcX > src.width ||
      srcY > src.height ||
      srcX + width > src.width ||
      srcY + height > src.height
    ) {
      throw new Error("bitblt reading outside image");
    }

    if (
      deltaX > dst.width ||
      deltaY > dst.height ||
      deltaX + width > dst.width ||
      deltaY + height > dst.height
    ) {
      throw new Error("bitblt writing outside image");
    }

    for (let y = 0; y < height; y++) {
      src.data.copy(
        dst.data,
        ((deltaY + y) * dst.width + deltaX) << 2,
        ((srcY + y) * src.width + srcX) << 2,
        ((srcY + y) * src.width + srcX + width) << 2,
      );
    }
  }

  bitblt(
    dst,
    srcX,
    srcY,
    width,
    height,
    deltaX,
    deltaY,
  ) {
    PNG.bitblt(this, dst, srcX, srcY, width, height, deltaX, deltaY);
    return this;
  }

  static adjustGamma(src) {
    if (src.gamma) {
      for (let y = 0; y < src.height; y++) {
        for (let x = 0; x < src.width; x++) {
          let idx = (src.width * y + x) << 2;

          for (let i = 0; i < 3; i++) {
            let sample = src.data[idx + i] / 255;
            sample = Math.pow(sample, 1 / 2.2 / src.gamma);
            src.data[idx + i] = Math.round(sample * 255);
          }
        }
      }
      src.gamma = 0;
    }
  }

  adjustGamma() {
    PNG.adjustGamma(this);
  }
}
