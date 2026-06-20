import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Pickup } from '../entities/Pickup'
import { InputManager } from '../systems/InputManager'
import { Projectile } from '../combat/Projectile'
import { GameState, STAT_POINTS_PER_LEVEL } from '../systems/GameState'
import { ENEMIES } from '../data/enemies'
import { WEAPONS, LOOTABLE_WEAPONS } from '../data/weapons'
import { ELEMENT_COLORS, ELEMENT_NAMES } from '../data/elements'
import { makeItem } from '../items/types'
import { BIOMES, BIOME_KEYS } from '../data/biomes'
import { generateDungeon } from '../dungeon/DungeonGenerator'
import type { BiomeDef } from '../data/biomes'
import { DIRS, keyOf } from '../dungeon/types'
import { addLabel, COLORS, CSS } from '../ui/theme'
import type { Dir, Dungeon, RoomData } from '../dungeon/types'
import type { CombatContext, EnemyContext } from '../combat/types'
import type { ElementType } from '../data/elements'

const DROP_CHANCE = 0.3

const W = 320
const H = 180
const WALL = 14
const DOOR_GAP = 40
const TRANSITION_LOCK_MS = 350

// Overworld (mapa abierto contiguo)
const OW_W = 640
const OW_H = 400

type Mode = 'overworld' | 'run'
type PortalKind = 'dungeon' | 'overworld' | 'stash'

