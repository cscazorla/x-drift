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
| Package management | npm workspaces | Monorepo with shared dependencies |

## Repository Structure

```
x-drift/
├── package.json           # Workspace root
├── tsconfig.base.json     # Shared TypeScript config
├── client/                # Browser client (Vite + Three.js)
│   ├── index.html
│   ├── src/
│   │   └── main.ts        # Three.js renderer + WebSocket client
│   ├── package.json
│   └── tsconfig.json
├── server/                # Authoritative game server (Node.js + ws)
│   ├── src/
│   │   └── index.ts       # WebSocket server + game loop
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
Captures input (keyboard)
  → sends via WebSocket →          Receives input from all players
                                   Runs game loop (60 ticks/sec):
                                     - Applies player inputs
                                     - Computes physics (positions, collisions)
                                     - Updates world state
  ← receives via WebSocket ←      Broadcasts state snapshot to each client
Renders state with Three.js
```

- The **client** only captures player input and renders the state received from the server.
- The **server** is the single source of truth. It processes all inputs, runs the physics simulation, and sends the resulting world state back to every connected client.

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

## Protocol

All messages are JSON over WebSocket.

### Client → Server

| Message | Fields | Description |
|---------|--------|-------------|
| `input` | `seq`, `keys` | Currently pressed keys |

### Server → Client

| Message | Fields | Description |
|---------|--------|-------------|
| `welcome` | `playerId` | Sent on connection, assigns a player ID |
| `state` | `players[]` | World snapshot with all player positions |

## Roadmap

1. **3D movement with rotation** — Replace flat WASD sliding with full 3D flight: pitch, yaw, roll. The ship should move in the direction it faces.
2. **Ship model** — Replace placeholder boxes with a ship-like shape built from Three.js geometries (no external 3D models yet).
3. **Space environment** — Starfield background instead of the green grid. Make it feel like outer space.
4. **Shooting** — Players fire projectiles. The server tracks them, computes trajectories, and detects collisions against other ships.
5. **Health and eliminations** — Ships have health points. Hits reduce HP, reaching zero triggers death and respawn.
6. **HUD** — 2D overlay showing health, score, and connected players.
7. **Client-side interpolation** — Smooth movement between server snapshots so motion doesn't look choppy.
8. **Ship upgrades** — As players score eliminations, their ship improves (speed, damage, etc.).
