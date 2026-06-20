# Game Design Document — gamepwa

> ARPG roguelite mobile-first. Documento vivo: se actualiza a medida que el diseño evoluciona.

## Pitch

Roguelite ARPG táctil tipo **Soul Knight / Archero con progresión de Diablo**. El jugador hace *runs* por salas generadas proceduralmente, combatiendo con espada y magia, subiendo de nivel y consiguiendo loot con stats numéricas. Entre runs hay meta-progresión persistente.

## Pilares de diseño

1. **Roguelite por salas** — dungeons generados proceduralmente (grilla tipo Binding of Isaac). Cada run es distinta. Rejugabilidad > narrativa.
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

- **Base (hub persistente):** el jugador arranca acá. Es una zona segura, no procedural, que persiste entre runs. Desde la base se sale a la incursión (portal/puerta). **A futuro se le agregan cosas:** mejoras, NPCs, cofres, estaciones.
- **Stash (almacén):** loot guardado en la base. **Persiste entre runs** (IndexedDB).
- **Run / incursión:** dungeon procedural (las salas de v0.5.0). El loot recogido durante la run se lleva "encima".
- **Muerte:** no es game-over. El jugador **vuelve a la base**. El loot que llevaba encima y **no guardó** en el stash **se pierde** (riesgo roguelite). Lo guardado en el stash queda.
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
