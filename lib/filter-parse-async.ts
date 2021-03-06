import ChunkStream from "./chunkstream.ts";
import Filter from "./filter-parse.ts";

export class FilterAsync extends ChunkStream {
  _filter: Filter;

  constructor() {
    super();

    const buffers = [];

    this._filter = new Filter(bitmapInfo, {
      read: this.read.bind(this),
      write: (buffer) => {
        buffers.push(buffer);
      },
      complete: () => {
        this.emit("complete", Buffer.concat(buffers));
      },
    });

    this._filter.start();
  }
}

export default FilterAsync;
