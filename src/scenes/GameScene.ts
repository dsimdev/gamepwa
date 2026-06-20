import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { TrainingDummy } from '../entities/TrainingDummy'
import { InputManager } from '../systems/InputManager'
import { Projectile } from '../combat/Projectile'
import type { CombatContext } from '../combat/types'

export class GameScene extends Phaser.Scene implements CombatContext {
  private player!: Player
  private inputManager!: InputManager
  private projectiles!: Phaser.Physics.Arcade.Group
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

    // Dummies de prueba (temporal, v0.3.0)
    this.enemies = this.physics.add.group()
    this.enemies.add(new TrainingDummy(this, width / 2 + 50, height / 2 - 30))
    this.enemies.add(new TrainingDummy(this, width / 2 - 60, height / 2 + 20))

    this.inputManager = new InputManager(this)
    this.player = new Player(this, width / 2, height / 2, this.inputManager, this)

    // Proyectiles del jugador impactan enemigos
    this.physics.add.overlap(this.projectiles, this.enemies, (proj, enemy) => {
      const p = proj as Projectile
      const e = enemy as TrainingDummy
      if (!p.active || e.isDead) return
      e.takeDamage(p.damage, new Phaser.Math.Vector2(p.x, p.y))
      p.kill()
    })

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
    this.cameras.main.setBounds(0, 0, width, height)

    this.scene.launch('UIScene', { player: this.player })
  }

  private createPlaceholderTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x3498db)
    g.fillRect(0, 0, 16, 16)
    g.generateTexture('player', 16, 16)
    g.clear()
    g.fillStyle(0xc0392b)
    g.fillRect(0, 0, 14, 14)
    g.generateTexture('dummy', 14, 14)
    g.clear()
    g.fillStyle(0x5dade2)
    g.fillCircle(3, 3, 3)
    g.generateTexture('projectile', 6, 6)
    g.destroy()
  }

  // --- CombatContext ---

  spawnPlayerProjectile(x: number, y: number, dir: Phaser.Math.Vector2, damage: number): void {
    const proj = this.projectiles.get() as Projectile | null
    if (!proj) return
    proj.fire(x, y, dir, damage)
  }

  meleePlayerHit(rect: Phaser.Geom.Rectangle, damage: number, from: Phaser.Math.Vector2): void {
    this.enemies.getChildren().forEach(child => {
      const enemy = child as TrainingDummy
      if (enemy.isDead) return
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, enemy.getBounds())) {
        enemy.takeDamage(damage, from)
      }
    })
  }

  update(time: number, delta: number) {
    this.player.update(time, delta)
  }
}
