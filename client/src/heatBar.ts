const container = document.createElement('div');
container.style.cssText =
  'position:fixed;left:50%;bottom:20%;transform:translateX(-50%);' +
  'width:120px;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;' +
  'pointer-events:none;z-index:100;display:none;overflow:hidden';

const fill = document.createElement('div');
fill.style.cssText =
  'width:0%;height:100%;border-radius:3px;background:rgba(255,255,255,0.7);' +
  'transition:width 0.05s linear';
container.appendChild(fill);

document.body.appendChild(container);

export function updateHeatBar(heat: number, overheated: boolean): void {
  const pct = Math.min(100, Math.max(0, heat * 100));
  fill.style.width = `${pct}%`;

  if (overheated) {
    fill.style.background = 'rgba(255,60,60,0.9)';
  } else if (heat > 0.7) {
    fill.style.background = 'rgba(255,140,0,0.85)';
  } else {
    fill.style.background = 'rgba(255,255,255,0.7)';
  }
}

export { container as heatBarContainer };
