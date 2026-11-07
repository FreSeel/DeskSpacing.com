// Original generated RGBA pixels, dedicated to CC0-1.0; see THIRD_PARTY_NOTICES.
import { Buffer } from 'node:buffer';
import { crc32, deflateSync } from 'node:zlib';

export function pixelPng(width = 1, height = 1) {
  function chunk(type, data) {
    const bytes = Buffer.concat([Buffer.from(type), data]);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(bytes));
    return Buffer.concat([size, bytes, checksum]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height, 255);
  for (let row = 0; row < height; row++) rows[row * (width * 4 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
