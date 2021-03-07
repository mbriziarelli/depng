import zlib from "zlib";
import { Buffer } from "https://deno.land/std@0.89.0/node/buffer.ts";
import { constants } from "./constants.ts";
import { Packer } from "./packer.ts";

const hasSyncZlib = !!zlib.deflateSync;

export function packSync(metaData, opt) {
  if (!hasSyncZlib) {
    throw new Error(
      "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0",
    );
  }

  const options = opt || {};
  const packer = new Packer(options);
  const chunks: Buffer[] = [];

  // Signature
  chunks.push(new Buffer(constants.PNG_SIGNATURE));

  // Header
  chunks.push(packer.packIHDR(metaData.width, metaData.height));

  if (metaData.gamma) {
    chunks.push(packer.packGAMA(metaData.gamma));
  }

  let filteredData = packer.filterData(
    metaData.data,
    metaData.width,
    metaData.height,
  );

  // compress it
  const compressedData = zlib.deflateSync(
    filteredData,
    packer.getDeflateOptions(),
  );
  filteredData = null;

  if (!compressedData || !compressedData.length) {
    throw new Error("bad png - invalid compressed data response");
  }
  chunks.push(packer.packIDAT(compressedData));

  // End
  chunks.push(packer.packIEND());

  return Buffer.concat(chunks);
}
