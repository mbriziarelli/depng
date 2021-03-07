import { Buffer } from "https://deno.land/std@0.89.0/node/buffer.ts";
import { SyncReader } from "./sync_reader.ts";
import { Filter } from "./filter_parse.ts";

export function process(inBuffer: Buffer, bitmapInfo) {
  const outBuffers: Buffer[] = [];
  const reader = new SyncReader(inBuffer);
  const filter = new Filter(bitmapInfo, {
    read: reader.read.bind(reader),
    write: (bufferPart: Buffer) => {
      outBuffers.push(bufferPart);
    },
    complete: () => undefined,
  });

  filter.start();
  reader.process();

  return Buffer.concat(outBuffers);
}
