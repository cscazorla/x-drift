export interface WelcomeScreenHandle {
  element: HTMLElement;
  updateCounts(counts: [number, number]): void;
  teamSelected: Promise<number>;
}

export function showWelcomeScreen(
  initialCounts: [number, number],
  playerName?: string,
): WelcomeScreenHandle {
  let resolveTeam!: (team: number) => void;
  const teamSelected = new Promise<number>((resolve) => {
    resolveTeam = resolve;
  });

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2000;display:flex;flex-direction:column;' +
    'justify-content:center;align-items:center;background:rgba(0,0,8,0.85);' +
    'font-family:monospace;color:#ccc';

  // Title
  const title = document.createElement('div');
  title.style.cssText = 'font-size:64px;font-weight:bold;color:#fff;letter-spacing:8px';
  title.textContent = 'X-DRIFT';
  overlay.appendChild(title);

  // Subtitle
  const subtitle = document.createElement('div');
  subtitle.style.cssText = 'font-size:18px;color:#888;margin-top:8px;letter-spacing:4px';
  subtitle.textContent = 'TEAM DEATHMATCH';
  overlay.appendChild(subtitle);

  // Player name
  if (playerName) {
    const nameTag = document.createElement('div');
    nameTag.style.cssText = 'font-size:22px;color:#fff;margin-top:24px;letter-spacing:3px';
    nameTag.textContent = playerName;
    overlay.appendChild(nameTag);
  }

  // Controls table
  const table = document.createElement('div');
  table.style.cssText =
    'margin-top:40px;border:1px solid #444;border-radius:6px;padding:16px 28px;' +
    'display:grid;grid-template-columns:auto auto;gap:8px 32px;font-size:14px';

  const controls: [string, string][] = [
    ['Mouse', 'Steer ship'],
    ['W / \u2191', 'Accelerate'],
    ['S / \u2193', 'Brake'],
    ['A / \u2190', 'Roll left'],
    ['D / \u2192', 'Roll right'],
    ['Left click', 'Fire'],
  ];

  for (const [key, action] of controls) {
    const keyEl = document.createElement('span');
    keyEl.style.cssText = 'color:#fff;text-align:right';
    keyEl.textContent = key;
    const actionEl = document.createElement('span');
    actionEl.style.cssText = 'color:#888';
    actionEl.textContent = action;
    table.appendChild(keyEl);
    table.appendChild(actionEl);
  }

  overlay.appendChild(table);

  // Choose team label
  const chooseLabel = document.createElement('div');
  chooseLabel.style.cssText = 'margin-top:36px;font-size:16px;color:#888;letter-spacing:3px';
  chooseLabel.textContent = 'CHOOSE YOUR TEAM';
  overlay.appendChild(chooseLabel);

  // Team buttons container
  const teamRow = document.createElement('div');
  teamRow.style.cssText = 'display:flex;gap:24px;margin-top:16px';

  const countEls: HTMLElement[] = [];

  function createTeamButton(team: number, label: string, color: string): HTMLElement {
    const btn = document.createElement('button');
    btn.style.cssText =
      `padding:18px 40px;font:bold 20px monospace;background:transparent;` +
      `color:${color};border:2px solid ${color};border-radius:6px;cursor:pointer;` +
      `letter-spacing:3px;transition:all 0.15s;display:flex;flex-direction:column;align-items:center;gap:8px`;

    const nameEl = document.createElement('span');
    nameEl.textContent = label;
    btn.appendChild(nameEl);

    const countEl = document.createElement('span');
    countEl.style.cssText = 'font-size:14px;opacity:0.7';
    countEl.textContent = `${initialCounts[team]} players`;
    btn.appendChild(countEl);
    countEls[team] = countEl;

    btn.addEventListener('mouseenter', () => {
      btn.style.background = color;
      btn.style.color = '#000';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.color = color;
    });

    btn.addEventListener('click', () => {
      overlay.remove();
      resolveTeam(team);
    });

    return btn;
  }

  teamRow.appendChild(createTeamButton(0, 'GREEN', '#00ff88'));
  teamRow.appendChild(createTeamButton(1, 'RED', '#ff4444'));
  overlay.appendChild(teamRow);

  document.body.appendChild(overlay);

  function updateCounts(counts: [number, number]): void {
    countEls[0].textContent = `${counts[0]} players`;
    countEls[1].textContent = `${counts[1]} players`;
  }

  return { element: overlay, updateCounts, teamSelected };
}
