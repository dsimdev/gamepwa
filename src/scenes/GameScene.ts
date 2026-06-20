import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { InputManager } from '../systems/InputManager'
import { Projectile } from '../combat/Projectile'
import { ENEMIES } from '../data/enemies'
import { generateDungeon } from '../dungeon/DungeonGenerator'
import { DIRS, keyOf } from '../dungeon/types'
import type { Dir, Dungeon, RoomData } from '../dungeon/types'
import type { CombatContext, EnemyContext } from '../combat/types'

const W = 320
const H = 180
const WALL = 14
const DOOR_GAP = 40
const TRANSITION_LOCK_MS = 350

export class GameScene extends Phaser.Scene implements CombatContext, EnemyContext {
  private player!: Player
  private inputManager!: InputManager
  private projectiles!: Phaser.Physics.Arcade.Group
  private enemyProjectiles!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group
  private walls!: Phaser.Physics.Arcade.StaticGroup
  private doorBlocks!: Phaser.Physics.Arcade.StaticGroup

  private dungeon!: Dungeon
  private current!: RoomData
  private doorZones: Array<{ dir: Dir; rect: Phaser.Geom.Rectangle }> = []
  private transitionLockUntil = 0

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    this.createPlaceholderTextures()

    // Suelo persistente (las paredes se redibujan por sala)
    this.add.rectangle(W / 2, H / 2, W, H, 0x2d5a27).setDepth(-10)

    this.projectiles = this.physics.add.group({ classType: Projectile, maxSize: 32, runChildUpdate: true })
    this.enemyProjectiles = this.physics.add.group({ classType: Projectile, maxSize: 48, runChildUpdate: true })
    this.enemies = this.physics.add.group()
    this.walls = this.physics.add.staticGroup()
    this.doorBlocks = this.physics.add.staticGroup()

    this.inputManager = new InputManager(this)
    this.player = new Player(this, W / 2, H / 2, this.inputManager, this)

    // Colisiones (referencian grupos persistentes; el contenido cambia por sala)
    this.physics.add.collider(this.player, this.walls)
    this.physics.add.collider(this.player, this.doorBlocks)
    this.physics.add.collider(this.enemies, this.walls)
    this.physics.add.collider(this.enemies, this.doorBlocks)
    this.physics.add.collider(this.enemies, this.enemies)
    this.physics.add.overlap(this.projectiles, this.enemies, this.onPlayerProjectileHit, undefined, this)
    this.physics.add.overlap(this.enemyProjectiles, this.player, this.onEnemyProjectileHit, undefined, this)
    this.physics.add.overlap(this.player, this.enemies, this.onEnemyContact, undefined, this)
    this.physics.add.overlap(this.projectiles, this.walls, (p) => (p as Projectile).kill())
    this.physics.add.overlap(this.enemyProjectiles, this.walls, (p) => (p as Projectile).kill())

    this.cameras.main.setBounds(0, 0, W, H)

    // Generar dungeon y entrar a la sala inicial
    this.dungeon = generateDungeon(9)
    this.buildRoom(this.dungeon.start)

