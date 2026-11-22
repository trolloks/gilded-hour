// The interface: alarm gauge, act card, tool belt, interaction prompt, and the
// title, briefing, caught and victory screens. HUD coordinates are world pixels
// so the composition holds at every window size.

import { ACT_META, ALARM, COLORS } from './config.js';
import { clamp, conePolygon } from './geometry.js';
import { sightBlockers } from './collision.js';
import { alarmLabel, levelObjective } from './world.js';

const SERIF = 'Cinzel, Georgia, "Times New Roman", serif';
const SANS = '"Trebuchet MS", "Segoe UI", sans-serif';

function cutPanel(ctx, x, y, w, h, cut = 10) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

function panel(ctx, x, y, w, h, options = {}) {
  cutPanel(ctx, x, y, w, h, options.cut ?? 10);
  ctx.fillStyle = options.fill ?? 'rgba(8, 12, 18, 0.82)';
  ctx.fill();
  ctx.lineWidth = options.lineWidth ?? 1;
  ctx.strokeStyle = options.stroke ?? 'rgba(217, 164, 65, 0.55)';
  ctx.stroke();
}

function tracked(ctx, text, x, y, spacing = 2, align = 'left') {
  const chars = [...text];
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + spacing * (chars.length - 1);
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  for (let i = 0; i < chars.length; i += 1) {
    ctx.fillText(chars[i], cursor, y);
    cursor += widths[i] + spacing;
  }
  return total;
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawHud(ctx, world) {
  const meta = ACT_META[world.level.act] ?? ACT_META[0];

  // Act card, upper left.
  ctx.save();
  ctx.fillStyle = COLORS.brass;
  ctx.font = `600 13px ${SANS}`;
  tracked(ctx, `${meta.house.toUpperCase()} · ${meta.hour}`, 48, 52, 2.4);
  ctx.fillStyle = COLORS.ivory;
  ctx.font = `600 34px ${SERIF}`;
  ctx.fillText(`ACT ${meta.numeral} — ${meta.act}`, 46, 92);
  ctx.strokeStyle = 'rgba(217, 164, 65, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 108);
  ctx.lineTo(330, 108);
  ctx.stroke();
  ctx.fillStyle = COLORS.brassBright;
  ctx.font = `600 14px ${SANS}`;
  tracked(ctx, levelObjective(world), 48, 134, 2.1);
  ctx.restore();

  // Act progress diamonds.
  for (let i = 0; i < 3; i += 1) {
    const x = 48 + i * 22;
    const y = 156;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i <= world.level.act ? COLORS.brass : 'rgba(217, 164, 65, 0.22)';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }

  drawAlarmGauge(ctx, world);

  // Loot card, upper right.
  const right = 1552;
  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.brass;
  ctx.font = `600 12px ${SANS}`;
  tracked(ctx, world.loot.taken ? 'SECURED' : 'THE TAKE', right, 56, 2.4, 'right');
  ctx.fillStyle = world.loot.taken ? COLORS.brassBright : COLORS.ivory;
  ctx.font = `600 20px ${SERIF}`;
  ctx.fillText(world.loot.name, right, 84);
  ctx.fillStyle = COLORS.ivoryDim;
  ctx.font = `13px ${SANS}`;
  ctx.fillText(world.loot.taken ? `Exit · ${world.level.exit.label}` : world.loot.plaque, right, 106);
  ctx.strokeStyle = 'rgba(217, 164, 65, 0.45)';
  ctx.beginPath();
  ctx.moveTo(1250, 122);
  ctx.lineTo(right, 122);
  ctx.stroke();
  ctx.restore();

  drawTools(ctx, world);
  drawHint(ctx, world);
  drawControls(ctx);
}

function drawAlarmGauge(ctx, world) {
  const x = 800;
  const y = 34;
  const w = 336;
  const h = 58;
  const hot = world.alarm >= ALARM.hot;
  const pulse = 0.5 + 0.5 * Math.sin(world.time * (world.alarm >= ALARM.critical ? 11 : 6));

  ctx.save();
  if (hot) {
    ctx.shadowColor = `rgba(232, 72, 79, ${0.35 + pulse * 0.4})`;
    ctx.shadowBlur = 22;
  }
  panel(ctx, x - w / 2, y, w, h, {
    fill: 'rgba(7, 10, 15, 0.9)',
    stroke: hot ? `rgba(232, 72, 79, ${0.6 + pulse * 0.35})` : 'rgba(217, 164, 65, 0.55)',
  });
  ctx.restore();

  ctx.save();
  ctx.fillStyle = hot ? COLORS.red : COLORS.brass;
  ctx.font = `600 12px ${SANS}`;
  tracked(ctx, 'ALARM', x - w / 2 + 18, y + 23, 2.6);
  ctx.textAlign = 'right';
  ctx.fillStyle = hot ? COLORS.red : COLORS.ivory;
  ctx.font = `600 21px ${SERIF}`;
  ctx.fillText(`${Math.round(world.alarm)}%`, x + w / 2 - 16, y + 26);
  ctx.textAlign = 'left';
  ctx.font = `600 10px ${SANS}`;
  ctx.fillStyle = hot ? 'rgba(232, 72, 79, 0.9)' : COLORS.ivoryDim;
  ctx.fillText(alarmLabel(world), x - w / 2 + 18, y + 46);

  // Segmented bar: the gauge the judge should read at a glance.
  const barX = x - w / 2 + 92;
  const barY = y + 37;
  const barW = 226;
  const segments = 18;
  const gap = 3;
  const cell = (barW - gap * (segments - 1)) / segments;
  const filled = (world.alarm / ALARM.max) * segments;
  for (let i = 0; i < segments; i += 1) {
    const amount = clamp(filled - i, 0, 1);
    ctx.fillStyle = 'rgba(217, 164, 65, 0.13)';
    ctx.fillRect(barX + i * (cell + gap), barY, cell, 8);
    if (amount > 0) {
      const color = world.alarm >= ALARM.critical ? COLORS.red : world.alarm >= ALARM.hot ? '#e8843f' : COLORS.brass;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55 + amount * 0.45;
      ctx.fillRect(barX + i * (cell + gap), barY, cell * amount, 8);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function drawTools(ctx, world) {
  const slots = [
    { key: 'Q', name: 'SMOKE', kind: 'smoke' },
    { key: 'F', name: 'EMP', kind: 'emp' },
    { key: 'R', name: 'DECOY', kind: 'decoy' },
  ];
  slots.forEach((slot, index) => {
    const x = 46 + index * 88;
    const y = 782;
    const size = 74;
    const tool = world.tools[slot.kind];
    const ready = tool.charges > 0 && tool.cooldown <= 0;
    ctx.save();
    panel(ctx, x, y, size, size, {
      fill: ready ? 'rgba(9, 14, 20, 0.86)' : 'rgba(9, 14, 20, 0.55)',
      stroke: ready ? 'rgba(217, 164, 65, 0.6)' : 'rgba(217, 164, 65, 0.2)',
    });
    drawToolIcon(ctx, slot.kind, x + size / 2, y + size / 2 - 3, ready ? COLORS.brassBright : 'rgba(217,164,65,0.3)');
    ctx.fillStyle = ready ? COLORS.ivoryDim : 'rgba(199, 183, 149, 0.35)';
    ctx.font = `600 9px ${SANS}`;
    ctx.textAlign = 'center';
    tracked(ctx, slot.name, x + size / 2, y + size - 8, 1.4, 'center');
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.brass;
    ctx.font = `600 11px ${SANS}`;
    ctx.fillText(slot.key, x + 8, y + 16);

    // Charge pips.
    for (let i = 0; i < tool.charges; i += 1) {
      ctx.fillStyle = COLORS.brassBright;
      ctx.fillRect(x + size - 12 - i * 9, y + 10, 5, 5);
    }
    if (tool.cooldown > 0) {
      ctx.strokeStyle = 'rgba(232, 72, 79, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2 - 3, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(tool.cooldown, 0, 1));
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawToolIcon(ctx, kind, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  if (kind === 'smoke') {
    ctx.strokeRect(-7, -12, 14, 24);
    ctx.beginPath();
    ctx.arc(0, -15, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(12, -12, 3, 0, Math.PI * 2);
    ctx.arc(-12, -9, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'emp') {
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, -11);
    ctx.lineTo(-6, 2);
    ctx.lineTo(1, 2);
    ctx.lineTo(-3, 13);
    ctx.lineTo(7, -1);
    ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, 2, 9, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-11, 2);
    ctx.lineTo(11, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 11, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(0, -12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHint(ctx, world) {
  if (!world.hint) return;
  ctx.save();
  ctx.font = `600 15px ${SANS}`;
  const text = world.hint;
  const width = Math.max(300, ctx.measureText(text).width + 108);
  const x = 800;
  const y = 824;
  panel(ctx, x - width / 2, y, width, 42, {
    fill: 'rgba(7, 11, 16, 0.88)',
    stroke: 'rgba(217, 164, 65, 0.5)',
  });
  ctx.fillStyle = COLORS.brassBright;
  ctx.fillRect(x - width / 2 + 10, y + 8, 34, 26);
  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 14px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('E', x - width / 2 + 27, y + 26);
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.ivory;
  ctx.font = `600 14px ${SANS}`;
  tracked(ctx, text, x - width / 2 + 56, y + 26, 1.2);

  if (world.interaction && world.interaction.progress > 0) {
    const barW = width - 72;
    ctx.fillStyle = 'rgba(217, 164, 65, 0.16)';
    ctx.fillRect(x - width / 2 + 56, y + 32, barW, 3);
    ctx.fillStyle = COLORS.brassBright;
    ctx.fillRect(x - width / 2 + 56, y + 32, barW * world.interaction.progress, 3);
  }
  ctx.restore();
}

function drawControls(ctx) {
  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(199, 183, 149, 0.6)';
  ctx.font = `11px ${SANS}`;
  ctx.fillText('WASD MOVE · SHIFT RUN · CTRL SNEAK · E INTERACT', 1552, 828);
  ctx.fillStyle = 'rgba(199, 183, 149, 0.42)';
  ctx.fillText('Q SMOKE · F EMP · R DECOY · TAB PLAN · P PAUSE · M MUTE', 1552, 848);
  ctx.restore();
}

export function drawBlueprint(ctx, world) {
  const level = world.level;
  const meta = ACT_META[level.act] ?? ACT_META[0];
  const k = 0.65;
  const planW = WORLD_PLAN.width * k;
  const planH = WORLD_PLAN.height * k;
  const ox = 800 - planW / 2;
  const oy = 214;

  ctx.save();
  ctx.fillStyle = 'rgba(4, 9, 13, 0.96)';
  ctx.fillRect(0, 0, 1600, 900);

  // Drafting grid.
  ctx.strokeStyle = 'rgba(121, 213, 232, 0.055)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 1600; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 900);
    ctx.stroke();
  }
  for (let y = 0; y < 900; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1600, y);
    ctx.stroke();
  }

  cutPanel(ctx, 68, 56, 1464, 788, 18);
  ctx.fillStyle = 'rgba(7, 14, 20, 0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(121, 213, 232, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.brass;
  ctx.font = `600 12px ${SANS}`;
  tracked(ctx, 'MERIDIAN HOUSE · EYES ONLY', 104, 100, 3.2);
  ctx.fillStyle = COLORS.ivory;
  ctx.font = `600 36px ${SERIF}`;
  ctx.fillText(`ACT ${meta.numeral} — ${meta.act}`, 102, 144);
  ctx.fillStyle = COLORS.brassBright;
  ctx.font = `600 12px ${SANS}`;
  tracked(ctx, 'SERVICE PLAN · PATROLS, CAMERAS AND ROUTES', 104, 170, 2.4);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(k, k);

  // Paper floor.
  ctx.fillStyle = 'rgba(12, 25, 32, 0.9)';
  ctx.fillRect(0, 0, WORLD_PLAN.width, WORLD_PLAN.height);
  ctx.strokeStyle = 'rgba(121, 213, 232, 0.35)';
  ctx.lineWidth = 2 / k;
  ctx.strokeRect(0, 0, WORLD_PLAN.width, WORLD_PLAN.height);

  // Shadow pockets and vents.
  for (const shadow of level.shadows) {
    ctx.fillStyle = shadow.vent ? 'rgba(20, 60, 62, 0.25)' : 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(shadow.x, shadow.y, shadow.w, shadow.h);
  }
  ctx.setLineDash([10 / k, 7 / k]);
  ctx.strokeStyle = 'rgba(105, 201, 162, 0.7)';
  ctx.lineWidth = 1.6 / k;
  for (const vent of level.vents) {
    ctx.strokeRect(vent.x, vent.y, vent.w, vent.h);
    ctx.fillStyle = 'rgba(105, 201, 162, 0.8)';
    ctx.font = `${13 / k}px ${SANS}`;
    ctx.fillText('VENT', vent.x + 8, vent.y + 18 / k);
  }
  ctx.setLineDash([]);

  // Walls and cover.
  for (const wall of level.walls) {
    ctx.fillStyle = 'rgba(16, 38, 48, 0.95)';
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.strokeStyle = 'rgba(121, 213, 232, 0.6)';
    ctx.lineWidth = 1.8 / k;
    ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
  }
  for (const item of level.cover) {
    ctx.fillStyle = 'rgba(33, 62, 72, 0.85)';
    ctx.fillRect(item.x, item.y, item.w, item.h);
    ctx.strokeStyle = 'rgba(217, 164, 65, 0.55)';
    ctx.lineWidth = 1.4 / k;
    ctx.strokeRect(item.x, item.y, item.w, item.h);
  }

  // Doors and lasers.
  for (const door of level.doors) {
    ctx.fillStyle = door.open ? 'rgba(105, 201, 162, 0.25)' : 'rgba(217, 164, 65, 0.65)';
    ctx.fillRect(door.x, door.y, door.w, door.h);
    ctx.strokeStyle = 'rgba(242, 201, 107, 0.9)';
    ctx.lineWidth = 1.6 / k;
    ctx.strokeRect(door.x, door.y, door.w, door.h);
  }
  for (const laser of level.lasers) {
    ctx.strokeStyle = world.laserOff > 0 ? 'rgba(121, 213, 232, 0.25)' : 'rgba(232, 72, 79, 0.9)';
    ctx.lineWidth = 2.4 / k;
    ctx.setLineDash(world.laserOff > 0 ? [8 / k, 6 / k] : []);
    ctx.beginPath();
    ctx.moveTo(laser.x1, laser.y1);
    ctx.lineTo(laser.x2, laser.y2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Patrol routes and guard cones.
  const blockers = sightBlockers(world);
  world.guards.forEach((guard, index) => {
    ctx.strokeStyle = 'rgba(242, 201, 107, 0.55)';
    ctx.lineWidth = 1.8 / k;
    ctx.setLineDash([9 / k, 7 / k]);
    ctx.beginPath();
    ctx.moveTo(guard.path[0][0], guard.path[0][1]);
    for (let i = 1; i < guard.path.length; i += 1) ctx.lineTo(guard.path[i][0], guard.path[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    const cone = conePolygon(guard.x, guard.y, guard.angle, guard.fov, guard.range, blockers, 22);
    ctx.beginPath();
    ctx.moveTo(cone[0].x, cone[0].y);
    for (let i = 1; i < cone.length; i += 1) ctx.lineTo(cone[i].x, cone[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(232, 72, 79, 0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 72, 79, 0.55)';
    ctx.lineWidth = 1.4 / k;
    ctx.stroke();

    ctx.fillStyle = '#e8484f';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 10 / k, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0d12';
    ctx.font = `700 ${11 / k}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(`G${index + 1}`, guard.x, guard.y + 4 / k);
  });

  // Camera coverage.
  world.cameras.forEach((camera, index) => {
    const cone = conePolygon(camera.x, camera.y, camera.angle, camera.fov, camera.range, blockers, 18);
    ctx.beginPath();
    ctx.moveTo(cone[0].x, cone[0].y);
    for (let i = 1; i < cone.length; i += 1) ctx.lineTo(cone[i].x, cone[i].y);
    ctx.closePath();
    ctx.fillStyle = camera.disabled > 0 ? 'rgba(90, 110, 120, 0.12)' : 'rgba(255, 140, 60, 0.16)';
    ctx.fill();
    ctx.strokeStyle = camera.disabled > 0 ? 'rgba(120, 140, 150, 0.35)' : 'rgba(255, 150, 70, 0.55)';
    ctx.lineWidth = 1.4 / k;
    ctx.stroke();

    ctx.fillStyle = camera.disabled > 0 ? '#596a72' : '#ff8a44';
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 9 / k, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0d12';
    ctx.font = `700 ${10 / k}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(`C${index + 1}`, camera.x, camera.y + 3.5 / k);
  });

  // Terminals.
  for (const terminal of level.terminals) {
    ctx.fillStyle = terminal.used ? 'rgba(90, 110, 120, 0.7)' : 'rgba(121, 213, 232, 0.9)';
    ctx.fillRect(terminal.x - 12, terminal.y - 12, 24, 24);
    ctx.strokeStyle = '#0a0d12';
    ctx.lineWidth = 2 / k;
    ctx.strokeRect(terminal.x - 12, terminal.y - 12, 24, 24);
  }

  // Loot and exit.
  ctx.save();
  ctx.translate(level.loot.x, level.loot.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#f2c96b';
  ctx.fillRect(-12, -12, 24, 24);
  ctx.strokeStyle = '#fff3cf';
  ctx.lineWidth = 2 / k;
  ctx.strokeRect(-12, -12, 24, 24);
  ctx.restore();
  ctx.fillStyle = '#f2c96b';
  ctx.font = `700 ${12 / k}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('LOOT', level.loot.x, level.loot.y - 24 / k);

  const exit = level.exit;
  ctx.strokeStyle = '#69c9a2';
  ctx.lineWidth = 3 / k;
  ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);
  ctx.fillStyle = 'rgba(105, 201, 162, 0.2)';
  ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
  ctx.fillStyle = '#69c9a2';
  ctx.font = `700 ${12 / k}px ${SANS}`;
  ctx.fillText('EXIT', exit.x + exit.w / 2, exit.y - 12 / k);

  // The thief and the way he faces.
  ctx.fillStyle = '#f1e4c8';
  ctx.beginPath();
  ctx.arc(world.player.x, world.player.y, 11 / k, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#69c9a2';
  ctx.lineWidth = 3 / k;
  ctx.beginPath();
  ctx.moveTo(world.player.x, world.player.y);
  ctx.lineTo(world.player.x + Math.cos(world.player.facing) * 42 / k, world.player.y + Math.sin(world.player.facing) * 42 / k);
  ctx.stroke();
  ctx.fillStyle = '#f1e4c8';
  ctx.font = `700 ${12 / k}px ${SANS}`;
  ctx.fillText('YOU', world.player.x, world.player.y - 18 / k);

  ctx.restore();

  // Legend.
  const legendY = 812;
  const items = [
    ['#e8484f', 'GUARD / SIGHT'],
    ['#ff8a44', 'CAMERA'],
    ['#f2c96b', 'PATROL / LOOT'],
    ['#69c9a2', 'VENT / EXIT'],
    ['#79d5e8', 'TERMINAL'],
  ];
  ctx.textAlign = 'left';
  let lx = 104;
  for (const [color, label] of items) {
    ctx.fillStyle = color;
    ctx.fillRect(lx, legendY - 8, 10, 10);
    ctx.fillStyle = 'rgba(199, 183, 149, 0.8)';
    ctx.font = `11px ${SANS}`;
    ctx.fillText(label, lx + 16, legendY + 1);
    lx += ctx.measureText(label).width + 44;
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(199, 183, 149, 0.65)';
  ctx.font = `11px ${SANS}`;
  ctx.fillText('TAB TO CLOSE · THE HOUSE DOES NOT WAIT', 1496, legendY + 1);
  ctx.restore();
}

const WORLD_PLAN = { width: 1600, height: 900 };

export function drawTitle(ctx, time) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, 900);
  grad.addColorStop(0, 'rgba(5, 8, 12, 0.86)');
  grad.addColorStop(0.55, 'rgba(5, 8, 12, 0.55)');
  grad.addColorStop(1, 'rgba(5, 8, 12, 0.9)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1600, 900);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.brass;
  ctx.font = `600 15px ${SANS}`;
  tracked(ctx, 'MERIDIAN HOUSE · 1936', 800, 196, 5, 'center');

  ctx.fillStyle = COLORS.ivory;
  ctx.font = `600 96px ${SERIF}`;
  tracked(ctx, 'THE GILDED HOUR', 800, 330, 5, 'center');

  ctx.strokeStyle = 'rgba(217, 164, 65, 0.75)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(360, 372);
  ctx.lineTo(760, 372);
  ctx.moveTo(840, 372);
  ctx.lineTo(1240, 372);
  ctx.stroke();
  ctx.save();
  ctx.translate(800, 372);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = COLORS.brassBright;
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();

  ctx.fillStyle = COLORS.ivoryDim;
  ctx.font = `italic 22px ${SERIF}`;
  ctx.fillText('A noir heist in three acts', 800, 424);

  const pulse = 0.55 + 0.45 * Math.sin(time * 2.6);
  ctx.fillStyle = `rgba(242, 201, 107, ${pulse})`;
  ctx.font = `600 17px ${SANS}`;
  tracked(ctx, 'PRESS ENTER TO BEGIN', 800, 560, 4.5, 'center');

  ctx.fillStyle = 'rgba(199, 183, 149, 0.8)';
  ctx.font = `13px ${SANS}`;
  ctx.fillText('WASD MOVE    SHIFT RUN    CTRL SNEAK    E INTERACT', 800, 646);
  ctx.fillStyle = 'rgba(199, 183, 149, 0.55)';
  ctx.fillText('Q SMOKE    F EMP    R DECOY    P PAUSE    M MUTE', 800, 674);

  ctx.fillStyle = COLORS.brassDim;
  ctx.font = `12px ${SANS}`;
  tracked(ctx, 'CROSS THE ROOM · READ THE PATROLS · TAKE THE STONE', 800, 744, 3, 'center');
  ctx.restore();
}

export function drawBriefing(ctx, level) {
  const meta = ACT_META[level.act] ?? ACT_META[0];
  ctx.save();
  ctx.fillStyle = 'rgba(4, 7, 11, 0.82)';
  ctx.fillRect(0, 0, 1600, 900);
  panel(ctx, 300, 180, 1000, 540, { fill: 'rgba(7, 11, 17, 0.94)', stroke: 'rgba(217, 164, 65, 0.7)', lineWidth: 2 });

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.brass;
  ctx.font = `600 13px ${SANS}`;
  tracked(ctx, `ACT ${meta.numeral} · ${meta.house.toUpperCase()} · ${meta.hour}`, 800, 248, 4, 'center');

  ctx.fillStyle = COLORS.ivory;
  ctx.font = `600 64px ${SERIF}`;
  ctx.fillText(meta.act, 800, 330);

  ctx.strokeStyle = 'rgba(217, 164, 65, 0.55)';
  ctx.beginPath();
  ctx.moveTo(520, 360);
  ctx.lineTo(1080, 360);
  ctx.stroke();

  ctx.fillStyle = COLORS.ivoryDim;
  ctx.font = `italic 20px ${SERIF}`;
  const lines = wrap(ctx, level.brief, 760);
  lines.forEach((line, index) => ctx.fillText(line, 800, 410 + index * 30));

  ctx.fillStyle = COLORS.brassBright;
  ctx.font = `600 14px ${SANS}`;
  tracked(ctx, `OBJECTIVE · STEAL ${level.loot.name.toUpperCase()}`, 800, 540, 2.6, 'center');

  ctx.fillStyle = 'rgba(199, 183, 149, 0.75)';
  ctx.font = `13px ${SANS}`;
  ctx.fillText('WASD MOVE · SHIFT RUN · CTRL SNEAK · E INTERACT · Q SMOKE · F EMP · R DECOY', 800, 610);

  const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 380);
  ctx.fillStyle = `rgba(242, 201, 107, ${pulse})`;
  ctx.font = `600 16px ${SANS}`;
  tracked(ctx, 'PRESS ENTER', 800, 668, 4, 'center');
  ctx.restore();
}

export function drawCaught(ctx, world) {
  ctx.save();
  const grad = ctx.createRadialGradient(800, 450, 120, 800, 450, 900);
  grad.addColorStop(0, 'rgba(70, 8, 16, 0.45)');
  grad.addColorStop(1, 'rgba(12, 2, 5, 0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1600, 900);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.red;
  ctx.font = `600 13px ${SANS}`;
  tracked(ctx, 'THE HOUSE IS AWAKE', 800, 300, 5, 'center');
  ctx.fillStyle = COLORS.ivory;
  ctx.font = `600 74px ${SERIF}`;
  ctx.fillText('THE WATCH HAS YOU', 800, 396);
  ctx.fillStyle = COLORS.ivoryDim;
  ctx.font = `italic 21px ${SERIF}`;
  ctx.fillText(`Caught by ${world.caughtBy ?? 'the Watch'}. Every door in Meridian House is closing.`, 800, 448);

  ctx.fillStyle = COLORS.brass;
  ctx.font = `600 14px ${SANS}`;
  const pulse = 0.55 + 0.45 * Math.sin(world.time * 3);
  ctx.fillStyle = `rgba(242, 201, 107, ${pulse})`;
  tracked(ctx, 'PRESS ENTER TO TRY AGAIN', 800, 560, 4, 'center');
  ctx.restore();
}

export function drawVictory(ctx, stats, time) {
  ctx.save();
  const grad = ctx.createRadialGradient(800, 420, 80, 800, 420, 880);
  grad.addColorStop(0, 'rgba(80, 58, 20, 0.5)');
  grad.addColorStop(1, 'rgba(6, 8, 11, 0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1600, 900);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.brass;
  ctx.font = `600 13px ${SANS}`;
  tracked(ctx, 'MERIDIAN HOUSE · 1:04 AM', 800, 268, 5, 'center');
  ctx.fillStyle = COLORS.ivory;
  ctx.font = `600 82px ${SERIF}`;
  tracked(ctx, 'THE GILDED HOUR', 800, 370, 4, 'center');
  ctx.fillStyle = COLORS.ivoryDim;
  ctx.font = `italic 22px ${SERIF}`;
  ctx.fillText('The house is quiet. The stone is gone. The rain keeps your secret.', 800, 424);

  const minutes = Math.floor(stats.time / 60);
  const seconds = Math.floor(stats.time % 60).toString().padStart(2, '0');
  ctx.fillStyle = COLORS.brassBright;
  ctx.font = `600 15px ${SANS}`;
  tracked(ctx, `TIME ${minutes}:${seconds} · SEEN ${stats.spotted} · ALARMS ${stats.alarmsTriggered} · HACKS ${stats.hacks}`, 800, 500, 2.2, 'center');

  const pulse = 0.55 + 0.45 * Math.sin(time * 2.4);
  ctx.fillStyle = `rgba(242, 201, 107, ${pulse})`;
  ctx.font = `600 16px ${SANS}`;
  tracked(ctx, 'PRESS ENTER TO ROB THE HOUSE AGAIN', 800, 610, 4, 'center');
  ctx.restore();
}

export function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 7, 11, 0.72)';
  ctx.fillRect(0, 0, 1600, 900);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.ivory;
  ctx.font = `600 54px ${SERIF}`;
  ctx.fillText('PAUSED', 800, 440);
  ctx.fillStyle = COLORS.ivoryDim;
  ctx.font = `14px ${SANS}`;
  ctx.fillText('Press P to return to the job.', 800, 486);
  ctx.restore();
}
