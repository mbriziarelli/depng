import zlib from "zlib";
import { ChunkStream } from "./chunkstream.ts";
import { FilterAsync } from "./filter_parse_async.ts";
import { Parser } from "./parser.ts";
import { dataToBitMap } from "./bitmapper.ts";
import { normalizeFormat } from "./format_normaliser.ts";
import { Depnog } from "./types.ts";

export class ParserAsync extends ChunkStream {
  private _parser: Parser;
  private _options: Depnog.Options;
  public writable: boolean;

  constructor(options: Depnog.Options) {
    super();

    this._parser = new Parser(options, {
      read: this.read.bind(this),
      error: this._handleError.bind(this),
      metadata: this._handleMetaData.bind(this),
      gamma: this.emit.bind(this, "gamma"),
      palette: this._handlePalette.bind(this),
      transColor: this._handleTransColor.bind(this),
      finished: this._finished.bind(this),
      inflateData: this._inflateData.bind(this),
      simpleTransparency: this._simpleTransparency.bind(this),
      headersFinished: this._headersFinished.bind(this),
    });
    this._options = options;
    this.writable = true;

    this._parser.start();
  }

  _handleError(err) {
    this.emit("error", err);

    this.writable = false;

    this.destroy();

    if (this._inflate && this._inflate.destroy) {
      this._inflate.destroy();
    }

    if (this._filter) {
      this._filter.destroy();
      // For backward compatibility with Node 7 and below.
      // Suppress errors due to _inflate calling write() even after
      // it's destroy()'ed.
      this._filter.on("error", function () {});
    }

    this.errord = true;
  }

  _inflateData(data) {
    if (!this._inflate) {
      if (this._bitmapInfo.interlace) {
        this._inflate = zlib.createInflate();

        this._inflate.on("error", this.emit.bind(this, "error"));
        this._filter.on("complete", this._complete.bind(this));

        this._inflate.pipe(this._filter);
      } else {
        const rowSize = ((this._bitmapInfo.width *
            this._bitmapInfo.bpp *
            this._bitmapInfo.depth +
          7) >>
          3) +
          1;
        const imageSize = rowSize * this._bitmapInfo.height;
        const chunkSize = Math.max(imageSize, zlib.Z_MIN_CHUNK);

        this._inflate = zlib.createInflate({ chunkSize: chunkSize });
        let leftToInflate = imageSize;

        const emitError = this.emit.bind(this, "error");
        this._inflate.on("error", function (err) {
          if (!leftToInflate) {
            return;
          }

          emitError(err);
        });
        this._filter.on("complete", this._complete.bind(this));

        const filterWrite = this._filter.write.bind(this._filter);
        this._inflate.on("data", function (chunk) {
          if (!leftToInflate) {
            return;
          }

          if (chunk.length > leftToInflate) {
            chunk = chunk.slice(0, leftToInflate);
          }

          leftToInflate -= chunk.length;

          filterWrite(chunk);
        });

        this._inflate.on("end", this._filter.end.bind(this._filter));
      }
    }
    this._inflate.write(data);
  }

  _handleMetaData(metaData) {
    this._metaData = metaData;
    this._bitmapInfo = Object.create(metaData);

    this._filter = new FilterAsync(this._bitmapInfo);
  }

  _handleTransColor(transColor) {
    this._bitmapInfo.transColor = transColor;
  }

  _handlePalette(palette) {
    this._bitmapInfo.palette = palette;
  }

  _simpleTransparency() {
    this._metaData.alpha = true;
  }

  _headersFinished() {
    // Up until this point, we don't know if we have a tRNS chunk (alpha)
    // so we can't emit metadata any earlier
    this.emit("metadata", this._metaData);
  }

  _finished() {
    if (this.errord) {
      return;
    }

    if (!this._inflate) {
      this.emit("error", "No Inflate block");
    } else {
      // no more data to inflate
      this._inflate.end();
    }
  }

  _complete(filteredData) {
    if (this.errord) {
      return;
    }

    let normalisedBitmapData;

    try {
      let bitmapData = dataToBitMap(filteredData, this._bitmapInfo);

      normalisedBitmapData = normalizeFormat(
        bitmapData,
        this._bitmapInfo,
        this._options.skipRescale,
      );
      bitmapData = null;
    } catch (ex) {
      this._handleError(ex);
      return;
    }

    this.emit("parsed", normalisedBitmapData);
  }
}
