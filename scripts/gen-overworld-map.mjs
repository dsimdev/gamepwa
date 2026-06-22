// Genera public/assets/maps/overworld.json (formato Tiled 1.10)
// 45×80 tiles de 16×16px = 720×1280px

import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const S    = 16    // tile size
const COLS = 45    // OW_W / S = 720 / 16
const ROWS = 80    // OW_H / S = 1280 / 16
const BORDER = 2   // tiles de borde (≈ WALL=28px)

const FLOOR = 1    // id global del tile piso
const WALL  = 2    // id global del tile pared
const EMPTY = 0    // sin tile

// ── Layer Ground (todo piso) ───────────────────────────────────────────────
const ground = new Array(COLS * ROWS).fill(FLOOR)

// ── Layer Walls (bordes + rocas) ──────────────────────────────────────────
const walls = new Array(COLS * ROWS).fill(EMPTY)

const setWall = (col, row) => {
  if (col >= 0 && col < COLS && row >= 0 && row < ROWS)
    walls[row * COLS + col] = WALL
}

const fillWall = (col, row, w, h) => {
  for (let r = row; r < row + h; r++)
    for (let c = col; c < col + w; c++)
      setWall(c, r)
}

// Bordes 2 tiles de espesor
for (let c = 0; c < COLS; c++) {
  for (let t = 0; t < BORDER; t++) {
    setWall(c, t)
    setWall(c, ROWS - 1 - t)
  }
}
for (let r = 0; r < ROWS; r++) {
  for (let t = 0; t < BORDER; t++) {
    setWall(t, r)
    setWall(COLS - 1 - t, r)
  }
}

// Rocas — convertidas de addWall(cx, cy, w, h) a tile coords
// addWall(240, 180, 80, 80)  → px [200,280) × [140,220)
fillWall(Math.floor(200/S), Math.floor(140/S),
         Math.ceil(80/S),   Math.ceil(80/S))

// addWall(440, 1100, 100, 60)  → px [390,490) × [1070,1130)
fillWall(Math.floor(390/S), Math.floor(1070/S),
         Math.ceil(100/S),  Math.ceil(60/S))

// addWall(320, 1060, 60, 120)  → px [290,350) × [1000,1120)
fillWall(Math.floor(290/S), Math.floor(1000/S),
         Math.ceil(60/S),   Math.ceil(120/S))

// addWall(500, 260, 72, 72)  → px [464,536) × [224,296)
fillWall(Math.floor(464/S), Math.floor(224/S),
         Math.ceil(72/S),   Math.ceil(72/S))

// ── Layer Objects ─────────────────────────────────────────────────────────
const OW_W = COLS * S  // 720
const OW_H = ROWS * S  // 1280

let nextId = 1
const pt = (name, type, x, y) => ({
  id: nextId++, name, type,
  x: Math.round(x), y: Math.round(y),
  width: 0, height: 0, point: true,
  rotation: 0, visible: true,
})

const objects = [
  pt('spawn_player',    'spawn',    OW_W * 0.5,  OW_H * 0.5),
  pt('portal_stash',   'portal',   OW_W * 0.5 - 52, OW_H * 0.5),
  pt('portal_dungeon', 'portal',   OW_W - 140,  OW_H * 0.5 - 200),
  pt('building_health','building', OW_W * 0.18, OW_H * 0.18),
  pt('building_market','building', OW_W * 0.82, OW_H * 0.18),
  pt('building_repair','building', OW_W * 0.18, OW_H * 0.82),
  pt('building_hack',  'building', OW_W * 0.82, OW_H * 0.82),
  pt('terminal_1',     'terminal', OW_W * 0.22, OW_H * 0.28),
  pt('terminal_2',     'terminal', OW_W * 0.78, OW_H * 0.32),
  pt('terminal_3',     'terminal', OW_W * 0.35, OW_H * 0.72),
]

// ── Mapa Tiled ────────────────────────────────────────────────────────────
const map = {
  compressionlevel: -1,
  height: ROWS,
  infinite: false,
  layers: [
    {
      data: ground,
      height: ROWS,
      id: 1,
      name: 'Ground',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: COLS,
      x: 0, y: 0,
    },
    {
      data: walls,
      height: ROWS,
      id: 2,
      name: 'Walls',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: COLS,
      x: 0, y: 0,
    },
    {
      draworder: 'topdown',
      id: 3,
      name: 'Objects',
      objects,
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0, y: 0,
    },
  ],
  nextlayerid: 4,
  nextobjectid: nextId,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.10.2',
  tileheight: S,
  tilewidth: S,
  tilesets: [
    {
      columns: 8,
      firstgid: 1,
      image: '../tilesets/cyberpunk.png',
      imageheight: S,
      imagewidth: S * 8,
      margin: 0,
      name: 'cyberpunk',
      spacing: 0,
      tilecount: 8,
      tileheight: S,
      tilewidth: S,
    },
  ],
  type: 'map',
  version: '1.10',
  width: COLS,
}

const outDir = join(__dirname, '..', 'public', 'assets', 'maps')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'overworld.json'), JSON.stringify(map, null, 2))
console.log(`✓ overworld.json  (${COLS}×${ROWS} tiles = ${OW_W}×${OW_H}px)`)
console.log(`  ${objects.length} objetos: portales, edificios, terminales, spawn`)
