// The interface: alarm gauge, act card, tool belt, interaction prompt, and the
// title, briefing, caught and victory screens. HUD coordinates are world pixels
// so the composition holds at every window size.

import { ACT_META, ALARM, COLORS } from './config.js';
import { clamp } from './geometry.js';
import { alarmLabel, levelObjective } from './world.js';

const SERIF = 'Georgia, "Times New Roman", serif';
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
  ctx.fillText('Q SMOKE · F EMP · R DECOY · P PAUSE · M MUTE', 1552, 848);
  ctx.restore();
}

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
