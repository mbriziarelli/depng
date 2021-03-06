import SyncReader from "./sync-reader.ts";
import Filter from "./filter-parse.ts";

export function process(inBuffer: Uint8Array, bitmapInfo) {
  const outBuffers: Uint8Array[] = [];
  const reader = new SyncReader(inBuffer);
  const filter = new Filter(bitmapInfo, {
    read: reader.read.bind(reader),
    write: (bufferPart: Uint8Array) => {
      outBuffers.push(bufferPart);
    },
    complete: () => undefined,
  });

  filter.start();
  reader.process();

  return Buffer.concat(outBuffers);
}
