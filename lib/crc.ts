import { Buffer } from "https://deno.land/std@0.89.0/node/buffer.ts";

const crcTable: number[] = [];

(function () {
  for (let i = 0; i < 256; i++) {
    let currentCrc = i;
    for (let j = 0; j < 8; j++) {
      if (currentCrc & 1) {
        currentCrc = 0xedb88320 ^ (currentCrc >>> 1);
      } else {
        currentCrc = currentCrc >>> 1;
      }
    }
    crcTable[i] = currentCrc;
  }
})();

export class CrcCalculator {
  private _crc: number;

  public constructor() {
    this._crc = -1;
  }

  public write(buf: Buffer) {
    for (let i = 0; i < buf.length; i++) {
      this._crc = crcTable[(this._crc ^ buf[i]) & 0xff] ^ (this._crc >>> 8);
    }

    return true;
  }

  public crc32() {
    return this._crc ^ -1;
  }

  public static crc32(buf: Buffer) {
    let crc = -1;

    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }

    return crc ^ -1;
  }
}
