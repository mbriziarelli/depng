import { ChunkStream } from "./chunkstream.ts";
import { Filter } from "./filter_parse.ts";

export class FilterAsync extends ChunkStream {
  private _filter: Filter;

  constructor() {
    super();

    const buffers: Uint8Array[] = [];

    this._filter = new Filter(bitmapInfo, {
      read: this.read.bind(this),
      write: (buffer: Uint8Array) => {
        buffers.push(buffer);
      },
      complete: () => {
        this.emit("complete", Buffer.concat(buffers));
      },
    });

    this._filter.start();
  }
}