export class GameScene extends Phaser.Scene implements CombatContext, EnemyContext {
  private mode: Mode = 'overworld'
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
  private wallColor: number = COLORS.wallOverworld
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
    this.mode = data?.mode ?? 'overworld'
    this.dead = false
  }

  create() {
    this.createPlaceholderTextures()

    // Dimensiones del mundo según el modo
    const worldW = this.mode === 'overworld' ? OW_W : W
    const worldH = this.mode === 'overworld' ? OW_H : H

    // Bioma de la incursión (colores + pool de enemigos)
    let floorColor: number = COLORS.floorOverworld // overworld
    if (this.mode === 'run') {
      this.biome = BIOMES[Phaser.Utils.Array.GetRandom(BIOME_KEYS)]
      floorColor = this.biome.floorColor
      this.wallColor = this.biome.wallColor
    }
    this.add.rectangle(worldW / 2, worldH / 2, worldW, worldH, floorColor).setDepth(-10)
    this.physics.world.setBounds(0, 0, worldW, worldH)

    this.projectiles = this.physics.add.group({ classType: Projectile, maxSize: 32, runChildUpdate: true })
    this.enemyProjectiles = this.physics.add.group({ classType: Projectile, maxSize: 48, runChildUpdate: true })
    this.enemies = this.physics.add.group()
    this.pickups = this.physics.add.group()
    this.walls = this.physics.add.staticGroup()
    this.doorBlocks = this.physics.add.staticGroup()

    this.inputManager = new InputManager(this)
    this.player = new Player(this, W / 2, H / 2, this.inputManager, this)

    // Cargar equipo y progresión desde el estado global
    this.player.equip(GameState.equipped)
    this.player.applyProgression(GameState.level, GameState.xp)

    this.events.off('levelup')
    this.events.on('levelup', () => {
      GameState.level = this.player.progression.level
      GameState.xp = this.player.progression.xp
      GameState.addStatPoints(STAT_POINTS_PER_LEVEL)
    })

    this.events.off('statschanged')
    this.events.on('statschanged', () => {
      this.player.rebuildStats()
    })

    // Al romperse el arma: el equipo pasó a puños; persistir y avisar
    this.events.off('weaponbroke')
    this.events.on('weaponbroke', (name: string) => {
      GameState.equipped = this.player.equippedItem
      GameState.persist()
      this.events.emit('toast', `${name} se rompió`)
    })

    this.physics.add.collider(this.player, this.walls)
    this.physics.add.collider(this.player, this.doorBlocks)
    this.physics.add.collider(this.enemies, this.walls)
    this.physics.add.collider(this.enemies, this.doorBlocks)
    this.physics.add.collider(this.enemies, this.enemies)
    this.physics.add.overlap(this.projectiles, this.enemies, this.onPlayerProjectileHit, undefined, this)
    this.physics.add.overlap(this.enemyProjectiles, this.player, this.onEnemyProjectileHit, undefined, this)
    // Collider (no overlap): los enemigos se frenan contra el jugador y atacan por contacto
    this.physics.add.collider(this.player, this.enemies, this.onEnemyContact, undefined, this)
    this.physics.add.overlap(this.player, this.pickups, this.onPickup, undefined, this)
    this.physics.add.overlap(this.projectiles, this.walls, p => (p as Projectile).kill())
    this.physics.add.overlap(this.enemyProjectiles, this.walls, p => (p as Projectile).kill())

    this.cameras.main.setBounds(0, 0, worldW, worldH)

    if (this.mode === 'overworld') {
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12)
      this.buildOverworld()
    } else {
      this.dungeon = generateDungeon(9)
      this.buildRoom(this.dungeon.start)
    }

    this.transitionLockUntil = this.time.now + TRANSITION_LOCK_MS
    const info =
      this.mode === 'run'
        ? `${this.biome?.name ?? ''} · Prof ${GameState.depth}`
        : `Mundo · Prof ${GameState.depth}`
    this.scene.launch('UIScene', { player: this.player, mode: this.mode, info })
  }

  // --- OVERWORLD (mundo abierto) ---

  private buildOverworld(): void {
    this.buildBorderWalls(OW_W, OW_H)

    // Base: zona segura en el centro del mundo. Spawneás acá.
    const bx = OW_W / 2
    const by = OW_H / 2
    this.player.setPosition(bx, by)
    this.add.rectangle(bx, by, 72, 72, 0x12203a, 0.6).setStrokeStyle(1, COLORS.neonCyan).setDepth(-9)
    addLabel(this, bx, by - 46, 'BASE', 8, CSS.cyan).setOrigin(0.5)

    // Stash (depositar la bag) dentro de la base
    this.addPortal('stash', bx - 26, by, COLORS.neonCyan, 'STASH')

    // Entrada al dungeon (a la derecha del mundo)
    this.addPortal('dungeon', OW_W - 70, by - 60, COLORS.neonMagenta, 'DUNGEON')

    // Landmarks (rocas) para que el mundo tenga referencias y haya que conocerlo
    const rocks: Array<[number, number, number, number]> = [
      [120, 90, 40, 40],
      [OW_W - 140, OW_H - 90, 50, 30],
      [160, OW_H - 110, 30, 60],
      [OW_W - 110, 130, 36, 36],
    ]
    for (const [x, y, w, h] of rocks) this.addWall(x, y, w, h)

    // Feedback del resultado de la incursión anterior
    if (GameState.lastOutcome === 'retreat') {
      this.showCenterText('Volviste a la base — loot a salvo, +vida', 0x2ecc71)
    } else if (GameState.lastOutcome === 'death') {
      this.showCenterText('Caíste — loot perdido (nivel a salvo)', 0xe74c3c)
    }
    GameState.lastOutcome = null
  }

  private showCenterText(text: string, color: number): void {
    const t = addLabel(this, W / 2, H / 2 - 36, text, 8, `#${color.toString(16).padStart(6, '0')}`)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3000)
    this.tweens.add({ targets: t, y: t.y - 14, alpha: 0, duration: 1800, ease: 'Cubic.Out', onComplete: () => t.destroy() })
  }

  private addPortal(kind: PortalKind, x: number, y: number, color: number, label: string): void {
    this.add.rectangle(x, y, 22, 22, color, 0.25).setStrokeStyle(1, color)
    if (label) addLabel(this, x, y + 16, label, 7, `#${color.toString(16).padStart(6, '0')}`).setOrigin(0.5, 0)
    this.portalZones.push({ kind, rect: new Phaser.Geom.Rectangle(x - 11, y - 11, 22, 22) })
  }

  private buildBorderWalls(w: number, h: number): void {
    this.addWall(w / 2, WALL / 2, w, WALL)
    this.addWall(w / 2, h - WALL / 2, w, WALL)
    this.addWall(WALL / 2, h / 2, WALL, h)
    this.addWall(w - WALL / 2, h / 2, WALL, h)
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
    // Salida al overworld: en la sala inicial (la entrada del dungeon)
    if (this.dungeon && room === this.dungeon.start) {
      this.addPortal('overworld', W / 2, H - 34, 0x8b5a2b, '')
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
    const bg = this.add.rectangle(x, y, barW, 5, COLORS.hpDim).setOrigin(0, 0).setScrollFactor(0).setDepth(2000)
    this.bossBar = this.add.rectangle(x, y, barW, 5, COLORS.neonMagenta).setOrigin(0, 0).setScrollFactor(0).setDepth(2001)
    const label = addLabel(this, W / 2, y - 8, name, 7, CSS.magenta)
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
    const bx = boss.x
    const by = boss.y
    // Drop garantizado de arma
    const key = Phaser.Utils.Array.GetRandom(LOOTABLE_WEAPONS)
    this.pickups.add(new Pickup(this, bx, by, 'weapon', key, WEAPONS[key].color))
    // Ammo: 15 de cada elemento
    const elements: ElementType[] = ['fire', 'electro', 'plasma']
    elements.forEach((el, i) => {
      this.pickups.add(new Pickup(this, bx + (i - 1) * 12, by + 14, 'ammo', el, ELEMENT_COLORS[el], 15))
    })
    // Coins: 15-25
    const coins = Phaser.Math.Between(15, 25)
    this.pickups.add(new Pickup(this, bx, by - 12, 'coin', 'coin', 0xffd700, coins))
    GameState.depth++
    GameState.persist()
    this.events.emit('boss', GameState.depth)
  }

  private maybeDropLoot(x: number, y: number): void {
    // Weapon (30%)
    if (Math.random() < DROP_CHANCE) {
      const key = Phaser.Utils.Array.GetRandom(LOOTABLE_WEAPONS)
      this.pickups.add(new Pickup(this, x, y, 'weapon', key, WEAPONS[key].color))
    }
    // Ammo (60%): random element, 4-10 units
    if (Math.random() < 0.6) {
      const elements: ElementType[] = ['fire', 'electro', 'plasma']
      const el = Phaser.Utils.Array.GetRandom(elements)
      const qty = Phaser.Math.Between(4, 10)
      this.pickups.add(new Pickup(this, x + Phaser.Math.Between(-8, 8), y + Phaser.Math.Between(-8, 8), 'ammo', el, ELEMENT_COLORS[el], qty))
    }
    // Coins (70%): 1-3
    if (Math.random() < 0.7) {
      const qty = Phaser.Math.Between(1, 3)
      this.pickups.add(new Pickup(this, x + Phaser.Math.Between(-6, 6), y + 8, 'coin', 'coin', 0xffd700, qty))
    }
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

  // --- Transiciones de escena (overworld ↔ run) ---

  private enterDungeon(): void {
    // El equipo persiste; la bag arranca como esté (lo no depositado se lleva)
    this.switchScene('run')
  }

  private exitToOverworld(): void {
    this.syncProgression()
    GameState.lastOutcome = 'retreat'
    this.switchScene('overworld')
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

  private stashCooldownUntil = 0

  private depositStash(): void {
    if (this.time.now < this.stashCooldownUntil) return
    this.stashCooldownUntil = this.time.now + 800
    const n = GameState.depositBag()
    if (n > 0) this.events.emit('stashed', n)
  }

  // --- Texturas placeholder ---

  private createPlaceholderTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff)
    g.fillRect(0, 0, 1, 1)
    g.generateTexture('px', 1, 1)
    g.clear()
    g.fillStyle(COLORS.player)
    g.fillRect(0, 0, 16, 16)
    g.generateTexture('player', 16, 16)
    g.clear()
    g.fillStyle(COLORS.projectile)
    g.fillCircle(3, 3, 3)
    g.generateTexture('projectile', 6, 6)
    g.clear()
    g.fillStyle(COLORS.enemyProjectile)
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
    // Ammo pickup: small circle (tinted by element at spawn time)
    g.clear()
    g.fillStyle(0xffffff)
    g.fillCircle(3, 3, 3)
    g.generateTexture('ammo_pickup', 6, 6)
    // Coin pickup: small square
    g.clear()
    g.fillStyle(0xffd700)
    g.fillRect(1, 1, 5, 5)
    g.generateTexture('coin_pickup', 6, 6)
    for (const def of Object.values(ENEMIES)) {
      g.clear()
      g.fillStyle(def.color)
      g.fillRect(0, 0, def.size, def.size)
      g.generateTexture(`enemy_${def.key}`, def.size, def.size)
    }
    g.destroy()
  }

  // --- CombatContext / EnemyContext ---

  consumeAmmo(element: ElementType): boolean {
    if (GameState.consumeAmmo(element)) return true
    this.events.emit('toast', `Sin munición [${ELEMENT_NAMES[element]}]`)
    return false
  }

  spawnPlayerProjectile(x: number, y: number, dir: Phaser.Math.Vector2, damage: number, element?: ElementType): void {
    const proj = this.projectiles.get() as Projectile | null
    if (proj) proj.fire(x, y, dir, damage, 'projectile', element)
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
    e.takeDamage(p.damage, new Phaser.Math.Vector2(p.x, p.y), p.element)
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
    if (!pick.active) return

    if (pick.kind === 'weapon') {
      if (GameState.addToBag(makeItem(pick.itemKey))) {
        this.events.emit('toast', `${WEAPONS[pick.itemKey].name} → bag`)
        pick.destroy()
      } else {
        this.events.emit('toast', 'Bag llena')
      }
    } else if (pick.kind === 'ammo') {
      const el = pick.itemKey as ElementType
      GameState.addAmmo(el, pick.amount)
      this.events.emit('toast', `+${pick.amount} ${ELEMENT_NAMES[el]}`)
      pick.destroy()
    } else if (pick.kind === 'coin') {
      GameState.addCoins(pick.amount)
      this.events.emit('toast', `+${pick.amount} ◈`)
      pick.destroy()
    }
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
    addLabel(this, W / 2, H / 2 - 40, 'MORISTE', 16, CSS.red).setOrigin(0.5).setScrollFactor(0).setDepth(3000)
    this.time.delayedCall(1400, () => {
      GameState.clearBag() // se pierde la bag; el equipo persiste
      GameState.lastOutcome = 'death'
      this.switchScene('overworld')
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
      if (z.kind === 'dungeon') return this.enterDungeon()
      if (z.kind === 'overworld') return this.exitToOverworld()
      if (z.kind === 'stash') this.depositStash()
    }
  }
}
