import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { InputManager } from '../systems/InputManager'
import { Projectile } from '../combat/Projectile'
import { ENEMIES } from '../data/enemies'
import type { CombatContext, EnemyContext } from '../combat/types'

export class GameScene extends Phaser.Scene implements CombatContext, EnemyContext {
  private player!: Player
  private inputManager!: InputManager
  private projectiles!: Phaser.Physics.Arcade.Group
  private enemyProjectiles!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale
    this.createPlaceholderTextures()

    // Placeholder floor until tilemaps arrive
    this.add.rectangle(width / 2, height / 2, width, height, 0x2d5a27)

    // Placeholder walls
    this.add.rectangle(width / 2, 8, width, 16, 0x4a3728)
    this.add.rectangle(width / 2, height - 8, width, 16, 0x4a3728)
    this.add.rectangle(8, height / 2, 16, height, 0x4a3728)
    this.add.rectangle(width - 8, height / 2, 16, height, 0x4a3728)

    this.projectiles = this.physics.add.group({
      classType: Projectile,
      maxSize: 32,
      runChildUpdate: true,
    })
    this.enemyProjectiles = this.physics.add.group({
      classType: Projectile,
      maxSize: 48,
      runChildUpdate: true,
    })

    this.enemies = this.physics.add.group()

    this.inputManager = new InputManager(this)
    this.player = new Player(this, width / 2, height / 2, this.inputManager, this)

    this.spawnEnemies()

    // Colisiones / overlaps de combate
    this.physics.add.collider(this.enemies, this.enemies)
    this.physics.add.overlap(this.projectiles, this.enemies, this.onPlayerProjectileHit, undefined, this)
    this.physics.add.overlap(this.enemyProjectiles, this.player, this.onEnemyProjectileHit, undefined, this)
    this.physics.add.overlap(this.player, this.enemies, this.onEnemyContact, undefined, this)

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
    this.cameras.main.setBounds(0, 0, width, height)

    this.scene.launch('UIScene', { player: this.player })
  }

  private spawnEnemies(): void {
    const { width, height } = this.scale
    // Spawn inicial de prueba (la generación procedural llega en v0.5.0)
    const spawns: Array<[string, number, number]> = [
      ['slime', width / 2 + 70, height / 2 - 40],
      ['bat', width / 2 - 80, height / 2 + 30],
      ['mage', width / 2 + 60, height / 2 + 50],
    ]
    for (const [key, x, y] of spawns) {
      this.enemies.add(new Enemy(this, x, y, ENEMIES[key], this))
    }
  }

  private createPlaceholderTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 })
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
    // Una textura por tipo de enemigo, según su color/tamaño
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

  update(time: number, delta: number) {
    this.player.update(time, delta)
    this.enemies.getChildren().forEach(child => (child as Enemy).update(this.player, time, delta))
  }
}
