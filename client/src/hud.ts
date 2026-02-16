import { MAX_HP, MAX_SPEED, type ActiveEffect } from '@x-drift/shared';

// ---- Shared style constants ----

const PANEL_BG = 'rgba(0,4,8,0.75)';
const BORDER_COLOR = 'rgba(0,255,136,0.3)';
const FONT = '12px monospace';
const DIM_GREEN = 'rgba(0,255,136,0.5)';

function panelStyle(extra: string): string {
  return (
    `position:absolute;padding:10px 14px;background:${PANEL_BG};` +
    `border:1px solid ${BORDER_COLOR};border-radius:4px;font:${FONT};` +
    `color:#ccc;pointer-events:none;text-shadow:0 0 4px rgba(0,255,136,0.3);${extra}`
  );
}

function headerEl(text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `color:${DIM_GREEN};font-size:10px;letter-spacing:2px;margin-bottom:8px`;
  el.textContent = `[ ${text} ]`;
  return el;
}

// ---- Root container ----

const hudContainer = document.createElement('div');
hudContainer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:100;display:none';
document.body.appendChild(hudContainer);

// ===========================================================================
// LEFT PANEL — Hull Integrity
// ===========================================================================

const hullPanel = document.createElement('div');
hullPanel.style.cssText = panelStyle('bottom:20px;left:20px;width:200px');
hullPanel.appendChild(headerEl('HULL INTEGRITY'));
hudContainer.appendChild(hullPanel);

// HP segments
const segRow = document.createElement('div');
segRow.style.cssText = 'display:flex;gap:4px;margin-bottom:6px';
hullPanel.appendChild(segRow);

const segments: HTMLDivElement[] = [];
for (let i = 0; i < MAX_HP; i++) {
  const seg = document.createElement('div');
  seg.style.cssText = 'width:36px;height:14px;border-radius:2px';
  segRow.appendChild(seg);
  segments.push(seg);
}

const hpReadout = document.createElement('div');
hpReadout.style.cssText = 'font-size:14px;font-weight:bold';
hullPanel.appendChild(hpReadout);

function hpColor(hp: number): string {
  if (hp >= 4) return '#00ff88';
  if (hp === 3) return '#aaff00';
  if (hp === 2) return '#ff8800';
  return '#ff2200';
}

function updateHull(hp: number): void {
  const color = hpColor(hp);
  const dimBg = 'rgba(255,255,255,0.08)';

  // Blink logic for low HP
  let visible = true;
  if (hp === 1) {
    visible = Math.floor(Date.now() / 250) % 2 === 0;
  } else if (hp === 2) {
    visible = Math.floor(Date.now() / 500) % 2 === 0 || true; // pulse: always show but pulse opacity
  }

  for (let i = 0; i < MAX_HP; i++) {
    if (i < hp) {
      segments[i].style.background = color;
      segments[i].style.opacity = hp === 1 && !visible ? '0.3' : '1';
    } else {
      segments[i].style.background = dimBg;
      segments[i].style.opacity = '1';
    }
  }

  hpReadout.style.color = color;
  hpReadout.textContent = `${hp}/${MAX_HP}`;
  if (hp === 1) {
    hpReadout.style.opacity = visible ? '1' : '0.3';
  } else {
    hpReadout.style.opacity = '1';
  }
}

// ===========================================================================
// LEFT PANEL (upper) — Active Effects
// ===========================================================================

const effectsPanel = document.createElement('div');
effectsPanel.style.cssText = panelStyle('bottom:160px;left:20px;width:200px;display:none');
effectsPanel.appendChild(headerEl('ACTIVE EFFECTS'));
hudContainer.appendChild(effectsPanel);

interface EffectRow {
  container: HTMLDivElement;
  label: HTMLSpanElement;
  countdown: HTMLSpanElement;
}

function createEffectRow(labelText: string, color: string): EffectRow {
  const container = document.createElement('div');
  container.style.cssText = 'display:none;align-items:center;gap:8px;margin-bottom:4px';

  const label = document.createElement('span');
  label.style.cssText = `color:${color};font-size:12px;font-weight:bold;width:28px`;
  label.textContent = labelText;
  container.appendChild(label);

  const countdown = document.createElement('span');
  countdown.style.cssText = `color:${color};font-size:12px`;
  container.appendChild(countdown);

  effectsPanel.appendChild(container);
  return { container, label, countdown };
}

const effectShieldRow = createEffectRow('SHD', '#4488ff');
const effectSpeedRow = createEffectRow('SPD', '#ffdd00');
const effectRapidFireRow = createEffectRow('RFR', '#ff4400');

function updateEffects(activeEffects: ActiveEffect[]): void {
  let anyActive = false;

  for (const entry of [
    { row: effectShieldRow, type: 'shield' },
    { row: effectSpeedRow, type: 'speed' },
    { row: effectRapidFireRow, type: 'rapidFire' },
  ]) {
    const effect = activeEffects.find((e) => e.type === entry.type);
    if (effect) {
      entry.row.container.style.display = 'flex';
      entry.row.countdown.textContent = `${Math.ceil(effect.remainingTime)}s`;
      anyActive = true;
    } else {
      entry.row.container.style.display = 'none';
    }
  }

  effectsPanel.style.display = anyActive ? '' : 'none';
}

// ===========================================================================
// RIGHT PANEL — Weapon Systems
// ===========================================================================

const weaponPanel = document.createElement('div');
weaponPanel.style.cssText = panelStyle('bottom:20px;right:20px;width:200px');
weaponPanel.appendChild(headerEl('WEAPON SYSTEMS'));
hudContainer.appendChild(weaponPanel);

