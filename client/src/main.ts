import { Clock } from 'three';
import {
  MessageType,
  SERVER_PORT,
  TICK_RATE,
  RESPAWN_TIME,
  computeForward,
  type ServerMessage,
  type InputMessage,
  type JoinTeamMessage,
  type PlayerState,
} from '@x-drift/shared';
import { getOrCreateShip, removeShip, getShipIds, setThrustState } from './ship';
import { createStarfield } from './starfield';
import { createCelestialBodies } from './celestial';
import { updateProjectiles } from './projectile';
import { triggerHitFlash, triggerDeathExplosion, updateHitFlashes } from './hitEffect';
import { addKillEntry, killFeedContainer } from './killFeed';
import { updateScoreboard, scoreboardContainer } from './scoreboard';
import { crosshairContainer, updateCrosshairHeat } from './crosshair';
import { heatBarContainer, updateHeatBar } from './heatBar';
import { showWelcomeScreen, type WelcomeScreenHandle } from './welcome';
import { createInputManager } from './inputManager';
import { initThreeScene } from './threeSetup';

// ---- Three.js setup ----

const { scene, camera, renderer, composer, sunLight } = initThreeScene();

// Starfield (follows camera so stars appear infinitely far)
const stars = createStarfield(scene);

// ---- Debug bar ----

const debugBar = document.createElement('div');
debugBar.style.cssText =
  'position:fixed;bottom:0;left:0;width:100%;padding:4px 8px;' +
  'background:rgba(0,0,0,0.6);color:#0f0;font:12px monospace;z-index:1000;pointer-events:none;display:none';
document.body.appendChild(debugBar);

// ---- Death overlay ----

const deathOverlay = document.createElement('div');
deathOverlay.style.cssText =
  'position:fixed;top:0;left:0;width:100%;height:100%;display:none;' +
  'justify-content:center;align-items:center;flex-direction:column;' +
  'background:rgba(0,0,0,0.5);z-index:999;pointer-events:none';
const deathTitle = document.createElement('div');
deathTitle.style.cssText = 'color:#ff4444;font:bold 48px monospace;margin-bottom:16px';
deathTitle.textContent = 'DESTROYED';
const deathCountdown = document.createElement('div');
deathCountdown.style.cssText = 'color:#ccc;font:24px monospace';
deathOverlay.appendChild(deathTitle);
deathOverlay.appendChild(deathCountdown);
document.body.appendChild(deathOverlay);

// ---- Player state ----

let myPlayerId: string | null = null;
let localDead = false;
let respawnCountdown = 0;

// ---- Render loop (runs during welcome screen for starfield background) ----

const clock = new Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  updateHitFlashes(dt);

  // Update death countdown
  if (localDead && respawnCountdown > 0) {
    respawnCountdown -= dt;
    deathCountdown.textContent = `Respawning in ${Math.max(1, Math.ceil(respawnCountdown))}s`;
  }

  composer.render();
}

animate();

// ---- Game init ----

