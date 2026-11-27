import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { drawStatusIconPng } from '../../src/main/app/tray-icon'
import { TRAY_STATE_COLORS } from '../../src/shared/config/theme'

describe('tray status icon', () => {
  it('encodes a valid RGBA PNG of the requested size', () => {
    const png = drawStatusIconPng(16, TRAY_STATE_COLORS.ACTIVE)
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
    expect(png.readUInt32BE(16)).toBe(16) // width
    expect(png.readUInt32BE(20)).toBe(16) // height
    expect(png[25]).toBe(6) // RGBA
  })

  it('fills the center with the state color and leaves the corners transparent', () => {
    const png = drawStatusIconPng(16, TRAY_STATE_COLORS.PAUSED)
    const dataLength = png.readUInt32BE(33)
    const pixels = inflateSync(png.subarray(41, 41 + dataLength))
    const pixel = (x: number, y: number): number[] => {
      const offset = y * (16 * 4 + 1) + 1 + x * 4
      return [...pixels.subarray(offset, offset + 4)]
    }
    expect(pixel(8, 8)).toEqual([0xdc, 0x26, 0x26, 255])
    expect(pixel(0, 0)[3]).toBe(0)
  })
})
