import constants from "./constants.ts";
import Packer from "./packer.ts";
import zlib from "zlib";

const hasSyncZlib = !!zlib.deflateSync;

export function packSync(metaData, opt) {
  if (!hasSyncZlib) {
    throw new Error(
      "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0",
    );
  }

  const options = opt || {};

  const packer = new Packer(options);

  const chunks: Uint8Array[] = [];

  // Signature
  chunks.push(new Uint8Array(constants.PNG_SIGNATURE));

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

export default packSync;
