export function showWelcomeScreen(): Promise<void> {
  return new Promise((resolve) => {
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

    // Play button
    const playBtn = document.createElement('button');
    playBtn.textContent = 'PLAY';
    playBtn.style.cssText =
      'margin-top:40px;padding:14px 48px;font:bold 22px monospace;' +
      'background:transparent;color:#00ff88;border:2px solid #00ff88;' +
      'border-radius:6px;cursor:pointer;letter-spacing:4px;transition:all 0.15s';

    playBtn.addEventListener('mouseenter', () => {
      playBtn.style.background = '#00ff88';
      playBtn.style.color = '#000';
    });
    playBtn.addEventListener('mouseleave', () => {
      playBtn.style.background = 'transparent';
      playBtn.style.color = '#00ff88';
    });

    playBtn.addEventListener('click', () => {
      overlay.remove();
      resolve();
    });

    overlay.appendChild(playBtn);
    document.body.appendChild(overlay);
  });
}
