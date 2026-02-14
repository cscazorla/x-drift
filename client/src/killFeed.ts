const FADE_TIME = 3000; // ms
const TEAM_COLORS = ['#00ff88', '#ff4444']; // 0 = green, 1 = red

const container = document.createElement('div');
container.style.cssText =
  'position:fixed;top:8px;right:8px;display:flex;flex-direction:column;' +
  'align-items:flex-end;gap:4px;z-index:1000;pointer-events:none;display:none';
document.body.appendChild(container);

export { container as killFeedContainer };

function teamColor(team: number): string {
  return TEAM_COLORS[team] ?? '#ccc';
}

export function addKillEntry(
  attackerId: string,
  attackerName: string,
  attackerTeam: number,
  targetId: string,
  targetName: string,
  targetTeam: number,
  myPlayerId: string | null,
): void {
  const el = document.createElement('div');
  const isLocal = attackerId === myPlayerId || targetId === myPlayerId;
  el.style.cssText =
    `padding:6px 14px;font:bold 14px monospace;border-radius:4px;` +
    `background:rgba(0,0,0,0.85);border:1px solid ${isLocal ? '#ffdd44' : '#666'}`;

  const attackerSpan = document.createElement('span');
  attackerSpan.style.color = teamColor(attackerTeam);
  attackerSpan.textContent = attackerName;

  const separator = document.createElement('span');
  separator.style.color = '#eee';
  separator.textContent = ' eliminated ';

  const targetSpan = document.createElement('span');
  targetSpan.style.color = teamColor(targetTeam);
  targetSpan.textContent = targetName;

  el.appendChild(attackerSpan);
  el.appendChild(separator);
  el.appendChild(targetSpan);
  container.appendChild(el);

  setTimeout(() => {
    el.remove();
  }, FADE_TIME);
}
