import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Pickup } from '../entities/Pickup'
import { InputManager } from '../systems/InputManager'
import { Projectile } from '../combat/Projectile'
import { GameState } from '../systems/GameState'
import { ENEMIES } from '../data/enemies'
import { WEAPONS, STARTING_WEAPON } from '../data/weapons'
import { BIOMES, BIOME_KEYS } from '../data/biomes'
import { generateDungeon } from '../dungeon/DungeonGenerator'
import type { BiomeDef } from '../data/biomes'
import { DIRS, keyOf } from '../dungeon/types'
import type { Dir, Dungeon, RoomData } from '../dungeon/types'
import type { CombatContext, EnemyContext } from '../combat/types'

const DROP_CHANCE = 0.3

const W = 320
const H = 180
const WALL = 14
const DOOR_GAP = 40
const TRANSITION_LOCK_MS = 350

type Mode = 'base' | 'run'
type PortalKind = 'run' | 'base' | 'stash'

export class GameScene extends Phaser.Scene implements CombatContext, EnemyContext {
  private mode: Mode = 'base'
  private player!: Player
  private inputManager!: InputManager
  private projectiles!: Phaser.Physics.Arcade.Group
  private enemyProjectiles!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group
  private pickups!: Phaser.Physics.Arcade.Group
  private walls!: Phaser.Physics.Arcade.StaticGroup
  private doorBlocks!: Phaser.Physics.Arcade.StaticGroup

  private dungeon?: Dungeon
  private current?: RoomData
  private biome?: BiomeDef
  private wallColor = 0x4a3728
  private boss?: Enemy
  private bossBar?: Phaser.GameObjects.Rectangle
  private bossBarBg?: Phaser.GameObjects.Container
  private doorZones: Array<{ dir: Dir; rect: Phaser.Geom.Rectangle }> = []
  private portalZones: Array<{ kind: PortalKind; rect: Phaser.Geom.Rectangle }> = []
  private transitionLockUntil = 0
  private dead = false

  constructor() {
    super({ key: 'GameScene' })
  }

  init(data: { mode?: Mode }) {
    this.mode = data?.mode ?? 'base'
    this.dead = false
  }

  create() {
    this.createPlaceholderTextures()

    // Bioma de la incursión (colores + pool de enemigos)
    let floorColor = 0x2c3e50 // base
    if (this.mode === 'run') {
      this.biome = BIOMES[Phaser.Utils.Array.GetRandom(BIOME_KEYS)]
      floorColor = this.biome.floorColor
      this.wallColor = this.biome.wallColor
    }
    this.add.rectangle(W / 2, H / 2, W, H, floorColor).setDepth(-10)

    this.projectiles = this.physics.add.group({ classType: Projectile, maxSize: 32, runChildUpdate: true })
    this.enemyProjectiles = this.physics.add.group({ classType: Projectile, maxSize: 48, runChildUpdate: true })
    this.enemies = this.physics.add.group()
    this.pickups = this.physics.add.group()
    this.walls = this.physics.add.staticGroup()
    this.doorBlocks = this.physics.add.staticGroup()

    this.inputManager = new InputManager(this)
    this.player = new Player(this, W / 2, H / 2, this.inputManager, this)

    // Cargar equipo y progresión desde el estado global
    this.player.equipWeapon(WEAPONS[GameState.carriedWeapon])
    this.player.applyProgression(GameState.level, GameState.xp)

    // Persistir al subir de nivel (off primero: la escena reusa el emitter al reiniciar)
    this.events.off('levelup')
    this.events.on('levelup', () => {
      GameState.level = this.player.progression.level
      GameState.xp = this.player.progression.xp
      GameState.persist()
    })

    this.physics.add.collider(this.player, this.walls)
    this.physics.add.collider(this.player, this.doorBlocks)
    this.physics.add.collider(this.enemies, this.walls)
    this.physics.add.collider(this.enemies, this.doorBlocks)
    this.physics.add.collider(this.enemies, this.enemies)
    this.physics.add.overlap(this.projectiles, this.enemies, this.onPlayerProjectileHit, undefined, this)
    this.physics.add.overlap(this.enemyProjectiles, this.player, this.onEnemyProjectileHit, undefined, this)
    this.physics.add.overlap(this.player, this.enemies, this.onEnemyContact, undefined, this)
    this.physics.add.overlap(this.player, this.pickups, this.onPickup, undefined, this)
    this.physics.add.overlap(this.projectiles, this.walls, p => (p as Projectile).kill())
    this.physics.add.overlap(this.enemyProjectiles, this.walls, p => (p as Projectile).kill())

    this.cameras.main.setBounds(0, 0, W, H)

    if (this.mode === 'base') {
      this.buildBase()
    } else {
      this.dungeon = generateDungeon(9)
      this.buildRoom(this.dungeon.start)
    }

    this.transitionLockUntil = this.time.now + TRANSITION_LOCK_MS
    const info =
      this.mode === 'run'
        ? `${this.biome?.name ?? ''} · Prof ${GameState.depth}`
        : `Base · Prof ${GameState.depth}`
    this.scene.launch('UIScene', { player: this.player, mode: this.mode, info })
  }

