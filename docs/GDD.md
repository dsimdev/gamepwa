# Game Design Document — gamepwa

> ARPG roguelite mobile-first. Documento vivo: se actualiza a medida que el diseño evoluciona.

## Pitch

Roguelite ARPG táctil tipo **Soul Knight / Archero con progresión de Diablo**. El jugador hace *runs* por salas generadas proceduralmente, combatiendo con espada y magia, subiendo de nivel y consiguiendo loot con stats numéricas. Entre runs hay meta-progresión persistente.

## Pilares de diseño

1. **Roguelite por salas** — dungeons generados proceduralmente (grilla tipo Binding of Isaac). Cada run es distinta. Rejugabilidad > narrativa.
2. **Mobile-first (táctil)** — PWA pensada para celular: joystick virtual + botones de acción. Teclado como secundario. UI thumb-friendly.
3. **Combate melee + ranged con coste asimétrico (risk/reward)** — espada (hitbox direccional frontal) + magia/proyectiles. Mecánica central: **el ataque a distancia consume maná; el ataque melee consume vida.** El rango es seguro pero finito; el melee pega más fuerte pero cuesta sangre. Cada elección de combate tiene peso. El melee no puede dejar al jugador en 0 (no hay suicidio por golpe propio). Acción en tiempo real, foco en esquivar y posicionarse.
4. **Progresión por niveles/stats (Diablo)** — XP, niveles, stats (daño, vida, defensa, etc.), loot con números, fórmulas de daño, balance numérico.

## Decisiones de arquitectura

### 1. Entidades: componentes sobre Phaser (Decisión 1-B) ✅
Entidades = sprites de Phaser + componentes desacoplados (`HealthComponent`, `StatsComponent`, `StatusEffects`, etc.). Evita jerarquías de herencia rígidas cuando los items modifican comportamiento (ej. "tus flechas envenenan"). No es ECS puro: aprovecha la API OOP de Phaser sin pelear contra ella.

### 2. Generación procedural: grid de salas (tipo Binding of Isaac)
Mapa = grilla. Salas-plantilla (hechas en Tiled) conectadas por puertas. Simple de implementar, debuggear y curar. Migrable a grafo/flujo (tipo Hades) más adelante si se quiere más curaduría.

### 3. Datos: data-driven (JSON/TS)
Enemigos, items, stats y drop rates viven en archivos de datos, no hardcodeados en clases. Balancear = editar datos. Bajo costo, alto retorno.

## Stack técnico

- **Phaser 3** — render 2D, física arcade, animaciones, tilemaps
- **Vite + TypeScript** — build, HMR, tipado
- **vite-plugin-pwa** — manifest, service worker, offline
- **Tiled** — editor de tilemaps (export JSON) para plantillas de sala
- **IndexedDB** — persistencia de meta-progresión

## Resolución / estilo

- Render interno: **320×180** (16:9), zoom ×3, pixel art (`pixelArt: true`)
- Tiles de **16×16**

## Flujo git

Ver memoria del proyecto / `ROADMAP.md`. `main` = producción (intocable). Trabajo en `dev`, features en `feat/*`. Semver `x.y.z`.
