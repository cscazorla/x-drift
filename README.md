# X-Drift

Online 3D space battle game set in a galaxy. Players pilot an X-wing-style ship that upgrades as they eliminate enemies.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Rendering | Three.js | 3D graphics in the browser |
| Client bundler | Vite | Dev server with HMR, TypeScript support |
| Server runtime | Node.js + tsx | Game server with hot reload in dev |
| WebSocket | ws (server) / native WebSocket (client) | Real-time bidirectional communication |
| Language | TypeScript | Shared types across client and server |
| Testing | Vitest | Server-side unit tests |
| Package management | npm workspaces | Monorepo with shared dependencies |

## Repository Structure

```
x-drift/
├── package.json           # Workspace root
├── tsconfig.base.json     # Shared TypeScript config
├── client/                # Browser client (Vite + Three.js)
│   ├── index.html
│   ├── src/
│   │   ├── main.ts        # Three.js renderer + WebSocket client
│   │   ├── ship.ts        # Ship model factory (7-mesh X-wing shape)
│   │   ├── starfield.ts   # Particle-based starfield that follows the camera
│   │   ├── celestial.ts   # Sun and planet renderer from server data
│   │   ├── projectile.ts  # Projectile beam renderer (synced from server state)
│   │   ├── hitEffect.ts   # Hit flash + death explosion effects
│   │   ├── killFeed.ts    # DOM-based kill feed overlay (top-right)
│   │   └── scoreboard.ts  # Top-10 scoreboard overlay (top-left)

│   ├── package.json
│   └── tsconfig.json
├── server/                # Authoritative game server (Node.js + ws)
│   ├── src/
│   │   ├── index.ts       # WebSocket server + game loop
│   │   ├── game.ts        # Pure game logic (movement, projectiles, collisions, damage)
│   │   ├── npc.ts         # NPC ship AI (wander behavior, input simulation)
│   │   └── __tests__/
│   │       ├── game.test.ts
│   │       └── npc.test.ts
│   ├── vitest.config.ts
│   ├── package.json
│   └── tsconfig.json
└── shared/                # Types and constants shared by client and server
    ├── src/
    │   └── index.ts       # Message types, game constants
    ├── package.json
    └── tsconfig.json
```

## Architecture

The game uses an **authoritative server** model to prevent cheating:

```
Client                             Server
──────                             ──────
Captures input (keyboard + mouse)
  → sends via WebSocket →          Receives input from all players
                                   Runs game loop (60 ticks/sec):
                                     - Applies player inputs
                                     - Updates NPC AI (simulates inputs)
                                     - Computes physics (positions, collisions)
                                     - Updates world state
  ← receives via WebSocket ←      Broadcasts state snapshot to each client
Renders state with Three.js
```

- The **client** only captures player input and renders the state received from the server.
- The **server** is the single source of truth. It processes all inputs, runs the physics simulation, and sends the resulting world state back to every connected client.

### Message Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server

    Note over C,S: Connection
    C->>S: WebSocket connect
    S->>C: welcome { playerId, celestialBodies[] }

    Note over C,S: Game Loop (60 Hz)
    loop Every tick (~16ms)
        C->>S: input { keys, mouseDx, mouseDy, fire }
        Note right of S: Apply inputs (skip dead)<br/>Update NPC AI (skip dead)<br/>Update positions<br/>Spawn projectiles (skip dead)<br/>Move projectiles<br/>Detect collisions (alive only)<br/>Apply damage / kills<br/>Respawn timers
        S->>C: state { players[] (incl. hp, kills, deaths), projectiles[] }
        opt Projectile hit a ship
            S->>C: hit { targetId, attackerId, projectileId, x, y, z }
        end
        opt Ship destroyed (hp reached 0)
            S->>C: kill { targetId, attackerId, x, y, z }
        end
    end

    Note over C,S: Disconnection
    C->>S: WebSocket close
    Note right of S: Remove player<br/>Remove their projectiles