  // --- BASE ---

  private buildBase(): void {
    this.buildBorderWalls()
    this.player.setPosition(W / 2, H / 2)

    // Zona de incursión (derecha) y stash (izquierda)
    this.addPortal('run', W - 60, H / 2, 0x27ae60, 'INCURSIÓN')
    this.addPortal('stash', 60, H / 2, 0x3498db, `STASH (${GameState.stash.length})`)

    this.add.text(W / 2, 6, 'BASE', { fontSize: '8px', color: '#bdc3c7' }).setOrigin(0.5, 0)

    // Feedback del resultado de la incursión anterior
    if (GameState.lastOutcome === 'retreat') {
      this.showCenterText('Retirada — loot a salvo, +vida', 0x2ecc71)
    } else if (GameState.lastOutcome === 'death') {
      this.showCenterText('Caíste — loot perdido (nivel a salvo)', 0xe74c3c)
    }
    GameState.lastOutcome = null
  }

  private showCenterText(text: string, color: number): void {
    const t = this.add
      .text(W / 2, H / 2 - 36, text, { fontSize: '8px', color: `#${color.toString(16)}` })
      .setOrigin(0.5)
      .setDepth(3000)
    this.tweens.add({ targets: t, y: t.y - 14, alpha: 0, duration: 1800, ease: 'Cubic.Out', onComplete: () => t.destroy() })
  }

  private addPortal(kind: PortalKind, x: number, y: number, color: number, label: string): void {
    this.add.rectangle(x, y, 22, 22, color, 0.4).setStrokeStyle(1, color)
    if (label) this.add.text(x, y + 16, label, { fontSize: '6px', color: '#ffffff' }).setOrigin(0.5, 0)
    this.portalZones.push({ kind, rect: new Phaser.Geom.Rectangle(x - 11, y - 11, 22, 22) })
  }

  private buildBorderWalls(): void {
    this.addWall(W / 2, WALL / 2, W, WALL)
    this.addWall(W / 2, H - WALL / 2, W, WALL)
    this.addWall(WALL / 2, H / 2, WALL, H)
    this.addWall(W - WALL / 2, H / 2, WALL, H)
  }

  // --- RUN: construcción de salas ---

  private buildRoom(room: RoomData): void {
    this.clearRoom()
    this.current = room
    this.buildWalls(room)
    this.buildDoors(room)
    if (!room.cleared) {
      if (room.type === 'boss') this.spawnBoss()
      else this.spawnRoomEnemies()
    }
    // Salida a la base: solo en la sala inicial (donde entraste). Sin cartel:
    // el jugador debe conocer/recordar el mapa para volver a su base.
    if (this.dungeon && room === this.dungeon.start) {
      this.addPortal('base', W / 2, 44, 0xe67e22, '')
    }
  }

  private clearRoom(): void {
    this.walls.clear(true, true)
    this.doorBlocks.clear(true, true)
    this.enemies.clear(true, true)
    this.pickups.clear(true, true)
    this.doorZones = []
    this.portalZones = []
    this.clearBossBar()
    this.projectiles.getChildren().forEach(p => (p as Projectile).kill())
    this.enemyProjectiles.getChildren().forEach(p => (p as Projectile).kill())
  }

  private addWall(cx: number, cy: number, w: number, h: number): void {
    const wall = this.walls.create(cx, cy, 'px') as Phaser.Physics.Arcade.Sprite
    wall.setDisplaySize(w, h).setTint(this.wallColor).refreshBody()
  }

