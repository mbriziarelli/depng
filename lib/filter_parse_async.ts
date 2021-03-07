import { Buffer } from "https://deno.land/std@0.89.0/node/buffer.ts";
import { ChunkStream } from "./chunkstream.ts";
import { Filter } from "./filter_parse.ts";

export class FilterAsync extends ChunkStream {
  private _filter: Filter;
  private _buffers: Buffer[];

  constructor() {
    super();

    this._buffers = [];
    this._filter = new Filter(bitmapInfo, {
      read: this.read.bind(this),
      write: (buffer: Buffer) => {
        this._buffers.push(buffer);
      },
      complete: () => {
        this.emit("complete", Buffer.concat(this._buffers));
      },
    });

    this._filter.start();
  }
}
