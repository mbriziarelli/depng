import SyncReader from "./sync-reader.ts";
import Filter from "./filter-parse.ts";

export function process(inBuffer, bitmapInfo) {
  const outBuffers = [];
  const reader = new SyncReader(inBuffer);
  const filter = new Filter(bitmapInfo, {
    read: reader.read.bind(reader),
    write: function (bufferPart) {
      outBuffers.push(bufferPart);
    },
    complete: function () {},
  });

  filter.start();
  reader.process();

  return Buffer.concat(outBuffers);
}