// Heat bar container
const heatBarOuter = document.createElement('div');
heatBarOuter.style.cssText =
  'position:relative;width:160px;height:12px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-bottom:4px';
weaponPanel.appendChild(heatBarOuter);

// Heat bar fill
const heatFill = document.createElement('div');
heatFill.style.cssText = 'width:0%;height:100%;border-radius:2px';
heatBarOuter.appendChild(heatFill);

// Tick marks at 25/50/75%
for (const pct of [25, 50, 75]) {
  const tick = document.createElement('div');
  tick.style.cssText = `position:absolute;left:${pct}%;top:0;width:1px;height:100%;background:rgba(255,255,255,0.15)`;
  heatBarOuter.appendChild(tick);
}

// Heat readout
const heatReadout = document.createElement('div');
heatReadout.style.cssText = 'font-size:14px;font-weight:bold;margin-bottom:2px';
weaponPanel.appendChild(heatReadout);

// Overheat warning
const overheatWarning = document.createElement('div');
overheatWarning.style.cssText = 'font-size:11px;font-weight:bold;color:#ff0000;height:14px';
weaponPanel.appendChild(overheatWarning);

function heatColor(heat: number): string {
  if (heat <= 0.4) return '#88ccff';
  if (heat <= 0.7) return '#ffcc00';
  return '#ff4400';
}

function updateWeapons(heat: number, overheated: boolean): void {
  const pct = Math.min(100, Math.max(0, heat * 100));

  if (overheated) {
    const blink = Math.floor(Date.now() / 200) % 2 === 0;
    heatFill.style.width = `${pct}%`;
    heatFill.style.background = '#ff0000';
    heatFill.style.opacity = blink ? '1' : '0.3';
    heatReadout.style.color = '#ff0000';
    heatReadout.textContent = `${Math.round(pct)}%`;
    overheatWarning.textContent = '!! OVERHEATED !!';
    overheatWarning.style.opacity = blink ? '1' : '0.4';
  } else {
    const color = heatColor(heat);
    heatFill.style.width = `${pct}%`;
    heatFill.style.background = color;
    heatFill.style.opacity = '1';
    heatReadout.style.color = color;
    heatReadout.textContent = `${Math.round(pct)}%`;
    overheatWarning.textContent = '';
    overheatWarning.style.opacity = '1';
  }
}

// ===========================================================================
// CENTER PANEL — Flight Data
// ===========================================================================

const flightPanel = document.createElement('div');
flightPanel.style.cssText = panelStyle(
  'bottom:20px;left:50%;transform:translateX(-50%);width:260px',
);
flightPanel.appendChild(headerEl('FLIGHT DATA'));
hudContainer.appendChild(flightPanel);

// Speed row
const speedRow = document.createElement('div');
speedRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';
flightPanel.appendChild(speedRow);

const speedLabel = document.createElement('span');
speedLabel.style.cssText = `color:${DIM_GREEN};font-size:10px;width:28px`;
speedLabel.textContent = 'SPD';
speedRow.appendChild(speedLabel);

const speedBarOuter = document.createElement('div');
speedBarOuter.style.cssText =
  'width:120px;height:8px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden';
speedRow.appendChild(speedBarOuter);

const speedFill = document.createElement('div');
speedFill.style.cssText = 'width:0%;height:100%;border-radius:2px';
speedBarOuter.appendChild(speedFill);

const speedReadout = document.createElement('span');
speedReadout.style.cssText = 'font-size:12px;width:48px;text-align:right';
speedRow.appendChild(speedReadout);

function speedColor(ratio: number): string {
  if (ratio > 0.9) return '#ffcc00';
  if (ratio > 0.7) return '#aaff00';
  return '#00ff88';
}

// Coordinates row
const coordRow = document.createElement('div');
coordRow.style.cssText = 'display:flex;gap:12px;font-size:11px';
flightPanel.appendChild(coordRow);

const coordSpans: { label: HTMLSpanElement; value: HTMLSpanElement }[] = [];
for (const axis of ['X', 'Y', 'Z']) {
  const label = document.createElement('span');
  label.style.cssText = `color:${DIM_GREEN};font-size:10px`;
  label.textContent = axis;
  coordRow.appendChild(label);

  const value = document.createElement('span');
  value.style.cssText = 'color:#88aaff;width:42px;display:inline-block;text-align:right';
  coordRow.appendChild(value);

  coordSpans.push({ label, value });
}

function updateFlight(speed: number, x: number, y: number, z: number): void {
  const ratio = Math.min(1, speed / MAX_SPEED);
  const pct = ratio * 100;
  const color = speedColor(ratio);

  speedFill.style.width = `${pct}%`;
  speedFill.style.background = color;
  speedReadout.style.color = color;
  speedReadout.textContent = speed.toFixed(1);

  const coords = [x, y, z];
  for (let i = 0; i < 3; i++) {
    coordSpans[i].value.textContent = coords[i].toFixed(0);
  }
}

// ===========================================================================
// Public API
// ===========================================================================

function updateHud(
  hp: number,
  heat: number,
  overheated: boolean,
  speed: number,
  x: number,
  y: number,
  z: number,
  activeEffects: ActiveEffect[] = [],
): void {
  updateHull(hp);
  updateWeapons(heat, overheated);
  updateFlight(speed, x, y, z);
  updateEffects(activeEffects);
}

export { hudContainer, updateHud };