    this.scene.launch('UIScene', { player: this.player })
  }

  // --- Construcción de salas ---

  private buildRoom(room: RoomData): void {
    this.clearRoom()
    this.current = room
    this.buildWalls(room)
    this.buildDoors(room)
    if (!room.cleared) this.spawnRoomEnemies()
  }

  private clearRoom(): void {
    this.walls.clear(true, true)
    this.doorBlocks.clear(true, true)
    this.enemies.clear(true, true)
    this.doorZones = []
    // Apagar proyectiles activos al cambiar de sala
    this.projectiles.getChildren().forEach(p => (p as Projectile).kill())
    this.enemyProjectiles.getChildren().forEach(p => (p as Projectile).kill())
  }

  private addWall(cx: number, cy: number, w: number, h: number): void {
    const wall = this.walls.create(cx, cy, 'px') as Phaser.Physics.Arcade.Sprite
    wall.setDisplaySize(w, h).setTint(0x4a3728).refreshBody()
  }

  private buildWalls(room: RoomData): void {
    const seg = (full: number) => (full - DOOR_GAP) / 2 // largo de cada segmento a los lados del hueco

    // Horizontal (arriba/abajo)
    for (const [dir, cy] of [['n', WALL / 2], ['s', H - WALL / 2]] as const) {
      if (room.doors[dir]) {
        const s = seg(W)
        this.addWall(s / 2, cy, s, WALL)
        this.addWall(W - s / 2, cy, s, WALL)
      } else {
        this.addWall(W / 2, cy, W, WALL)
      }
    }
    // Vertical (izquierda/derecha)
    for (const [dir, cx] of [['w', WALL / 2], ['e', W - WALL / 2]] as const) {
      if (room.doors[dir]) {
        const s = seg(H)
        this.addWall(cx, s / 2, WALL, s)
        this.addWall(cx, H - s / 2, WALL, s)
      } else {
        this.addWall(cx, H / 2, WALL, H)
      }
    }
  }

  /** Centro del hueco de cada puerta. */
  private doorCenter(dir: Dir): { x: number; y: number } {
    switch (dir) {
      case 'n': return { x: W / 2, y: WALL / 2 }
      case 's': return { x: W / 2, y: H - WALL / 2 }
      case 'w': return { x: WALL / 2, y: H / 2 }
      case 'e': return { x: W - WALL / 2, y: H / 2 }
    }
  }

  private buildDoors(room: RoomData): void {
    for (const dir of Object.keys(room.doors) as Dir[]) {
      if (!room.doors[dir]) continue
      const c = this.doorCenter(dir)
      const horizontal = dir === 'n' || dir === 's'
      const w = horizontal ? DOOR_GAP : WALL
      const h = horizontal ? WALL : DOOR_GAP

      if (room.cleared) {
        // Puerta abierta: zona de transición (chequeo geométrico en update)
        this.doorZones.push({ dir, rect: new Phaser.Geom.Rectangle(c.x - w / 2, c.y - h / 2, w, h) })
      } else {
        // Puerta bloqueada hasta limpiar la sala
        const block = this.doorBlocks.create(c.x, c.y, 'px') as Phaser.Physics.Arcade.Sprite
        block.setDisplaySize(w, h).setTint(0x8b0000).refreshBody()
      }
    }
  }

  private spawnRoomEnemies(): void {
    const pool = Object.keys(ENEMIES)
    const count = Phaser.Math.Between(2, 4)
    for (let i = 0; i < count; i++) {
      const key = Phaser.Utils.Array.GetRandom(pool)
      const x = Phaser.Math.Between(WALL + 20, W - WALL - 20)
      const y = Phaser.Math.Between(WALL + 20, H - WALL - 20)
      this.enemies.add(new Enemy(this, x, y, ENEMIES[key], this))
    }
  }

  /** Reposiciona al jugador apenas dentro de la puerta por la que entra. */
  private placePlayerAtDoor(entryDir: Dir): void {
    const inset = 26
    const c = this.doorCenter(entryDir)
    const offset: Record<Dir, [number, number]> = {
      n: [0, inset],
      s: [0, -inset],
      w: [inset, 0],
      e: [-inset, 0],
    }
    const [ox, oy] = offset[entryDir]
    this.player.setPosition(c.x + ox, c.y + oy)
    this.player.setVelocity(0, 0)
  }

  // --- Texturas placeholder ---

  private createPlaceholderTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff)
    g.fillRect(0, 0, 1, 1)
    g.generateTexture('px', 1, 1) // bloque blanco escalable (paredes/puertas)
    g.clear()
    g.fillStyle(0x3498db)
    g.fillRect(0, 0, 16, 16)
    g.generateTexture('player', 16, 16)
    g.clear()
    g.fillStyle(0x5dade2)
    g.fillCircle(3, 3, 3)
    g.generateTexture('projectile', 6, 6)
    g.clear()
    g.fillStyle(0xff5555)
    g.fillCircle(3, 3, 3)
    g.generateTexture('enemy_projectile', 6, 6)
    for (const def of Object.values(ENEMIES)) {
      g.clear()
      g.fillStyle(def.color)
      g.fillRect(0, 0, def.size, def.size)
      g.generateTexture(`enemy_${def.key}`, def.size, def.size)
    }
    g.destroy()
  }

  // --- CombatContext (jugador) ---

  spawnPlayerProjectile(x: number, y: number, dir: Phaser.Math.Vector2, damage: number): void {
    const proj = this.projectiles.get() as Projectile | null
    if (!proj) return
    proj.fire(x, y, dir, damage, 'projectile')
  }

  meleePlayerHit(rect: Phaser.Geom.Rectangle, damage: number, from: Phaser.Math.Vector2): void {
    this.enemies.getChildren().forEach(child => {
      const enemy = child as Enemy
      if (enemy.isDead) return
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, enemy.getBounds())) {
        enemy.takeDamage(damage, from)
      }
    })
  }

  // --- EnemyContext (enemigos) ---

  spawnEnemyProjectile(x: number, y: number, dir: Phaser.Math.Vector2, damage: number): void {
    const proj = this.enemyProjectiles.get() as Projectile | null
    if (!proj) return
    proj.fire(x, y, dir, damage, 'enemy_projectile')
  }

  // --- Handlers de overlap ---

  private onPlayerProjectileHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (proj, enemy) => {
    const p = proj as Projectile
    const e = enemy as Enemy
    if (!p.active || e.isDead) return
    e.takeDamage(p.damage, new Phaser.Math.Vector2(p.x, p.y))
    p.kill()
  }

  private onEnemyProjectileHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, proj) => {
    const p = proj as Projectile
    if (!p.active) return
    this.player.takeDamage(p.damage)
    p.kill()
  }

  private onEnemyContact: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, enemy) => {
    const e = enemy as Enemy
    if (e.isDead) return
    this.player.takeDamage(e.contactDamage)
  }

  // --- Loop ---

  update(time: number, delta: number) {
    this.player.update(time, delta)
    this.enemies.getChildren().forEach(child => (child as Enemy).update(this.player, time, delta))

    // Marcar sala limpiada cuando no quedan enemigos vivos
    if (!this.current.cleared) {
      const alive = this.enemies.getChildren().some(e => !(e as Enemy).isDead)
      if (!alive) {
        this.current.cleared = true
        this.doorBlocks.clear(true, true)
        this.buildDoors(this.current) // ahora abre zonas de transición
      }
    }

    this.checkDoorTransitions(time)
  }

  private checkDoorTransitions(time: number): void {
    if (time < this.transitionLockUntil) return
    const pb = this.player.getBounds()
    for (const door of this.doorZones) {
      if (!Phaser.Geom.Intersects.RectangleToRectangle(pb, door.rect)) continue

      const { dx, dy, opposite } = DIRS[door.dir]
      const next = this.dungeon.rooms.get(keyOf(this.current.x + dx, this.current.y + dy))
      if (!next) return

      this.transitionLockUntil = time + TRANSITION_LOCK_MS
      this.buildRoom(next)
      this.placePlayerAtDoor(opposite)
      return
    }
  }
}
