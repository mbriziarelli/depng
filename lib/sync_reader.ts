import { Buffer } from "https://deno.land/std@0.89.0/node/buffer.ts";
import { Depnog } from "./types.ts";

export class SyncReader {
  private _buffer: Buffer;
  private _reads: Depnog.Read[];

  public constructor(buffer: Buffer) {
    this._buffer = buffer;
    this._reads = [];
  }

  public read(length: number, callback: (_: Buffer) => void) {
    this._reads.push({
      length: Math.abs(length), // if length < 0 then at most this length
      allowLess: length < 0,
      func: callback,
    });
  }

  public process() {
    // as long as there is any data and read requests
    while (this._reads.length > 0 && this._buffer.length) {
      const read = this._reads[0];

      if (
        this._buffer.length &&
        (this._buffer.length >= read.length || read.allowLess)
      ) {
        // ok there is any data so that we can satisfy this request
        this._reads.shift(); // == read

        const buf = this._buffer;

        this._buffer = buf.slice(read.length);

        read.func.call(this, buf.slice(0, read.length));
      } else {
        break;
      }
    }

    if (this._reads.length > 0) {
      throw new Error("There are some read requests waitng on finished stream");
    }

    if (this._buffer.length > 0) {
      throw new Error("unrecognised content at end of stream");
    }
  }
}
