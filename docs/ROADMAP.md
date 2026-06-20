# Roadmap — gamepwa

Versionado semántico `x.y.z`. Cada hito = una rama `feat/*` que se integra a `dev`. `main` solo recibe releases estables.

| Versión | Hito | Entregable | Estado |
|---------|------|-----------|--------|
| `v0.1.0` | Scaffold | Phaser+Vite+TS+PWA, scenes base (Boot/Preload/Game/UI) | ✅ Hecho |
| `v0.2.0` | Input mobile + movimiento | Joystick virtual, capa de input abstracta, player se mueve en 8 direcciones | ✅ Hecho |
| `v0.3.0` | Combate | Melee (hitbox direccional) + ranged (proyectiles) + maná + risk/reward | ✅ Hecho |
| `v0.4.0` | Enemigos + IA | Sistema de componentes, 3 enemigos data-driven con IA (chaser/shooter) | ✅ Hecho |
| `v0.5.0` | Salas procedurales | Generador de grilla + puertas + transición entre salas | ✅ Hecho |
| `v0.6.0` | Stats + XP | Niveles, stats, fórmula de daño, level-up, escalado de enemigos | ⏳ Próximo |
| `v0.7.0` | Loot + equipo + skills A/B | Drops con stats, equipar armas; **A=ataque según arma, B=bloqueo/cura** (ver GDD) | |
| `v0.8.0` | Base/Hub + meta-progresión + PWA | Base persistente, portal a la run, muerte→base, stash con IndexedDB, offline real | |
| `v0.9.0` | Contenido + balance | Boss, biomas, tuning de dificultad | |
| `v1.0.0` | Release | Pulido, primera versión a `main` (producción) | |

## Convención de ramas

- `feat/<hito>` — desarrollo de cada hito (ej. `feat/mobile-input`)
- `dev` — integración continua de features
- `test` — validación previa a producción
- `hotfix/<nombre>` — arreglos urgentes sobre producción
- `main` — producción (intocable, solo releases etiquetados)