  private buildWalls(room: RoomData): void {
    const seg = (full: number) => (full - DOOR_GAP) / 2
    for (const [dir, cy] of [['n', WALL / 2], ['s', H - WALL / 2]] as const) {
      if (room.doors[dir]) {
        const s = seg(W)
        this.addWall(s / 2, cy, s, WALL)
        this.addWall(W - s / 2, cy, s, WALL)
      } else {
        this.addWall(W / 2, cy, W, WALL)
      }
    }
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
        this.doorZones.push({ dir, rect: new Phaser.Geom.Rectangle(c.x - w / 2, c.y - h / 2, w, h) })
      } else {
        const block = this.doorBlocks.create(c.x, c.y, 'px') as Phaser.Physics.Arcade.Sprite
        block.setDisplaySize(w, h).setTint(0x8b0000).refreshBody()
      }
    }
  }

  /** Escala según nivel del jugador + profundidad (bosses derrotados). */
  private difficultyScale(): number {
    return 1 + 0.15 * (this.player.level - 1) + 0.25 * GameState.depth
  }

  private spawnRoomEnemies(): void {
    const pool = this.biome?.enemies ?? Object.keys(ENEMIES)
    const count = Phaser.Math.Between(2, 4)
    const scale = this.difficultyScale()
    for (let i = 0; i < count; i++) {
      const key = Phaser.Utils.Array.GetRandom(pool)
      const x = Phaser.Math.Between(WALL + 20, W - WALL - 20)
      const y = Phaser.Math.Between(WALL + 20, H - WALL - 20)
      const enemy = new Enemy(this, x, y, ENEMIES[key], this, scale)
      enemy.onDeath = e => {
        this.player.gainXp(e.xpReward)
        this.maybeDropLoot(e.x, e.y)
      }
      this.enemies.add(enemy)
    }
  }

  private spawnBoss(): void {
    const bossKey = this.biome?.boss ?? 'golem'
    const boss = new Enemy(this, W / 2, H / 2, ENEMIES[bossKey], this, this.difficultyScale())
    boss.onDeath = e => this.onBossDefeated(e)
    this.enemies.add(boss)
    this.boss = boss
    this.createBossBar(ENEMIES[bossKey].name)
  }

  private createBossBar(name: string): void {
    const barW = W - 80
    const x = 40
    const y = H - 26
    const bg = this.add.rectangle(x, y, barW, 5, 0x4a0000).setOrigin(0, 0).setScrollFactor(0).setDepth(2000)
    this.bossBar = this.add.rectangle(x, y, barW, 5, 0xe74c3c).setOrigin(0, 0).setScrollFactor(0).setDepth(2001)
    const label = this.add
      .text(W / 2, y - 8, name, { fontSize: '7px', color: '#e74c3c' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2001)
    this.bossBarBg = this.add.container(0, 0, [bg, label]).setDepth(2000)
  }

  private clearBossBar(): void {
    this.boss = undefined
    this.bossBar?.destroy()
    this.bossBarBg?.destroy()
    this.bossBar = undefined
    this.bossBarBg = undefined
  }

  private onBossDefeated(boss: Enemy): void {
    this.player.gainXp(boss.xpReward)
    // Drop garantizado de arma
    const key = Phaser.Utils.Array.GetRandom(Object.keys(WEAPONS))
    this.pickups.add(new Pickup(this, boss.x, boss.y, 'weapon', key, WEAPONS[key].color))
    // Sube la profundidad (dificultad + recompensa futura)
    GameState.depth++
    GameState.persist()
    this.events.emit('boss', GameState.depth)
  }

  private maybeDropLoot(x: number, y: number): void {
    if (Math.random() > DROP_CHANCE) return
    const key = Phaser.Utils.Array.GetRandom(Object.keys(WEAPONS))
    this.pickups.add(new Pickup(this, x, y, 'weapon', key, WEAPONS[key].color))
  }

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

  // --- Transiciones de escena (base ↔ run) ---

  private goToRun(): void {
    GameState.resetLoadout() // siempre loadout básico al salir
    this.switchScene('run')
  }

  private goToBase(): void {
    this.syncProgression()
    GameState.lastOutcome = 'retreat'
    this.switchScene('base')
  }

  private syncProgression(): void {
    GameState.level = this.player.progression.level
    GameState.xp = this.player.progression.xp
    GameState.persist()
  }

  private switchScene(mode: Mode): void {
    this.scene.stop('UIScene')
    this.scene.start('GameScene', { mode })
  }

  private depositStash(): void {
    if (GameState.carriedWeapon === STARTING_WEAPON) return
    if (GameState.addToStash({ kind: 'weapon', key: GameState.carriedWeapon })) {
      this.events.emit('stashed', GameState.stash.length)
    }
  }

  // --- Texturas placeholder ---

  private createPlaceholderTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff)
    g.fillRect(0, 0, 1, 1)
    g.generateTexture('px', 1, 1)
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
    g.clear()
    g.fillStyle(0xffffff)
    g.fillPoints([
      new Phaser.Math.Vector2(4, 0),
      new Phaser.Math.Vector2(8, 4),
      new Phaser.Math.Vector2(4, 8),
      new Phaser.Math.Vector2(0, 4),
    ], true)
    g.generateTexture('pickup', 8, 8)
    for (const def of Object.values(ENEMIES)) {
      g.clear()
      g.fillStyle(def.color)
      g.fillRect(0, 0, def.size, def.size)
      g.generateTexture(`enemy_${def.key}`, def.size, def.size)
    }
    g.destroy()
  }

  // --- CombatContext / EnemyContext ---

  spawnPlayerProjectile(x: number, y: number, dir: Phaser.Math.Vector2, damage: number): void {
    const proj = this.projectiles.get() as Projectile | null
    if (proj) proj.fire(x, y, dir, damage, 'projectile')
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

  spawnEnemyProjectile(x: number, y: number, dir: Phaser.Math.Vector2, damage: number): void {
    const proj = this.enemyProjectiles.get() as Projectile | null
    if (proj) proj.fire(x, y, dir, damage, 'enemy_projectile')
  }

  // --- Handlers ---

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

  private onPickup: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, obj) => {
    const pick = obj as Pickup
    if (!pick.active || pick.kind !== 'weapon') return
    this.player.equipWeapon(WEAPONS[pick.itemKey])
    GameState.carriedWeapon = pick.itemKey
    pick.destroy()
  }

  // --- Loop ---

  update(time: number, delta: number) {
    this.player.update(time, delta)

    if (this.mode === 'run') {
      this.enemies.getChildren().forEach(child => (child as Enemy).update(this.player, time, delta))
      this.updateBossBar()
      this.updateRoomCleared()
      this.checkDoorTransitions(time)
      this.checkDeath()
    }

    this.checkPortals()
  }

  private updateBossBar(): void {
    if (!this.boss || !this.bossBar) return
    if (this.boss.isDead) {
      this.clearBossBar()
      return
    }
    this.bossBar.width = (W - 80) * this.boss.health.ratio
  }

  private updateRoomCleared(): void {
    if (!this.current || this.current.cleared) return
    const alive = this.enemies.getChildren().some(e => !(e as Enemy).isDead)
    if (!alive) {
      this.current.cleared = true
      this.doorBlocks.clear(true, true)
      this.buildDoors(this.current)
    }
  }

  private checkDeath(): void {
    if (this.dead || !this.player.isDead) return
    this.dead = true
    this.syncProgression() // el nivel persiste; el loot se pierde
    this.add
      .text(W / 2, H / 2 - 40, 'MORISTE', { fontSize: '16px', color: '#e74c3c' })
      .setOrigin(0.5)
      .setDepth(3000)
    this.time.delayedCall(1400, () => {
      GameState.resetLoadout()
      GameState.lastOutcome = 'death'
      this.switchScene('base')
    })
  }

  private checkDoorTransitions(time: number): void {
    if (time < this.transitionLockUntil || !this.current || !this.dungeon) return
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

  private checkPortals(): void {
    if (this.time.now < this.transitionLockUntil) return
    const pb = this.player.getBounds()
    for (const z of this.portalZones) {
      if (!Phaser.Geom.Intersects.RectangleToRectangle(pb, z.rect)) continue
      if (z.kind === 'run') return this.goToRun()
      if (z.kind === 'base') return this.goToBase()
      if (z.kind === 'stash') this.depositStash()
    }
  }
}
