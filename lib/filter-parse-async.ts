import util from "util";
import ChunkStream from "./chunkstream.ts";
import Filter from "./filter-parse.ts";

export default class FilterAsync extends ChunkStream {
  constructor() {
    super();

    let buffers = [];
    let that = this;

    this._filter = new Filter(bitmapInfo, {
      read: this.read.bind(this),
      write: function (buffer) {
        buffers.push(buffer);
      },
      complete: function () {
        that.emit("complete", Buffer.concat(buffers));
      },
    });

    this._filter.start();
  }
}
