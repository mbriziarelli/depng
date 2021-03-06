import { parseSync } from "./parser_sync.ts";
import { packSync } from "./packer_sync.ts";

export function read(buffer, options) {
  return parseSync(buffer, options || {});
}

export function write(png, options) {
  return packSync(png, options);
}
