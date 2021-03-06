import util from "util";
import Stream from "stream";
import constants from "./constants.ts";
import Packer from "./packer.ts";

export class PackerAsync extends Stream {
  constructor(opt) {
    super();

    const options = opt || {};

    this._packer = new Packer(options);
    this._deflate = this._packer.createDeflate();

    this.readable = true;
  }

  pack(data, width, height, gamma) {
    // Signature
    this.emit("data", new Uint8Array(constants.PNG_SIGNATURE));
    this.emit("data", this._packer.packIHDR(width, height));

    if (gamma) {
      this.emit("data", this._packer.packGAMA(gamma));
    }

    const filteredData = this._packer.filterData(data, width, height);

    // compress it
    this._deflate.on("error", this.emit.bind(this, "error"));

    this._deflate.on(
      "data",
      (compressedData) => {
        this.emit("data", this._packer.packIDAT(compressedData));
      },
    );

    this._deflate.on(
      "end",
      () => {
        this.emit("data", this._packer.packIEND());
        this.emit("end");
      },
    );

    this._deflate.end(filteredData);
  }
}

export default PackerAsync;
