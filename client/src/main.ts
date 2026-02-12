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
scene.add(new THREE.GridHelper(50, 50, 0x004400, 0x002200));

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

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

window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

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

    // Update positions
    for (const p of msg.players) {
      const mesh = getOrCreateMesh(p.id);
      mesh.position.set(p.x, p.y, p.z);
    }

    // Follow the local player with the camera
    if (myPlayerId) {
      const me = msg.players.find((p: PlayerState) => p.id === myPlayerId);
      if (me) {
        camera.position.set(me.x, me.y + 10, me.z + 10);
        camera.lookAt(me.x, me.y, me.z);
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
    };
    ws.send(JSON.stringify(msg));
  }
}, 1000 / TICK_RATE);

// ---- Render loop ----

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
