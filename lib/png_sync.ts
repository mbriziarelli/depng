import parse from "./parser_sync.ts";
import pack from "./packer_sync.ts";

export function read(buffer, options) {
  return parse(buffer, options || {});
}

export function write(png, options) {
  return pack(png, options);
}
