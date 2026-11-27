import { crc32, deflateSync } from 'node:zlib'
import type { RgbColor } from '../../shared/config/theme'

/**
 * Draws the round tray status icon as PNG bytes, so no image files are needed
 * for the status colors. Pure function: easy to test, no Electron import.
 */
export function drawStatusIconPng(size: number, color: RgbColor): Buffer {
  const rgba = Buffer.alloc(size * size * 4)
  const center = (size - 1) / 2
  const radius = size * 0.42

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - center, y - center)
      // One pixel of soft edge for a smooth circle.
      const coverage = Math.min(1, Math.max(0, radius - distance + 0.5))
      const offset = (y * size + x) * 4
      rgba[offset] = color.red
      rgba[offset + 1] = color.green
      rgba[offset + 2] = color.blue
      rgba[offset + 3] = Math.round(coverage * 255)
    }
  }
  return encodeRgbaPng(size, size, rgba)
}

/** Minimal PNG encoder for 8-bit RGBA pixels. */
export function encodeRgbaPng(width: number, height: number, rgba: Buffer): Buffer {
  if (rgba.length !== width * height * 4) throw new Error('Pixel data does not match the size.')

  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1)
    rows[rowStart] = 0 // filter type None
    rgba.copy(rows, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // color type RGBA
  header[10] = 0
  header[11] = 0
  header[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(typeAndData) >>> 0, 0)
  return Buffer.concat([length, typeAndData, checksum])
}
