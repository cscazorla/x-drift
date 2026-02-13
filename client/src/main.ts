import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  MessageType,
  SERVER_PORT,
  TICK_RATE,
  RESPAWN_TIME,
  type ServerMessage,
  type InputMessage,
  type PlayerState,
} from '@x-drift/shared';
import { getOrCreateShip, removeShip, getShipIds } from './ship';
import { createStarfield } from './starfield';
import { createCelestialBodies } from './celestial';
import { updateProjectiles } from './projectile';
import { triggerHitFlash, triggerDeathExplosion, updateHitFlashes } from './hitEffect';
import { addKillEntry } from './killFeed';
import { updateScoreboard } from './scoreboard';

// ---- Three.js setup ----

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000011);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 10, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Basic lighting
scene.add(new THREE.AmbientLight(0x445566, 0.8));
const dirLight = new THREE.DirectionalLight(0xfff5e6, 1);
dirLight.position.set(50, 30, 50);
scene.add(dirLight);

// Bloom post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,  // strength
  0.8,  // radius
  0.75, // threshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// Starfield (follows camera so stars appear infinitely far)
const stars = createStarfield(scene);

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Debug bar ----

const debugBar = document.createElement('div');
debugBar.style.cssText =
  'position:fixed;top:0;left:0;width:100%;padding:4px 8px;' +
  'background:rgba(0,0,0,0.6);color:#0f0;font:12px monospace;z-index:1000;pointer-events:none';
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

// ---- Input tracking ----

const keys: Record<string, boolean> = {};
let inputSeq = 0;

// Mouse delta accumulators (reset after each input send)
let accumulatedDx = 0;
let accumulatedDy = 0;

// Fire intent (reset after each input send)
let fireIntent = false;

window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// ---- Pointer Lock ----

const canvas = renderer.domElement;

canvas.addEventListener('click', () => {
  canvas.requestPointerLock();
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    accumulatedDx += e.movementX;
    accumulatedDy -= e.movementY;
  }
});

document.addEventListener('mousedown', (e) => {
  if (e.button === 0 && document.pointerLockElement === canvas) {
    fireIntent = true;
  }
});

// ---- Chase camera constants ----

const CAM_DIST = 8;
const CAM_HEIGHT = 3;

// ---- WebSocket connection ----

const ws = new WebSocket(`ws://localhost:${SERVER_PORT}`);

ws.addEventListener('open', () => {
  console.log('Connected to server');
});

ws.addEventListener('message', (event) => {
  const msg: ServerMessage = JSON.parse(String(event.data));

  if (msg.type === MessageType.Welcome) {
    myPlayerId = msg.playerId;
    const sunPos = createCelestialBodies(scene, msg.celestialBodies);
    if (sunPos) {
      dirLight.position.copy(sunPos);
    }
    console.log(`Joined as player ${myPlayerId}`);
    return;
  }

  if (msg.type === MessageType.State) {
    const activeIds = new Set(msg.players.map((p: PlayerState) => p.id));

    // Remove players that left
    for (const id of getShipIds()) {
      if (!activeIds.has(id)) removeShip(scene, id);
    }

    // Update positions and rotations
    for (const p of msg.players) {
      const ship = getOrCreateShip(scene, p.id, p.id === myPlayerId);
      ship.position.set(p.x, p.y, p.z);
      ship.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
      // Manage visibility based on hp (death explosion handles its own hiding)
      if (p.hp > 0) ship.visible = true;
      else if (p.hp <= 0) ship.visible = false;
    }

    // Update projectile meshes
    updateProjectiles(scene, msg.projectiles);

    // Chase camera follows the local player
    if (myPlayerId) {
      const me = msg.players.find((p: PlayerState) => p.id === myPlayerId);
      if (me) {
        // Detect respawn: was dead, now alive
        if (localDead && me.hp > 0) {
          localDead = false;
          respawnCountdown = 0;
          deathOverlay.style.display = 'none';
        }

        // Only update camera if alive (freeze when dead)
        if (me.hp > 0) {
          // Forward vector (same formula as server)
          const forwardX = -Math.sin(me.yaw) * Math.cos(me.pitch);
          const forwardY = Math.sin(me.pitch);
          const forwardZ = -Math.cos(me.yaw) * Math.cos(me.pitch);

          // Camera behind the ship
          camera.position.set(
            me.x - forwardX * CAM_DIST,
            me.y - forwardY * CAM_DIST + CAM_HEIGHT,
            me.z - forwardZ * CAM_DIST,
          );

          // Look at a point ahead of the ship
          camera.lookAt(
            me.x + forwardX * 4,
            me.y + forwardY * 4,
            me.z + forwardZ * 4,
          );
        }

        // Keep starfield centred on camera
        stars.position.copy(camera.position);

        // Update debug bar
        debugBar.textContent =
          `hp ${me.hp}  pos (${me.x.toFixed(1)}, ${me.y.toFixed(1)}, ${me.z.toFixed(1)})  speed ${me.speed.toFixed(1)}`;
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
    addKillEntry(msg.attackerId, msg.targetId, myPlayerId);
    if (msg.targetId === myPlayerId) {
      localDead = true;
      respawnCountdown = RESPAWN_TIME;
      deathOverlay.style.display = 'flex';
      deathCountdown.textContent = `Respawning in ${Math.ceil(respawnCountdown)}s`;
    }
  }
});

ws.addEventListener('close', () => {
  console.log('Disconnected from server');
});

// ---- Send input to server at a fixed rate ----

setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    // Suppress input when dead
    const dead = localDead;
    const msg: InputMessage = {
      type: MessageType.Input,
      seq: inputSeq++,
      keys: dead ? {} : { ...keys },
      mouseDx: dead ? 0 : accumulatedDx,
      mouseDy: dead ? 0 : accumulatedDy,
      fire: dead ? false : fireIntent,
    };
    ws.send(JSON.stringify(msg));

    // Reset accumulators after sending
    accumulatedDx = 0;
    accumulatedDy = 0;
    fireIntent = false;
  }
}, 1000 / TICK_RATE);

// ---- Render loop ----

const clock = new THREE.Clock();

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
