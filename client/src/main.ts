import * as THREE from 'three';
import {
  MessageType,
  SERVER_PORT,
  TICK_RATE,
  type ServerMessage,
  type InputMessage,
  type PlayerState,
} from '@x-drift/shared';
import { getOrCreateShip, removeShip, getShipIds } from './ship';
import { createStarfield } from './starfield';
import { createCelestialBodies } from './celestial';

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

// Starfield (follows camera so stars appear infinitely far)
const stars = createStarfield(scene);

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Debug bar ----

const debugBar = document.createElement('div');
debugBar.style.cssText =
  'position:fixed;top:0;left:0;width:100%;padding:4px 8px;' +
  'background:rgba(0,0,0,0.6);color:#0f0;font:12px monospace;z-index:1000;pointer-events:none';
document.body.appendChild(debugBar);

// ---- Player state ----

let myPlayerId: string | null = null;

// ---- Input tracking ----

const keys: Record<string, boolean> = {};
let inputSeq = 0;

// Mouse delta accumulators (reset after each input send)
let accumulatedDx = 0;
let accumulatedDy = 0;

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
    }

    // Chase camera follows the local player
    if (myPlayerId) {
      const me = msg.players.find((p: PlayerState) => p.id === myPlayerId);
      if (me) {
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

        // Keep starfield centred on camera
        stars.position.copy(camera.position);

        // Update debug bar
        debugBar.textContent =
          `pos (${me.x.toFixed(1)}, ${me.y.toFixed(1)}, ${me.z.toFixed(1)})  speed ${me.speed.toFixed(1)}`;
      }
    }
  }
});

ws.addEventListener('close', () => {
  console.log('Disconnected from server');
});

// ---- Send input to server at a fixed rate ----

setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    const msg: InputMessage = {
      type: MessageType.Input,
      seq: inputSeq++,
      keys: { ...keys },
      mouseDx: accumulatedDx,
      mouseDy: accumulatedDy,
    };
    ws.send(JSON.stringify(msg));

    // Reset accumulators after sending
    accumulatedDx = 0;
    accumulatedDy = 0;
  }
}, 1000 / TICK_RATE);

// ---- Render loop ----

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
