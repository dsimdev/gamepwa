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
| `v0.8.0` | Base/Hub + meta-progresión + PWA | Base persistente, portal a la run, muerte→base, stash con IndexedDB, offline real | ✅ Hecho |
| `v0.9.0` | Contenido + balance | Boss, biomas, tuning de dificultad | ⏳ Próximo |
| `v1.0.0` | Release | Pulido, primera versión a `main` (producción) | |

## Pendientes de balance / tuning (para una pasada antes de v1.0.0)

- **Droprate** de loot (hoy 30%, peso 70% arma / 30% skill) — ajustar.
- Economía de maná (coste/regen) y coste de vida del melee.
- Ritmo de subida de nivel (curva de XP) y escalado por profundidad.
- Dificultad del boss y cantidad de enemigos por sala.
- ¿Boss obligatorio? (hoy la sala de boss es opcional) — definir si es la meta de la run.

## Convención de ramas

- `feat/<hito>` — desarrollo de cada hito (ej. `feat/mobile-input`)
- `dev` — integración continua de features
- `test` — validación previa a producción
- `hotfix/<nombre>` — arreglos urgentes sobre producción
- `main` — producción (intocable, solo releases etiquetados)
