import { SCOREBOARD_SIZE, type PlayerState } from '@x-drift/shared';
import { teamColors } from './ship';

// ---- DOM setup ----

const TEAM_CSS_COLORS = teamColors.map(c => `#${c.primary.toString(16).padStart(6, '0')}`);

const container = document.createElement('div');
container.style.cssText =
  'position:fixed;top:28px;left:8px;z-index:1000;pointer-events:none;' +
  'background:rgba(0,0,0,0.7);padding:8px 12px;border-radius:4px;' +
  'font:12px monospace;color:#ccc;min-width:220px;display:none';
document.body.appendChild(container);

export { container as scoreboardContainer };

const headerEl = document.createElement('div');
headerEl.style.cssText = 'color:#0f0;margin-bottom:6px;font-weight:bold';
container.appendChild(headerEl);

const teamSummaryEl = document.createElement('div');
teamSummaryEl.style.cssText = 'margin-bottom:6px';
container.appendChild(teamSummaryEl);

const tableEl = document.createElement('div');
container.appendChild(tableEl);

// ---- Update function ----

export function updateScoreboard(
  players: PlayerState[],
  myPlayerId: string | null,
): void {
  // Sort by kills descending, then by deaths ascending as tiebreaker
  const sorted = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);

  const top = sorted.slice(0, SCOREBOARD_SIZE);

  const humanCount = players.filter((p) => !p.id.startsWith('npc-')).length;
  headerEl.textContent = `PLAYERS: ${humanCount}`;

  // Team aggregates
  const teamCount = [0, 0];
  const teamKills = [0, 0];
  const teamDeaths = [0, 0];
  for (const p of players) {
    const t = p.team;
    teamCount[t]++;
    teamKills[t] += p.kills;
    teamDeaths[t] += p.deaths;
  }

  teamSummaryEl.innerHTML =
    `<div style="display:flex;gap:6px;align-items:center">` +
    `<span style="color:${TEAM_CSS_COLORS[0]}">&#9679; GREEN (${teamCount[0]})</span>` +
    `<span style="color:#888">${teamKills[0]}K / ${teamDeaths[0]}D</span>` +
    `</div>` +
    `<div style="display:flex;gap:6px;align-items:center">` +
    `<span style="color:${TEAM_CSS_COLORS[1]}">&#9679; RED (${teamCount[1]})</span>` +
    `<span style="color:#888">${teamKills[1]}K / ${teamDeaths[1]}D</span>` +
    `</div>`;

  let html =
    '<div style="border-top:1px solid #444;padding-top:4px;margin-top:2px;display:flex;gap:8px;margin-bottom:4px;color:#888">' +
    '<span style="width:20px">#</span>' +
    '<span style="flex:1">ID</span>' +
    '<span style="width:32px;text-align:right">K</span>' +
    '<span style="width:32px;text-align:right">D</span>' +
    '</div>';

  for (let i = 0; i < top.length; i++) {
    const p = top[i];
    const isLocal = p.id === myPlayerId;
    const color = isLocal ? '#ffdd44' : '#ccc';
    const bg = isLocal ? 'rgba(255,221,68,0.1)' : 'transparent';
    const dot = `<span style="color:${TEAM_CSS_COLORS[p.team]}">&#9679;</span>`;
    html +=
      `<div style="display:flex;gap:8px;color:${color};background:${bg};padding:1px 0">` +
      `<span style="width:20px">${i + 1}</span>` +
      `<span style="flex:1">${dot} ${p.id}</span>` +
      `<span style="width:32px;text-align:right">${p.kills}</span>` +
      `<span style="width:32px;text-align:right">${p.deaths}</span>` +
      '</div>';
  }

  // If local player is not in top N, show them below a separator
  if (myPlayerId && !top.some((p) => p.id === myPlayerId)) {
    const me = sorted.find((p) => p.id === myPlayerId);
    if (me) {
      const rank = sorted.indexOf(me) + 1;
      const dot = `<span style="color:${TEAM_CSS_COLORS[me.team]}">&#9679;</span>`;
      html +=
        '<div style="border-top:1px solid #444;margin-top:4px;padding-top:4px;' +
        'display:flex;gap:8px;color:#ffdd44;background:rgba(255,221,68,0.1)">' +
        `<span style="width:20px">${rank}</span>` +
        `<span style="flex:1">${dot} ${me.id}</span>` +
        `<span style="width:32px;text-align:right">${me.kills}</span>` +
        `<span style="width:32px;text-align:right">${me.deaths}</span>` +
        '</div>';
    }
  }

  tableEl.innerHTML = html;
}