function init() {
  // Connect WebSocket first (before showing welcome screen)
  const ws = new WebSocket(`ws://localhost:${SERVER_PORT}`);

  // Wait for first TeamInfo, then show the welcome screen with team counts
  let welcomeHandle: WelcomeScreenHandle | null = null;

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data)) as ServerMessage;

    if (msg.type === MessageType.TeamInfo) {
      if (!welcomeHandle) {
        // First TeamInfo — show welcome screen
        welcomeHandle = showWelcomeScreen(msg.teams, msg.playerName);
        // When the player picks a team, send JoinTeam
        void welcomeHandle.teamSelected.then((team) => {
          const joinMsg: JoinTeamMessage = { type: MessageType.JoinTeam, team };
          ws.send(JSON.stringify(joinMsg));
        });
      } else {
        // Subsequent updates — refresh live counts
        welcomeHandle.updateCounts(msg.teams);
      }
      return;
    }

    if (msg.type === MessageType.Welcome) {
      myPlayerId = msg.playerId;
      const sunPos = createCelestialBodies(scene, msg.celestialBodies);
      if (sunPos) {
        sunLight.position.copy(sunPos);
      }
      console.log(`Joined as player ${myPlayerId}`);

      // Show HUD elements
      debugBar.style.display = '';
      scoreboardContainer.style.display = '';
      killFeedContainer.style.display = 'flex';
      crosshairContainer.style.display = '';
      heatBarContainer.style.display = '';
      return;
    }

    if (msg.type === MessageType.State) {
      const activeIds = new Set(msg.players.map((p: PlayerState) => p.id));

      // Remove players that left
      for (const id of getShipIds()) {
        if (!activeIds.has(id)) removeShip(scene, id);
      }

      // Build team lookup for projectile coloring
      const teamByOwner = new Map<string, number>();
      for (const p of msg.players) teamByOwner.set(p.id, p.team);

      // Update positions and rotations
      for (const p of msg.players) {
        const ship = getOrCreateShip(scene, p.id, p.team, p.id === myPlayerId);
        ship.position.set(p.x, p.y, p.z);
        ship.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
        // Manage visibility based on hp (death explosion handles its own hiding)
        if (p.hp > 0) ship.visible = true;
        else if (p.hp <= 0) ship.visible = false;
        setThrustState(p.id, p.thrustState);
      }

      // Update projectile meshes
      updateProjectiles(scene, msg.projectiles, teamByOwner);

      // Chase camera follows the local player
      if (myPlayerId) {
        const me = msg.players.find((p: PlayerState) => p.id === myPlayerId);
        if (me) {
          // Detect respawn: was dead, now alive
          if (localDead && me.hp > 0) {
            localDead = false;
            respawnCountdown = 0;
            deathOverlay.style.display = 'none';
            crosshairContainer.style.display = '';
            heatBarContainer.style.display = '';
          }

          // Only update camera if alive (freeze when dead)
          if (me.hp > 0) {
            const fwd = computeForward(me.yaw, me.pitch);

            // Camera behind the ship
            camera.position.set(
              me.x - fwd.x * CAM_DIST,
              me.y - fwd.y * CAM_DIST + CAM_HEIGHT,
              me.z - fwd.z * CAM_DIST,
            );

            // Look at a point ahead of the ship
            camera.lookAt(me.x + fwd.x * 4, me.y + fwd.y * 4, me.z + fwd.z * 4);

            // Update heat visuals
            updateCrosshairHeat(me.heat, me.overheated);
            updateHeatBar(me.heat, me.overheated);
          }

          // Keep starfield centred on camera
          stars.position.copy(camera.position);

          // Update debug bar
          const humanCount = msg.players.filter((p) => !p.id.startsWith('npc-')).length;
          debugBar.textContent = `players ${humanCount}  hp ${me.hp}  pos (${me.x.toFixed(1)}, ${me.y.toFixed(1)}, ${me.z.toFixed(1)})  speed ${me.speed.toFixed(1)}  heat ${(me.heat * 100).toFixed(0)}%${me.overheated ? ' OVERHEATED' : ''}`;
        }

        // Update scoreboard
        updateScoreboard(msg.players, myPlayerId);
      }
    }

    if (msg.type === MessageType.Hit) {
      triggerHitFlash(msg.targetId);
    }

    if (msg.type === MessageType.Kill) {
      triggerDeathExplosion(msg.targetId);
      addKillEntry(
        msg.attackerId,
        msg.attackerName,
        msg.attackerTeam,
        msg.targetId,
        msg.targetName,
        msg.targetTeam,
        myPlayerId,
      );
      if (msg.targetId === myPlayerId) {
        localDead = true;
        respawnCountdown = RESPAWN_TIME;
        deathOverlay.style.display = 'flex';
        crosshairContainer.style.display = 'none';
        heatBarContainer.style.display = 'none';
        deathCountdown.textContent = `Respawning in ${Math.ceil(respawnCountdown)}s`;
      }
    }
  });

  ws.addEventListener('open', () => {
    console.log('Connected to server');
  });

  ws.addEventListener('close', () => {
    console.log('Disconnected from server');
  });

  // ---- Input tracking ----

  const input = createInputManager(renderer.domElement);
  let inputSeq = 0;

  // ---- Chase camera constants ----

  const CAM_DIST = 8;
  const CAM_HEIGHT = 3;

  // ---- Send input to server at a fixed rate ----

  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN && myPlayerId) {
      const snapshot = input.getStateAndReset();
      const dead = localDead;
      const msg: InputMessage = {
        type: MessageType.Input,
        seq: inputSeq++,
        keys: dead ? {} : snapshot.keys,
        mouseDx: dead ? 0 : snapshot.mouseDx,
        mouseDy: dead ? 0 : snapshot.mouseDy,
        fire: dead ? false : snapshot.fire,
      };
      ws.send(JSON.stringify(msg));
    }
  }, 1000 / TICK_RATE);
}

init();
