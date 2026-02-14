export interface InputSnapshot {
  keys: Record<string, boolean>;
  mouseDx: number;
  mouseDy: number;
  fire: boolean;
}

export interface InputManager {
  getStateAndReset(): InputSnapshot;
}

/** Create an input manager that tracks keyboard, mouse, and pointer lock state. */
export function createInputManager(canvas: HTMLCanvasElement): InputManager {
  const keys: Record<string, boolean> = {};
  let accumulatedDx = 0;
  let accumulatedDy = 0;
  let mouseHeld = false;

  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  canvas.addEventListener('click', () => {
    void canvas.requestPointerLock();
  });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      accumulatedDx += e.movementX;
      accumulatedDy -= e.movementY;
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && document.pointerLockElement === canvas) {
      mouseHeld = true;
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      mouseHeld = false;
    }
  });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas) {
      mouseHeld = false;
    }
  });

  return {
    getStateAndReset(): InputSnapshot {
      const snapshot: InputSnapshot = {
        keys: { ...keys },
        mouseDx: accumulatedDx,
        mouseDy: accumulatedDy,
        fire: mouseHeld,
      };
      accumulatedDx = 0;
      accumulatedDy = 0;
      return snapshot;
    },
  };
}
