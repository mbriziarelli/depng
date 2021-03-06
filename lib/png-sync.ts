import parse from "./parser-sync.ts";
import pack from "./packer-sync.ts";

export function read(buffer, options) {
  return parse(buffer, options || {});
}

export function write(png, options) {
  return pack(png, options);
}
