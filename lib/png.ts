import { Buffer } from "https://deno.land/std@0.89.0/node/buffer.ts";
import { Stream } from "https://deno.land/std@0.89.0/node/stream.ts";
import { ParserAsync as Parser } from "./parser_async.ts";
import { PackerAsync as Packer } from "./packer_async.ts";
import * as PNGSync from "./png_sync.ts";
import { Depnog } from "./types.ts";

export class PNG extends Stream {
  public width: number;
  public height: number;
  public data: Buffer | null;
  public gamma: number;
  public readable: boolean;
  public writable: boolean;
  private _parser: Parser;
  private _packer: Packer;

  public constructor(options: Depnog.Options) {
    super();

    // coerce pixel dimensions to integers (also coerces undefined -> 0):
    this.width = (options.width ?? 0) | 0;
    this.height = (options.height ?? 0) | 0;

    this.data = this.width > 0 && this.height > 0
      ? new Buffer(4 * this.width * this.height)
      : null;

    if (options.fill && this.data) {
      this.data.fill(0);
    }

    this.gamma = 0;
    this.readable = true;
    this.writable = true;

    this._parser = new Parser(options);

    this._parser.on("error", this.emit.bind(this, "error"));
    this._parser.on("close", this._handleClose.bind(this));
    this._parser.on("metadata", this._metadata.bind(this));
    this._parser.on("gamma", this._gamma.bind(this));
    this._parser.on(
      "parsed",
      (data: Buffer) => {
        this.data = data;
        this.emit("parsed", data);
      },
    );

    this._packer = new Packer(options);
    this._packer.on("data", this.emit.bind(this, "data"));
    this._packer.on("end", this.emit.bind(this, "end"));
    this._parser.on("close", this._handleClose.bind(this));
    this._packer.on("error", this.emit.bind(this, "error"));
  }

  static sync = PNGSync;

  public pack() {
    if (!this.data || !this.data.length) {
      this.emit("error", "No data provided");
      return this;
    }

    queueMicrotask(
      () => {
        this._packer.pack(this.data, this.width, this.height, this.gamma);
      },
    );

    return this;
  }

  public parse(data: Buffer, callback) {
    if (callback) {
      const onParsed = (parsedData) => {
        this.removeListener("error", onError);

        this.data = parsedData;
        callback(null, this);
      };

      const onError = (err) => {
        this.removeListener("parsed", onParsed);

        callback(err, null);
      };

      this.once("parsed", onParsed);
      this.once("error", onError);
    }

    this.end(data);

    return this;
  }

  public write(data: Buffer) {
    this._parser.write(data);
    return true;
  }

  public end(data: Buffer) {
    this._parser.end(data);
  }

  private _metadata(metadata) {
    this.width = metadata.width;
    this.height = metadata.height;

    this.emit("metadata", metadata);
  }

  private _gamma(gamma: number) {
    this.gamma = gamma;
  }

  private _handleClose() {
    if (!this._parser.writable && !this._packer.readable) {
      this.emit("close");
    }
  }

  public static bitblt(
    src: PNG,
    dst: PNG,
    srcX: number,
    srcY: number,
    width: number,
    height: number,
    deltaX: number,
    deltaY: number,
  ) {
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
      src.data?.copy(
        dst.data,
        ((deltaY + y) * dst.width + deltaX) << 2,
        ((srcY + y) * src.width + srcX) << 2,
        ((srcY + y) * src.width + srcX + width) << 2,
      );
    }
  }

  public bitblt(
    dst: PNG,
    srcX: number,
    srcY: number,
    width: number,
    height: number,
    deltaX: number,
    deltaY: number,
  ) {
    PNG.bitblt(this, dst, srcX, srcY, width, height, deltaX, deltaY);
    return this;
  }

  public static adjustGamma(src: PNG) {
    if (src.gamma) {
      for (let y = 0; y < src.height; y++) {
        for (let x = 0; x < src.width; x++) {
          const idx = (src.width * y + x) << 2;

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

  public adjustGamma() {
    PNG.adjustGamma(this);
  }
}
