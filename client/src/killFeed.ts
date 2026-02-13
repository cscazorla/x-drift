const FADE_TIME = 3000; // ms

const container = document.createElement('div');
container.style.cssText =
  'position:fixed;top:8px;right:8px;display:flex;flex-direction:column;' +
  'align-items:flex-end;gap:4px;z-index:1000;pointer-events:none';
document.body.appendChild(container);

export function addKillEntry(attackerId: string, targetId: string, myPlayerId: string | null): void {
  const el = document.createElement('div');
  const isLocal = attackerId === myPlayerId || targetId === myPlayerId;
  el.style.cssText =
    `padding:6px 14px;font:bold 14px monospace;border-radius:4px;` +
    `background:rgba(0,0,0,0.85);border:1px solid ${isLocal ? '#ffdd44' : '#666'};` +
    `color:${isLocal ? '#ffdd44' : '#eee'}`;
  el.textContent = `${attackerId} eliminated ${targetId}`;
  container.appendChild(el);

  setTimeout(() => {
    el.remove();
  }, FADE_TIME);
}
