// Genera public/assets/tilesets/cyberpunk.png
// Sin dependencias externas — usa zlib built-in de Node para comprimir PNG

import { writeFileSync, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const S = 16       // tamaño de tile en px
const TILES = 8    // cantidad de tiles en el spritesheet
const W = S * TILES  // 128px ancho total
const H = S          // 16px alto

// Buffer RGBA (W × H × 4 bytes)
const pixels = Buffer.alloc(W * H * 4, 0)

const setPixel = (x, y, r, g, b, a = 255) => {
  if (x < 0 || x >= W || y < 0 || y >= H) return
  const i = (y * W + x) * 4
  pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a
}

const fillRect = (x0, y0, w, h, r, g, b, a = 255) => {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      setPixel(x, y, r, g, b, a)
}

const drawBorder = (ox, r, g, b) => {
  for (let x = ox; x < ox + S; x++) {
    setPixel(x, 0, r, g, b)
    setPixel(x, S - 1, r, g, b)
  }
  for (let y = 0; y < S; y++) {
    setPixel(ox, y, r, g, b)
    setPixel(ox + S - 1, y, r, g, b)
  }
}

// Tile 0 (id global=1): Piso — azul marino oscuro
fillRect(0, 0, S, S, 0x1a, 0x1a, 0x2e)
drawBorder(0, 0x2a, 0x2a, 0x50)

// Tile 1 (id global=2): Pared — azul con borde cyan neón
fillRect(S, 0, S, S, 0x1e, 0x3a, 0x6e)
fillRect(S + 2, 2, S - 4, S - 4, 0x2a, 0x4a, 0x8a)
drawBorder(S, 0x40, 0x90, 0xd0)

// Tile 2 (id global=3): Piso base — azul muy oscuro
fillRect(S * 2, 0, S, S, 0x0a, 0x15, 0x35)
drawBorder(S * 2, 0x1a, 0x35, 0x65)

// Tiles 3-7: espacio para futuras tiles
for (let t = 3; t < TILES; t++) {
  fillRect(S * t, 0, S, S, 0x0d, 0x0d, 0x1a)
}

// ── PNG encoder sin dependencias ──────────────────────────────────────────
function makeCrcTable() {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
}
const CRC_TABLE = makeCrcTable()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

// Scanlines: byte de filtro 0 (None) + datos RGBA de cada fila
const scanlines = Buffer.alloc(H * (1 + W * 4))
for (let y = 0; y < H; y++) {
  scanlines[y * (1 + W * 4)] = 0
  pixels.copy(scanlines, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4)
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8  // bit depth
ihdr[9] = 6  // color type: RGBA
// bytes 10-12 = 0 (deflate, adaptive filter, no interlace)

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', deflateSync(scanlines)),
  pngChunk('IEND', Buffer.alloc(0)),
])

const outDir = join(__dirname, '..', 'public', 'assets', 'tilesets')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'cyberpunk.png'), png)
console.log(`✓ cyberpunk.png  (${W}×${H}px, ${TILES} tiles de ${S}×${S})`)
