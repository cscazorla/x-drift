const container = document.createElement('div');
container.style.cssText =
  'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
  'width:24px;height:24px;pointer-events:none;z-index:100;display:none';

// Horizontal line (left half)
const left = document.createElement('div');
left.style.cssText =
  'position:absolute;top:50%;left:0;width:8px;height:2px;' +
  'transform:translateY(-50%);background:rgba(255,255,255,0.7)';
container.appendChild(left);

// Horizontal line (right half)
const right = document.createElement('div');
right.style.cssText =
  'position:absolute;top:50%;right:0;width:8px;height:2px;' +
  'transform:translateY(-50%);background:rgba(255,255,255,0.7)';
container.appendChild(right);

// Vertical line (top half)
const top = document.createElement('div');
top.style.cssText =
  'position:absolute;left:50%;top:0;width:2px;height:8px;' +
  'transform:translateX(-50%);background:rgba(255,255,255,0.7)';
container.appendChild(top);

// Vertical line (bottom half)
const bottom = document.createElement('div');
bottom.style.cssText =
  'position:absolute;left:50%;bottom:0;width:2px;height:8px;' +
  'transform:translateX(-50%);background:rgba(255,255,255,0.7)';
container.appendChild(bottom);

document.body.appendChild(container);

const arms = [left, right, top, bottom];

/** Update crosshair arm colors based on heat level. */
export function updateCrosshairHeat(heat: number, overheated: boolean): void {
  let color: string;
  if (overheated) {
    color = 'rgba(255,60,60,0.9)';
  } else if (heat > 0.7) {
    color = 'rgba(255,140,0,0.85)';
  } else if (heat > 0.4) {
    color = 'rgba(255,255,0,0.8)';
  } else {
    color = 'rgba(255,255,255,0.7)';
  }
  for (const arm of arms) {
    arm.style.background = color;
  }
}

export { container as crosshairContainer };
