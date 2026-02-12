import * as THREE from 'three';
import {
  MessageType,
  SERVER_PORT,
  TICK_RATE,
  type ServerMessage,
  type InputMessage,
  type PlayerState,
} from '@x-drift/shared';

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
scene.add(new THREE.AmbientLight(0x404040));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// Grid for spatial reference
scene.add(new THREE.GridHelper(200, 200, 0x444444, 0x222222));

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

// ---- Player meshes ----

const playerMeshes = new Map<string, THREE.Mesh>();
let myPlayerId: string | null = null;

function getOrCreateMesh(id: string): THREE.Mesh {
  let mesh = playerMeshes.get(id);
  if (!mesh) {
    const color = id === myPlayerId ? 0x00ff88 : 0xff4444;
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.5, 1.5),
      new THREE.MeshStandardMaterial({ color }),
    );
    scene.add(mesh);
    playerMeshes.set(id, mesh);
  }
  return mesh;
}

function removePlayer(id: string) {
  const mesh = playerMeshes.get(id);
  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    playerMeshes.delete(id);
  }
}

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
    accumulatedDy += e.movementY;
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
    console.log(`Joined as player ${myPlayerId}`);
    return;
  }

  if (msg.type === MessageType.State) {
    const activeIds = new Set(msg.players.map((p: PlayerState) => p.id));

    // Remove players that left
    for (const id of playerMeshes.keys()) {
      if (!activeIds.has(id)) removePlayer(id);
    }

    // Update positions and rotations
    for (const p of msg.players) {
      const mesh = getOrCreateMesh(p.id);
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
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
