# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

X-Drift is an online 3D space battle game (team deathmatch, Green vs Red) where players pilot X-wing-style ships. Built with an **authoritative server** model — the client only captures input and renders; all game logic runs on the server.

## Commands

```bash
# Install all workspace dependencies
npm install

# Start game server (ws://localhost:3000) — hot reloads via tsx watch
npm run dev --workspace=server

# Start client dev server (http://localhost:5173) — Vite with HMR
npm run dev --workspace=client

# Run server tests
npm test --workspace=server

# Run a single test file
npx vitest run src/__tests__/game.test.ts --workspace=server
```

Both server and client must be running simultaneously for development. Open multiple browser tabs to simulate multiplayer.

## Architecture

**Monorepo** with three npm workspaces:

- **`shared/`** — TypeScript types and constants (`@x-drift/shared`). All message types (`MessageType` enum), game constants, and interfaces (e.g. `PlayerState`, `ProjectileState`, `CelestialBody`) live here. `math.ts` provides shared pure math utilities (`computeForward`, `normalizeAngle`, `distanceSq`) used by both client and server. Both client and server import from this package directly (no build step — `main` points to `.ts` source).

- **`server/`** — Node.js WebSocket server (`ws` library). Key files:
  - `index.ts` — WebSocket server, game loop (60 Hz tick), player connection lifecycle, lobby system, state broadcasting. Orchestrates the tick: apply inputs → update NPC AI → update positions → spawn projectiles → move projectiles → detect collisions → apply damage → handle respawns.
  - `game.ts` — Pure functions for game logic: `updatePlayerMovement()`, `spawnProjectile()`, `moveProjectiles()`, `detectCollisions()`, `applyDamage()`. No I/O, fully testable.
  - `npc.ts` — NPC AI: `createNPC()`, `updateNPCAI()`, `findNearestTarget()`, `respawnNPC()`. NPCs simulate player inputs (keys/mouse) which feed into the same movement system.
  - `spawn.ts` — `randomSpawnPosition()` for placing ships (players and NPCs) at random positions facing away from the origin.

- **`client/`** — Vite + Three.js browser app. `main.ts` is the entry point handling WebSocket connection and the render loop. Supporting modules: `threeSetup.ts` (scene, camera, renderer, bloom post-processing), `inputManager.ts` (keyboard, mouse, pointer lock), `ship.ts` (mesh factory), `starfield.ts`, `celestial.ts` (sun/planets), `projectile.ts`, `hitEffect.ts`, `welcome.ts` (team selection UI), `killFeed.ts`, `scoreboard.ts`, `crosshair.ts`, `heatBar.ts`.

### Key Design Patterns

- **Input-driven simulation**: Both players and NPCs produce the same input shape (`keys`, `mouseDx`, `mouseDy`, `fire`). The server's `updatePlayerMovement()` processes them identically. NPC AI just generates synthetic inputs.
- **Lobby phase**: Players connect to a lobby first, receive live `teamInfo` updates, then send `joinTeam` to enter the game.
- **Team system**: Team 0 = green, Team 1 = red. No friendly fire — collisions and projectile hits check team membership.
- **State broadcast**: Every tick, the server sends a full `state` snapshot (all players + projectiles) to each client. No delta compression or client-side prediction yet.

## Testing

Tests use **Vitest** and live in `server/src/__tests__/`. They cover shared math utilities (`math.test.ts`), game logic (`game.test.ts`), and NPC behavior (`npc.test.ts`). Test files import the pure functions from `@x-drift/shared`, `game.ts`, and `npc.ts` directly. There is no client-side testing.

## Tech Stack

- **Three.js** (0.170) — 3D rendering with UnrealBloomPass post-processing
- **Vite** (6.x) — Client bundler/dev server
- **tsx** (4.x) — Server runtime with watch mode
- **ws** (8.x) — WebSocket server
- **TypeScript** (5.6) strict mode throughout
- **ESLint** (9.x) — Linting with `typescript-eslint` type-checked rules
- **Prettier** (3.x) — Code formatting

## Linting & Formatting

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix

# Format all files
npm run format

# Check formatting without writing
npm run format:check
```
