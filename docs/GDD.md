# Game Design Document — gamepwa

> ARPG roguelite mobile-first. Documento vivo: se actualiza a medida que el diseño evoluciona.

## Pitch

Roguelite ARPG táctil tipo **Soul Knight / Archero con progresión de Diablo**. El jugador hace *runs* por salas generadas proceduralmente, combatiendo con espada y magia, subiendo de nivel y consiguiendo loot con stats numéricas. Entre runs hay meta-progresión persistente.

## Pilares de diseño

1. **Overworld + dungeons (híbrido)** — un **mundo abierto** contiguo y persistente (la base adentro, cámara que sigue al jugador) que conecta entradas a **dungeons procedurales** (salas tipo Binding of Isaac). Volvés a la base **caminando por el mundo** (no hay portal de regreso: hay que conocer el mapa). Cada dungeon es distinto (rejugabilidad).
2. **Mobile-first (táctil)** — PWA pensada para celular: joystick virtual + botones de acción. Teclado como secundario. UI thumb-friendly.
3. **Combate melee + ranged con coste asimétrico (risk/reward)** — espada (hitbox direccional frontal) + magia/proyectiles. Mecánica central: **el ataque a distancia consume maná; el ataque melee consume vida.** El rango es seguro pero finito; el melee pega más fuerte pero cuesta sangre. Cada elección de combate tiene peso. El melee no puede dejar al jugador en 0 (no hay suicidio por golpe propio). Acción en tiempo real, foco en esquivar y posicionarse.
4. **Progresión por niveles/stats (Diablo)** — XP, niveles, stats (daño, vida, defensa, etc.), loot con números, fórmulas de daño, balance numérico.

## Controles / Skills (esquema objetivo)

Dos botones de acción contextuales (mobile-first):

- **A — Ataque (depende del arma equipada):**
  - Arma **melee** (espada, etc.) → ataque cuerpo a cuerpo, **consume vida**.
  - Arma **a distancia** (varita, arco, etc.) → proyectil, **consume maná**.
- **B — Defensa (depende del skill/equipo):** **bloqueo** o **cura**, **consume maná**.

Mantiene el coste asimétrico del pilar 3: la vida es el recurso del melee, el maná el del rango y la defensa. El comportamiento de **A** se resuelve consultando el arma equipada, por lo que su implementación completa depende del sistema de equipo (v0.7.0). **B (bloqueo/cura)** no depende de armas y puede implementarse antes.

> Estado actual (hasta v0.5.0): A=melee fijo, B=proyectil mágico. Esquema placeholder hasta tener equipo.

## Estructura: Base/Hub y loop de run

El juego es un **roguelite con hub** (tipo Hades / Children of Morta):

- **Base (en el overworld):** zona segura dentro del mundo abierto donde el jugador spawnea. Tiene el stash. Desde el mundo se camina hasta una **entrada de dungeon** para incursionar; al salir/morir se vuelve al overworld y se camina de vuelta a la base. **A futuro:** mejoras, NPCs, cofres, estaciones.

### Sistema de items (3 cosas distintas)

| Sistema | Qué es | Al morir | Persistencia |
|---|---|---|---|
| **Bag (inventario)** | Lo que vas levantando en la run. Tiene capacidad (crece a futuro). El loot **no se autoequipa**. | **Se pierde** (lo no depositado) | En memoria |
| **Baúl** | Almacén de la base para lo importante. Depositás la bag ahí. | — | IndexedDB |
| **Equipamiento** | El arma que usás. **Se degrada por uso** y al llegar a 0 **se destruye** (caés a puños, inquebrables). | **NO se pierde** | IndexedDB |

- **Equipar:** desde la bag, en cualquier momento (la anterior vuelve a la bag).
- **Run / incursión:** dungeon procedural. El loot recogido va a la bag.
- **Muerte:** no es game-over. Volvés a la base. **Se pierde la bag**; el equipo y el baúl quedan.
- **Retirada (volver con vida):** la única salida con vida está en la **sala inicial** (la entrada), sin cartel. El jugador debe **conocer/recordar el mapa** para volver. Retirarse **cura y conserva el loot**, pero termina la run (no boss, no profundidad): es un costo de oportunidad, no un escape gratis.
- **B según arma:** melee → bloqueo; rango → cura. (Ver Controles.)

Loop: `Base → (equipás del stash) → Portal → Run procedural → [morís o volvés] → Base → guardás loot → repetir`.

Implementación: la base es una escena/sala propia; la transición base↔run y la persistencia del stash llegan en v0.8.0. El sistema de equipo (v0.7.0) es el cimiento del stash.

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