```

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install

```bash
npm install
```

### Run in Development

Start the server and client in two separate terminals:

```bash
# Terminal 1 — Game server (ws://localhost:3000)
npm run dev --workspace=server

# Terminal 2 — Client dev server (http://localhost:5173)
npm run dev --workspace=client
```

Open `http://localhost:5173` in your browser. You can open multiple tabs to simulate multiple players.

### Run Tests

```bash
npm test --workspace=server
```

## Controls

| Input | Action |
|-------|--------|
| Click | Lock mouse pointer (enables look) |
| Mouse | Yaw and pitch |
| W / Arrow Up | Accelerate forward (max 10 u/s) |
| S / Arrow Down | Brake (decelerate to 0, never reverses) |
| A / Arrow Left | Roll left |
| D / Arrow Right | Roll right |
| Left click (while locked) | Fire projectile (~3 shots/sec) |

Releasing W keeps the current speed (no friction). A debug bar at the top of the screen shows HP, position, and speed.

## Protocol

All messages are JSON over WebSocket.

### Client → Server

| Message | Fields | Description |
|---------|--------|-------------|
| `input` | `seq`, `keys`, `mouseDx`, `mouseDy`, `fire` | Currently pressed keys, accumulated mouse deltas, and fire intent |

### Server → Client

| Message | Fields | Description |
|---------|--------|-------------|
| `welcome` | `playerId`, `celestialBodies[]` | Sent on connection, assigns a player ID and world geometry |
| `state` | `players[]` (incl. `hp`, `kills`, `deaths`), `projectiles[]` | World snapshot with all player/NPC positions and scores |
| `hit` | `targetId`, `attackerId`, `projectileId`, `x`, `y`, `z` | A projectile hit a ship (triggers flash effect) |
| `kill` | `targetId`, `attackerId`, `x`, `y`, `z` | A ship was destroyed (triggers death explosion, kill feed, respawn) |

## Roadmap

1. ~~**3D movement with rotation**~~ — Full 3D flight with mouse look (pointer lock), pitch/yaw, roll (A/D), acceleration-based thrust (W to accelerate, S to brake, coasting when no key pressed), chase camera, and a debug HUD showing position and speed.
2. ~~**Ship model**~~ — Replace placeholder box with a 7-mesh X-wing-style ship (fuselage, nose cone, wings, engines, exhaust glow) using Three.js primitives, with green/red color schemes for local/remote players.
3. ~~**Space environment**~~ — Starfield background, server-defined sun (with glow and point light) and planets (with optional rings) as spatial reference points.
4. ~~**Shooting**~~ — Left-click fires light-beam projectiles (server-authoritative, 300ms cooldown, 3s lifetime, 40 u/s). Point-vs-sphere collision detection with a brief white flash on hit.
5. ~~**NPC ships**~~ — Server-controlled NPC ships that wander randomly at skill-dependent speeds. NPCs reuse the `PlayerLike` interface — AI simulates input each tick, then existing physics runs unchanged. Appear as red ships to all players.
6. ~~**Health and eliminations**~~ — Ships have 4 HP. Each hit deals 1 damage. At 0 HP: death explosion (white flash + scale-up), kill feed entry, and respawn after 5 seconds. Dead ships freeze and become invisible. The local player sees a "DESTROYED" overlay with countdown. Both players and NPCs have health and respawn.
7. ~~**HUD**~~ — Server-authoritative kill/death tracking for players and NPCs. Always-visible top-10 scoreboard (top-left) sorted by kills, with the local player highlighted in yellow. Shows connected human player count.
8. **Client-side interpolation** — Smooth movement between server snapshots so motion doesn't look choppy.
9. **Ship upgrades** — As players score eliminations, their ship improves (speed, damage, etc.).
10. **NPC combat** — NPCs target and shoot at nearby players.
