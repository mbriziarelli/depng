import { Buffer } from "https://deno.land/std@0.89.0/node/buffer.ts";
import { ChunkStream } from "./chunkstream.ts";
import { Filter } from "./filter_parse.ts";

export class FilterAsync extends ChunkStream {
  private _filter: Filter;

  constructor() {
    super();

    const buffers: Buffer[] = [];

    this._filter = new Filter(bitmapInfo, {
      read: this.read.bind(this),
      write: (buffer: Buffer) => {
        buffers.push(buffer);
      },
      complete: () => {
        this.emit("complete", Buffer.concat(buffers));
      },
    });

    this._filter.start();
  }
}
