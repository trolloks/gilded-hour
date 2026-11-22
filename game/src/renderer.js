// The painter. A static layer holds the floor, walls, light pools and furniture
// for the act; each frame adds sight cones, people, loot, smoke and the HUD.
// Everything is drawn from scratch, so the game loads no images or fonts.

import { COLORS, WORLD } from './config.js';
import { clamp, conePolygon, hash01 } from './geometry.js';
import { inVent, sightBlockers } from './collision.js';
import { drawBriefing, drawCaught, drawHud, drawPause, drawTitle, drawVictory } from './hud.js';
import { guardMood } from './guards.js';

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Trebuchet MS", "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const staticCanvas = document.createElement('canvas');
  staticCanvas.width = WORLD.width;
  staticCanvas.height = WORLD.height;
  const sctx = staticCanvas.getContext('2d');

  let dpr = 1;
  let cssWidth = 0;
  let cssHeight = 0;
  let stage = { scale: 1, ox: 0, oy: 0 };
  let builtLevel = null;
  let grainPattern = null;

  function makeGrain() {
    const size = 140;
    const grain = document.createElement('canvas');
    grain.width = size;
    grain.height = size;
    const gctx = grain.getContext('2d');
    const image = gctx.createImageData(size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = Math.floor(hash01(i * 0.73) * 255);
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 18;
    }
    gctx.putImageData(image, 0, 0);
    grainPattern = ctx.createPattern(grain, 'repeat');
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cssWidth = window.innerWidth;
    cssHeight = window.innerHeight;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const scale = Math.min(cssWidth / WORLD.width, cssHeight / WORLD.height);
    stage = {
      scale,
      ox: (cssWidth - WORLD.width * scale) / 2,
      oy: (cssHeight - WORLD.height * scale) / 2,
    };
    if (!grainPattern) makeGrain();
  }

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - stage.ox) / stage.scale,
      y: (clientY - rect.top - stage.oy) / stage.scale,
    };
  }

  function worldTransform() {
    ctx.setTransform(dpr * stage.scale, 0, 0, dpr * stage.scale, dpr * stage.ox, dpr * stage.oy);
  }

  function build(level) {
    builtLevel = level.id;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, WORLD.width, WORLD.height);
    sctx.fillStyle = level.palette.floor;
    sctx.fillRect(0, 0, WORLD.width, WORLD.height);

    drawFloor(sctx, level);
    drawCarpet(sctx, level);
    drawLightPools(sctx, level);
    drawShadowZones(sctx, level);
    drawWalls(sctx, level);
    drawVents(sctx, level);
    drawCover(sctx, level);
    drawDecor(sctx, level);
    drawFloorMarks(sctx, level);
    drawRainPanes(sctx, level);
  }

  function draw(world, screen, time, stats) {
    if (builtLevel !== world.level.id) build(world.level);
    if (canvas.width === 0 || cssWidth === 0) resize();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    worldTransform();
    ctx.drawImage(staticCanvas, 0, 0, WORLD.width, WORLD.height);

    drawDoors(ctx, world);
    drawTerminals(ctx, world);
    drawLasers(ctx, world, time);
    drawExit(ctx, world, time);
    drawLoot(ctx, world, time);
    drawCones(ctx, world);
    drawCameras(ctx, world);
    drawGuards(ctx, world);
    drawPlayer(ctx, world);
    drawSmoke(ctx, world);
    drawParticles(ctx, world, time);
    drawRain(ctx, world, time);

    if (screen === 'play' || screen === 'paused') drawHud(ctx, world);
    if (screen === 'paused') drawPause(ctx);
    if (screen === 'caught') drawCaught(ctx, world);
    if (screen === 'victory') drawVictory(ctx, stats ?? world.stats, time);

    drawAtmosphere(ctx, world);
    if (screen === 'title') drawTitle(ctx, time);
    if (screen === 'briefing') drawBriefing(ctx, world.level);
  }

  function drawAtmosphere(context, world) {
    // Vignette.
    const gradient = context.createRadialGradient(800, 440, 260, 800, 440, 940);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.62, 'rgba(0, 0, 0, 0.18)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, WORLD.width, WORLD.height);

    if (grainPattern) {
      context.save();
      context.globalAlpha = 0.55;
      context.fillStyle = grainPattern;
      context.fillRect(0, 0, WORLD.width, WORLD.height);
      context.restore();
    }

    if (world.flashRed > 0) {
      context.fillStyle = `rgba(180, 20, 36, ${world.flashRed * 0.26})`;
      context.fillRect(0, 0, WORLD.width, WORLD.height);
    }
    if (world.flashGold > 0) {
      context.fillStyle = `rgba(242, 201, 107, ${world.flashGold * 0.16})`;
      context.fillRect(0, 0, WORLD.width, WORLD.height);
    }

    if (world.alarm >= 62 && world.phase === 'play') {
      const pulse = 0.4 + 0.6 * Math.sin(world.time * (world.alarm >= 84 ? 9 : 5));
      context.save();
      context.strokeStyle = `rgba(232, 72, 79, ${0.1 + pulse * 0.18})`;
      context.lineWidth = 10;
      context.strokeRect(4, 4, WORLD.width - 8, WORLD.height - 8);
      context.restore();
    }
  }

  resize();
  window.addEventListener('resize', resize);

  return { draw, toWorld, resize };
}

// ---------------------------------------------------------------------------
// Static layer

function drawFloor(ctx, level) {
  const { palette, decor } = level;
  const base = ctx.createRadialGradient(800, 420, 80, 800, 450, 980);
  base.addColorStop(0, lighten(palette.floor, 14));
  base.addColorStop(0.65, palette.floor);
  base.addColorStop(1, palette.floorAlt);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  if (decor === 'atrium') {
    const size = 80;
    for (let row = 0; row < 12; row += 1) {
      for (let col = 0; col < 20; col += 1) {
        const x = 40 + col * size;
        const y = 36 + row * size;
        if (x > 1560 || y > 864) continue;
        const shade = hash01(row * 31 + col * 7);
        ctx.fillStyle = shade > 0.5 ? `rgba(255,255,255,${0.012 + shade * 0.012})` : `rgba(0,0,0,${0.02 + shade * 0.02})`;
        ctx.fillRect(x, y, size, size);
        ctx.strokeStyle = 'rgba(217, 164, 65, 0.055)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, size, size);
      }
    }
    // A brass compass in the centre of the hall.
    ctx.save();
    ctx.translate(800, 500);
    ctx.strokeStyle = 'rgba(217, 164, 65, 0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      ctx.save();
      ctx.rotate((Math.PI * 2 * i) / 8);
      ctx.beginPath();
      ctx.moveTo(0, -86);
      ctx.lineTo(8, -66);
      ctx.lineTo(0, -54);
      ctx.lineTo(-8, -66);
      ctx.closePath();
      ctx.fillStyle = 'rgba(217, 164, 65, 0.13)';
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  if (decor === 'archive') {
    const plank = 34;
    for (let row = 0; row < 26; row += 1) {
      const y = 36 + row * plank;
      const shade = hash01(row * 13.7);
      ctx.fillStyle = `rgba(${shade > 0.5 ? '255,240,210' : '0,0,0'},${0.012 + shade * 0.014})`;
      ctx.fillRect(36, y, 1528, plank);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath();
      ctx.moveTo(36, y + 0.5);
      ctx.lineTo(1564, y + 0.5);
      ctx.stroke();
    }
    for (let i = 0; i < 40; i += 1) {
      const x = 60 + hash01(i * 3.3) * 1480;
      const y = 60 + hash01(i * 9.1) * 780;
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.045)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30 + hash01(i) * 60, y + 4);
      ctx.stroke();
    }
  }

  if (decor === 'vault') {
    const size = 120;
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 14; col += 1) {
        const x = 36 + col * size;
        const y = 36 + row * size;
        if (x > 1564 || y > 864) continue;
        ctx.strokeStyle = 'rgba(120, 150, 160, 0.07)';
        ctx.strokeRect(x + 0.5, y + 0.5, size, size);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.012)';
        ctx.fillRect(x + 4, y + 4, size - 8, 2);
      }
    }
    // Hazard chevrons around the vault door approach.
    ctx.save();
    ctx.globalAlpha = 0.13;
    for (let i = 0; i < 7; i += 1) {
      ctx.fillStyle = i % 2 ? '#d9a441' : '#0a0d12';
      ctx.beginPath();
      ctx.moveTo(700 + i * 18, 780);
      ctx.lineTo(716 + i * 18, 780);
      ctx.lineTo(726 + i * 18, 796);
      ctx.lineTo(710 + i * 18, 796);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawCarpet(ctx, level) {
  const { palette, decor } = level;
  if (decor === 'atrium') {
    ctx.save();
    ctx.fillStyle = palette.carpet;
    ctx.fillRect(724, 190, 152, 640);
    ctx.strokeStyle = 'rgba(217, 164, 65, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(730, 196, 140, 628);
    ctx.strokeStyle = 'rgba(217, 164, 65, 0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(740, 206, 120, 608);
    for (let y = 220; y < 800; y += 64) {
      ctx.save();
      ctx.translate(800, y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.2)';
      ctx.strokeRect(-13, -13, 26, 26);
      ctx.restore();
    }
    ctx.restore();
  }
  if (decor === 'archive') {
    ctx.save();
    ctx.fillStyle = palette.carpet;
    ctx.fillRect(1160, 90, 390, 170);
    ctx.strokeStyle = 'rgba(217, 164, 65, 0.34)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1170, 100, 370, 150);
    ctx.restore();
  }
  if (decor === 'vault') {
    ctx.save();
    ctx.fillStyle = palette.carpet;
    ctx.fillRect(648, 300, 304, 236);
    ctx.strokeStyle = 'rgba(217, 164, 65, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(656, 308, 288, 220);
    ctx.restore();
  }
}

function drawLightPools(ctx, level) {
  const pools = [{ x: level.loot.x, y: level.loot.y, radius: 210, color: '217, 164, 65', alpha: 0.2 }];
  if (level.decor === 'atrium') {
    pools.push({ x: 800, y: 780, radius: 170, color: '217, 164, 65', alpha: 0.14 });
    pools.push({ x: 270, y: 250, radius: 150, color: '140, 200, 220', alpha: 0.12 });
    pools.push({ x: 1330, y: 250, radius: 150, color: '140, 200, 220', alpha: 0.12 });
  }
  if (level.decor === 'archive') {
    pools.push({ x: 620, y: 340, radius: 160, color: '242, 201, 107', alpha: 0.1 });
    pools.push({ x: 1320, y: 180, radius: 170, color: '242, 201, 107', alpha: 0.13 });
  }
  if (level.decor === 'vault') {
    pools.push({ x: 300, y: 350, radius: 150, color: '121, 213, 232', alpha: 0.1 });
    pools.push({ x: 800, y: 760, radius: 170, color: '217, 164, 65', alpha: 0.12 });
  }
  for (const pool of pools) {
    const gradient = ctx.createRadialGradient(pool.x, pool.y, 10, pool.x, pool.y, pool.radius);
    gradient.addColorStop(0, `rgba(${pool.color}, ${pool.alpha})`);
    gradient.addColorStop(0.55, `rgba(${pool.color}, ${pool.alpha * 0.35})`);
    gradient.addColorStop(1, `rgba(${pool.color}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShadowZones(ctx, level) {
  for (const zone of level.shadows) {
    if (zone.vent) continue;
    const gradient = ctx.createLinearGradient(zone.x, zone.y, zone.x + zone.w, zone.y + zone.h);
    gradient.addColorStop(0, 'rgba(2, 7, 10, 0.62)');
    gradient.addColorStop(1, 'rgba(2, 7, 10, 0.18)');
    ctx.fillStyle = gradient;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeStyle = 'rgba(121, 213, 232, 0.06)';
    ctx.setLineDash([4, 8]);
    ctx.strokeRect(zone.x + 1, zone.y + 1, zone.w - 2, zone.h - 2);
    ctx.setLineDash([]);
  }
}

function drawWalls(ctx, level) {
  const { palette } = level;
  for (const wall of level.walls) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 10;
    const gradient = ctx.createLinearGradient(0, wall.y, 0, wall.y + wall.h);
    gradient.addColorStop(0, palette.wallTop);
    gradient.addColorStop(0.22, palette.wall);
    gradient.addColorStop(1, darken(palette.wall, 18));
    ctx.fillStyle = gradient;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.restore();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
    ctx.strokeStyle = 'rgba(242, 201, 107, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (wall.w > wall.h) {
      ctx.moveTo(wall.x + 2, wall.y + 2);
      ctx.lineTo(wall.x + wall.w - 2, wall.y + 2);
    } else {
      ctx.moveTo(wall.x + 2, wall.y + 2);
      ctx.lineTo(wall.x + 2, wall.y + wall.h - 2);
    }
    ctx.stroke();

    // Art-deco seams.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    if (Math.max(wall.w, wall.h) > 50) {
      const step = 46;
      if (wall.w >= wall.h) {
        for (let x = wall.x + step; x < wall.x + wall.w; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, wall.y + 3);
          ctx.lineTo(x, wall.y + wall.h - 3);
          ctx.stroke();
        }
      } else {
        for (let y = wall.y + step; y < wall.y + wall.h; y += step) {
          ctx.beginPath();
          ctx.moveTo(wall.x + 3, y);
          ctx.lineTo(wall.x + wall.w - 3, y);
          ctx.stroke();
        }
      }
    }
  }
}

function drawVents(ctx, level) {
  for (const vent of level.vents) {
    ctx.save();
    ctx.fillStyle = 'rgba(2, 7, 9, 0.65)';
    ctx.fillRect(vent.x, vent.y, vent.w, vent.h);
    ctx.strokeStyle = 'rgba(121, 213, 232, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vent.x + 1, vent.y + 1, vent.w - 2, vent.h - 2);
    const horizontal = vent.w > vent.h;
    const count = Math.floor((horizontal ? vent.w : vent.h) / 18);
    for (let i = 1; i < count; i += 1) {
      ctx.strokeStyle = 'rgba(160, 190, 196, 0.12)';
      ctx.beginPath();
      if (horizontal) {
        const x = vent.x + i * 18;
        ctx.moveTo(x, vent.y + 4);
        ctx.lineTo(x, vent.y + vent.h - 4);
      } else {
        const y = vent.y + i * 18;
        ctx.moveTo(vent.x + 4, y);
        ctx.lineTo(vent.x + vent.w - 4, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(121, 213, 232, 0.28)';
    ctx.font = `600 9px ${SANS}`;
    ctx.save();
    ctx.translate(vent.x + vent.w / 2, vent.y + vent.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(vent.label, 0, 0);
    ctx.restore();
    ctx.restore();
  }
}

function drawCover(ctx, level) {
  for (const item of level.cover) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 8;

    if (item.kind === 'column') {
      ctx.fillStyle = 'rgba(17, 25, 32, 0.95)';
      ctx.beginPath();
      ctx.arc(item.x + item.w / 2, item.y + item.h / 2, item.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(item.x + item.w / 2, item.y + item.h / 2, item.w / 2 - 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
      for (let i = 0; i < 4; i += 1) {
        const a = (Math.PI / 2) * i + 0.4;
        ctx.beginPath();
        ctx.moveTo(item.x + item.w / 2 + Math.cos(a) * 8, item.y + item.h / 2 + Math.sin(a) * 8);
        ctx.lineTo(item.x + item.w / 2 + Math.cos(a) * 26, item.y + item.h / 2 + Math.sin(a) * 26);
        ctx.stroke();
      }
    } else if (item.kind === 'plinth') {
      ctx.fillStyle = '#2a261f';
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.fillStyle = 'rgba(217, 164, 65, 0.5)';
      ctx.fillRect(item.x, item.y, item.w, 4);
      ctx.restore();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.strokeRect(item.x + 0.5, item.y + 0.5, item.w - 1, item.h - 1);
    } else if (item.kind === 'case') {
      ctx.fillStyle = 'rgba(20, 38, 46, 0.8)';
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(121, 213, 232, 0.28)';
      ctx.strokeRect(item.x + 3, item.y + 3, item.w - 6, item.h - 6);
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(item.x + 1, item.y + 1, item.w - 2, item.h - 2);
      ctx.fillStyle = 'rgba(242, 201, 107, 0.18)';
      ctx.fillRect(item.x + 8, item.y + 8, item.w - 16, 3);
    } else if (item.kind === 'bench') {
      ctx.fillStyle = '#5a1d25';
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.45)';
      ctx.strokeRect(item.x + 1, item.y + 1, item.w - 2, item.h - 2);
      for (let x = item.x + 12; x < item.x + item.w; x += 24) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(x, item.y + 5, 1, item.h - 10);
      }
    } else if (item.kind === 'desk') {
      ctx.fillStyle = '#2c241c';
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.34)';
      ctx.strokeRect(item.x + 1, item.y + 1, item.w - 2, item.h - 2);
      ctx.fillStyle = 'rgba(241, 228, 200, 0.22)';
      ctx.fillRect(item.x + 12, item.y + 10, item.w * 0.4, 3);
      ctx.fillRect(item.x + 12, item.y + 18, item.w * 0.28, 2);
    } else if (item.kind === 'cabinet') {
      ctx.fillStyle = '#241f19';
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(201, 160, 90, 0.3)';
      ctx.strokeRect(item.x + 1, item.y + 1, item.w - 2, item.h - 2);
      for (let i = 1; i < 4; i += 1) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(item.x + (item.w * i) / 4, item.y + 4, 1, item.h - 8);
      }
    } else if (item.kind === 'crate') {
      ctx.fillStyle = '#332819';
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.3)';
      ctx.strokeRect(item.x + 2, item.y + 2, item.w - 4, item.h - 4);
      ctx.beginPath();
      ctx.moveTo(item.x + 4, item.y + 4);
      ctx.lineTo(item.x + item.w - 4, item.y + item.h - 4);
      ctx.moveTo(item.x + item.w - 4, item.y + 4);
      ctx.lineTo(item.x + 4, item.y + item.h - 4);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawDecor(ctx, level) {
  const { palette, decor } = level;

  if (decor === 'atrium') {
    for (const [x, y] of [[300, 512], [1300, 512]]) {
      drawChandelier(ctx, x, y, palette);
    }

    // Red rope and brass stanchions in front of the plinth.
    for (const x of [728, 872]) {
      ctx.fillStyle = '#8a6526';
      ctx.fillRect(x - 4, 186, 8, 26);
      ctx.fillStyle = '#f2c96b';
      ctx.beginPath();
      ctx.arc(x, 184, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(160, 35, 45, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(728, 196);
    ctx.quadraticCurveTo(800, 216, 872, 196);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(242, 201, 107, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Sconces along the outer walls.
    for (const [x, y, angle] of [[36, 330, 0], [36, 610, 0], [1564, 330, Math.PI], [1564, 610, Math.PI]]) {
      drawSconce(ctx, x, y, angle);
    }

    // Small framed oils on the gallery walls.
    for (const [x, y] of [[402, 390], [402, 630], [1198, 390], [1198, 630]]) {
      ctx.fillStyle = 'rgba(217, 164, 65, 0.45)';
      ctx.fillRect(x - 6, y - 14, 12, 28);
      ctx.fillStyle = 'rgba(60, 82, 88, 0.8)';
      ctx.fillRect(x - 3, y - 10, 6, 20);
    }
  }

  if (decor === 'archive') {
    // Books on every long shelf wall.
    for (const wall of level.walls) {
      if (wall.w < 300 || wall.h > 32) continue;
      for (let x = wall.x + 8; x < wall.x + wall.w - 8; x += 7) {
        const seed = hash01(x * 0.37 + wall.y);
        const height = 10 + Math.floor(seed * 9);
        const hue = Math.floor(hash01(x * 1.13 + wall.y * 0.7) * 4);
        const colors = ['#6b3a2e', '#3c4f43', '#4e3b5c', '#6a5428'];
        ctx.fillStyle = colors[hue];
        ctx.globalAlpha = 0.72;
        ctx.fillRect(x, wall.y + wall.h - height - 4, 5, height);
        ctx.globalAlpha = 1;
      }
    }
    // Banker lamps on the reading desks.
    for (const [x, y] of [[520, 196], [820, 196], [1250, 716]]) {
      drawBankerLamp(ctx, x, y);
    }
    // Card catalogue labels.
    ctx.fillStyle = 'rgba(217, 164, 65, 0.4)';
    ctx.font = `600 8px ${SANS}`;
    ctx.fillText('A—M', 996, 786);
    ctx.fillText('N—Z', 1050, 786);
  }

  if (decor === 'vault') {
    // Safety-deposit boxes along the two service bay walls.
    for (const [x, y] of [[268, 280], [1342, 280]]) {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          ctx.fillStyle = 'rgba(120, 96, 48, 0.55)';
          ctx.fillRect(x + col * 14, y + row * 18, 11, 13);
          ctx.strokeStyle = 'rgba(242, 201, 107, 0.35)';
          ctx.strokeRect(x + col * 14 + 0.5, y + row * 18 + 0.5, 10, 12);
        }
      }
    }
    // Gold ingots on the crates.
    for (const [x, y] of [[482, 422], [1086, 422]]) {
      ctx.fillStyle = '#c99a36';
      ctx.fillRect(x - 12, y - 5, 24, 10);
      ctx.fillStyle = 'rgba(255, 240, 200, 0.55)';
      ctx.fillRect(x - 12, y - 5, 24, 3);
    }
    // Heavy circular vault seal on the north wall.
    ctx.save();
    ctx.translate(800, 278);
    ctx.strokeStyle = 'rgba(217, 164, 65, 0.45)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(217, 164, 65, 0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
      ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawChandelier(ctx, x, y, palette) {
  const glow = ctx.createRadialGradient(x, y, 6, x, y, 120);
  glow.addColorStop(0, 'rgba(242, 201, 107, 0.28)');
  glow.addColorStop(0.5, 'rgba(242, 201, 107, 0.07)');
  glow.addColorStop(1, 'rgba(242, 201, 107, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(217, 164, 65, 0.65)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(217, 164, 65, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    ctx.fillStyle = '#f2c96b';
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 30, y + Math.sin(a) * 30, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = palette.trim;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawSconce(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const glow = ctx.createRadialGradient(14, 0, 2, 14, 0, 60);
  glow.addColorStop(0, 'rgba(242, 201, 107, 0.32)');
  glow.addColorStop(1, 'rgba(242, 201, 107, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(14, 0, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(217, 164, 65, 0.8)';
  ctx.fillRect(0, -3, 10, 6);
  ctx.fillStyle = '#f2c96b';
  ctx.beginPath();
  ctx.arc(12, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBankerLamp(ctx, x, y) {
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 54);
  glow.addColorStop(0, 'rgba(242, 201, 107, 0.3)');
  glow.addColorStop(1, 'rgba(242, 201, 107, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d3d33';
  ctx.beginPath();
  ctx.ellipse(x, y, 11, 6, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c96b';
  ctx.beginPath();
  ctx.arc(x, y + 1, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFloorMarks(ctx, level) {
  const label = level.decor === 'atrium' ? 'MERIDIAN HOUSE' : level.decor === 'archive' ? 'THE WEST WING' : 'LOWER VAULT';
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = level.palette.trim;
  ctx.font = `600 30px ${SERIF}`;
  ctx.textAlign = 'center';
  const text = label.split('').join(' ');
  ctx.fillText(text, 800, 650);
  ctx.restore();
}

function drawRainPanes(ctx, level) {
  const panes = level.decor === 'atrium'
    ? [[360, 6, 250, 24], [990, 6, 250, 24]]
    : level.decor === 'archive'
      ? [[520, 6, 420, 24]]
      : [[230, 6, 280, 24], [1090, 6, 280, 24]];
  for (const [x, y, w, h] of panes) {
    const gradient = ctx.createLinearGradient(0, y, 0, y + h);
    gradient.addColorStop(0, 'rgba(90, 140, 160, 0.28)');
    gradient.addColorStop(1, 'rgba(20, 40, 52, 0.5)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(217, 164, 65, 0.3)';
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    for (let i = 1; i < 5; i += 1) {
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.22)';
      ctx.beginPath();
      ctx.moveTo(x + (w * i) / 5, y);
      ctx.lineTo(x + (w * i) / 5, y + h);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------------------
// Dynamic layer

function drawDoors(ctx, world) {
  for (const door of world.level.doors) {
    ctx.save();
    if (door.open) {
      ctx.fillStyle = 'rgba(4, 6, 9, 0.8)';
      ctx.fillRect(door.x, door.y, door.w, door.h);
      const gradient = ctx.createLinearGradient(door.x, door.y, door.x, door.y + door.h);
      gradient.addColorStop(0, 'rgba(242, 201, 107, 0.22)');
      gradient.addColorStop(1, 'rgba(242, 201, 107, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(door.x, door.y, door.w, door.h + 60);
      ctx.fillStyle = 'rgba(242, 201, 107, 0.5)';
      ctx.font = `600 10px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.fillText('OPEN', door.x + door.w / 2, door.y + door.h / 2 + 3);
    } else {
      const horizontal = door.w > door.h;
      ctx.fillStyle = '#6b4a1c';
      ctx.fillRect(door.x, door.y, door.w, door.h);
      ctx.strokeStyle = 'rgba(242, 201, 107, 0.65)';
      ctx.lineWidth = 2;
      ctx.strokeRect(door.x + 1, door.y + 1, door.w - 2, door.h - 2);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(door.x + door.w / 2, door.y + 2);
        ctx.lineTo(door.x + door.w / 2, door.y + door.h - 2);
      } else {
        ctx.moveTo(door.x + 2, door.y + door.h / 2);
        ctx.lineTo(door.x + door.w - 2, door.y + door.h / 2);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(232, 72, 79, 0.9)';
      ctx.beginPath();
      ctx.arc(door.x + door.w / 2, door.y + door.h / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawTerminals(ctx, world) {
  for (const terminal of world.level.terminals) {
    ctx.save();
    const used = terminal.used;
    ctx.shadowColor = used ? 'rgba(121, 213, 232, 0.15)' : 'rgba(121, 213, 232, 0.55)';
    ctx.shadowBlur = used ? 6 : 18;
    ctx.fillStyle = '#152a30';
    ctx.fillRect(terminal.x - 18, terminal.y - 18, 36, 36);
    ctx.strokeStyle = used ? 'rgba(121, 213, 232, 0.3)' : 'rgba(121, 213, 232, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(terminal.x - 18, terminal.y - 18, 36, 36);
    ctx.fillStyle = used ? 'rgba(121, 213, 232, 0.35)' : '#79d5e8';
    ctx.fillRect(terminal.x - 11, terminal.y - 11, 22, 14);
    ctx.fillStyle = used ? 'rgba(121, 213, 232, 0.25)' : 'rgba(121, 213, 232, 0.8)';
    for (let i = 0; i < 3; i += 1) ctx.fillRect(terminal.x - 10, terminal.y + 8 + i * 4, 20 - i * 4, 2);
    ctx.restore();
  }
}

function drawLasers(ctx, world, time) {
  if (world.level.lasers.length === 0) return;
  const active = world.laserOff <= 0;
  ctx.save();
  for (const laser of world.level.lasers) {
    ctx.lineCap = 'round';
    if (active) {
      ctx.shadowColor = 'rgba(232, 72, 79, 0.8)';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = 'rgba(255, 90, 96, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 220, 200, 0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const length = Math.hypot(laser.x2 - laser.x1, laser.y2 - laser.y1);
      const travel = ((time * 260) % length);
      const t = travel / length;
      const px = laser.x1 + (laser.x2 - laser.x1) * t;
      const py = laser.y1 + (laser.y2 - laser.y1) * t;
      ctx.fillStyle = 'rgba(255, 235, 210, 0.9)';
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(121, 213, 232, 0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const [x, y] of [[laser.x1, laser.y1], [laser.x2, laser.y2]]) {
      ctx.fillStyle = active ? '#e8484f' : 'rgba(121, 213, 232, 0.4)';
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }
  }
  ctx.restore();
}

function drawExit(ctx, world, time) {
  const exit = world.level.exit;
  const open = world.loot.taken;
  ctx.save();
  const cx = exit.x + exit.w / 2;
  const cy = exit.y + exit.h / 2;
  ctx.fillStyle = 'rgba(2, 5, 8, 0.9)';
  ctx.fillRect(exit.x - 18, exit.y - 14, exit.w + 36, exit.h + 22);
  ctx.strokeStyle = open ? 'rgba(242, 201, 107, 0.9)' : 'rgba(232, 72, 79, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(exit.x - 18, exit.y - 14, exit.w + 36, exit.h + 22);
  const gradient = ctx.createLinearGradient(0, exit.y - 20, 0, exit.y + exit.h + 40);
  gradient.addColorStop(0, open ? 'rgba(242, 201, 107, 0.32)' : 'rgba(232, 72, 79, 0.12)');
  gradient.addColorStop(1, open ? 'rgba(242, 201, 107, 0.04)' : 'rgba(232, 72, 79, 0.02)');
  ctx.fillStyle = gradient;
  ctx.fillRect(exit.x - 10, exit.y - 24, exit.w + 20, exit.h + 52);
  ctx.fillStyle = open ? COLORS.brassBright : 'rgba(232, 72, 79, 0.7)';
  ctx.font = `600 11px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText(open ? `ESCAPE · ${exit.label.toUpperCase()}` : 'SEALED', cx, exit.y + exit.h + 26);
  if (open) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.strokeStyle = `rgba(242, 201, 107, ${0.3 + pulse * 0.4})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(exit.x - 26, exit.y - 20, exit.w + 52, exit.h + 34);
  }
  ctx.restore();
}

function drawLoot(ctx, world, time) {
  const loot = world.loot;
  if (loot.taken) {
    ctx.save();
    ctx.fillStyle = 'rgba(232, 72, 79, 0.18)';
    ctx.beginPath();
    ctx.arc(loot.x, loot.y + 12, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const pulse = 0.5 + 0.5 * Math.sin(time * 2.1);
  ctx.save();
  // Shaft of gallery light.
  const shaft = ctx.createLinearGradient(loot.x, loot.y - 130, loot.x, loot.y + 30);
  shaft.addColorStop(0, 'rgba(242, 201, 107, 0.28)');
  shaft.addColorStop(1, 'rgba(242, 201, 107, 0.02)');
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(loot.x - 26, loot.y - 136);
  ctx.lineTo(loot.x + 26, loot.y - 136);
  ctx.lineTo(loot.x + 18, loot.y + 20);
  ctx.lineTo(loot.x - 18, loot.y + 20);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'rgba(242, 201, 107, 0.9)';
  ctx.shadowBlur = 30 + pulse * 18;
  ctx.translate(loot.x, loot.y - 8);
  ctx.rotate(Math.PI / 4);
  const size = 26;
  const gem = ctx.createLinearGradient(-size, -size, size, size);
  gem.addColorStop(0, '#fff8dd');
  gem.addColorStop(0.45, '#f2c96b');
  gem.addColorStop(1, '#b57b22');
  ctx.fillStyle = gem;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.strokeStyle = 'rgba(120, 70, 12, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-size / 2, 0);
  ctx.lineTo(size / 2, 0);
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(0, size / 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(242, 201, 107, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(loot.x, loot.y + 12, 34, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(242, 201, 107, 0.9)';
  ctx.font = `600 10px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.65 + pulse * 0.35;
  ctx.fillText(loot.name.toUpperCase(), loot.x, loot.y + 40);
  ctx.restore();
}

function drawCones(ctx, world) {
  const blockers = sightBlockers(world);
  for (const guard of world.guards) {
    const points = conePolygon(guard.x, guard.y, guard.angle, guard.fov, guard.range, blockers, 30);
    const gradient = ctx.createRadialGradient(guard.x, guard.y, 12, guard.x, guard.y, guard.range);
    gradient.addColorStop(0, 'rgba(232, 72, 79, 0.44)');
    gradient.addColorStop(0.55, 'rgba(232, 72, 79, 0.19)');
    gradient.addColorStop(1, 'rgba(232, 72, 79, 0.02)');
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 120, 120, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  for (const camera of world.cameras) {
    if (camera.disabled > 0) continue;
    const points = conePolygon(camera.x, camera.y, camera.angle, camera.fov, camera.range, blockers, 26);
    const gradient = ctx.createRadialGradient(camera.x, camera.y, 10, camera.x, camera.y, camera.range);
    gradient.addColorStop(0, 'rgba(232, 120, 72, 0.34)');
    gradient.addColorStop(0.6, 'rgba(232, 120, 72, 0.14)');
    gradient.addColorStop(1, 'rgba(232, 120, 72, 0.02)');
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = 'rgba(242, 160, 107, 0.18)';
    ctx.stroke();
    ctx.restore();
  }
}

function drawCameras(ctx, world) {
  for (const camera of world.cameras) {
    const disabled = camera.disabled > 0;
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.rotate(camera.angle);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(15, 14, 19, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = disabled ? '#2b3438' : '#42535a';
    ctx.fillRect(-13, -10, 28, 20);
    ctx.strokeStyle = disabled ? 'rgba(121, 213, 232, 0.35)' : 'rgba(217, 164, 65, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-13, -10, 28, 20);
    ctx.fillStyle = disabled ? 'rgba(121, 213, 232, 0.3)' : camera.alert > 0 ? '#e8484f' : 'rgba(242, 201, 107, 0.95)';
    ctx.beginPath();
    ctx.arc(5, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0d12';
    ctx.beginPath();
    ctx.arc(5, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = disabled ? 'rgba(121, 213, 232, 0.55)' : camera.alert > 0 ? '#e8484f' : 'rgba(232, 72, 79, 0.75)';
    ctx.beginPath();
    ctx.arc(camera.x - 6, camera.y - 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGuards(ctx, world) {
  for (const guard of world.guards) {
    ctx.save();
    ctx.translate(guard.x, guard.y);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(6, 10, 21, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(guard.angle);
    // Coat.
    ctx.fillStyle = guard.state === 'chase' ? '#75232a' : '#542a2e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242, 201, 107, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Shoulders.
    ctx.fillStyle = guard.state === 'chase' ? '#93303a' : '#643338';
    ctx.beginPath();
    ctx.ellipse(-4, 0, 10, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cap.
    ctx.fillStyle = '#171214';
    ctx.beginPath();
    ctx.arc(6, 0, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(217, 164, 65, 0.8)';
    ctx.fillRect(6, -2, 10, 4);
    // Lantern at the cone origin.
    ctx.fillStyle = guard.state === 'chase' ? '#e8484f' : '#f2c96b';
    ctx.beginPath();
    ctx.arc(16, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const mood = guardMood(guard);
    if (mood) {
      ctx.save();
      ctx.fillStyle = 'rgba(5, 8, 12, 0.82)';
      ctx.strokeStyle = mood.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - 30, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = mood.color;
      ctx.font = `700 14px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.fillText(mood.text, guard.x, guard.y - 25);
      ctx.restore();
    }
  }
}

function drawPlayer(ctx, world) {
  const player = world.player;
  const bob = player.moving ? Math.sin(player.animTime * 9) * 1.4 : 0;
  const scale = player.sneaking ? 0.82 : 1;
  ctx.save();
  ctx.translate(player.x, player.y + bob);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.ellipse(6, 11, 22 * scale, 9 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(player.facing);
  ctx.scale(scale, scale);

  // Long coat.
  ctx.fillStyle = player.shadowed ? '#173740' : '#214049';
  ctx.beginPath();
  ctx.ellipse(-3, 0, 21, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(242, 201, 107, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Fedora.
  ctx.fillStyle = '#0f171c';
  ctx.beginPath();
  ctx.arc(8, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a1014';
  ctx.fillRect(2, -12, 19, 4);
  ctx.fillStyle = 'rgba(217, 164, 65, 0.5)';
  ctx.fillRect(2, -10, 19, 1);

  // Gold scarf trailing behind the run.
  ctx.strokeStyle = '#e0ad4b';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-12, 3);
  ctx.quadraticCurveTo(-24, 5 + Math.sin(player.animTime * 6) * 4, -32, 10);
  ctx.stroke();

  // The take, in a satchel.
  if (player.carrying) {
    ctx.fillStyle = 'rgba(242, 201, 107, 0.95)';
    ctx.shadowColor = 'rgba(242, 201, 107, 0.9)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(-9, 11, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  if (player.shadowed) {
    ctx.save();
    ctx.strokeStyle = 'rgba(121, 213, 232, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 22, 0, Math.PI * 2);
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSmoke(ctx, world) {
  for (const cloud of world.smokes) {
    const fade = clamp(cloud.life / cloud.maxLife, 0, 1);
    const alpha = 0.5 * Math.min(1, fade * 2.5) * (cloud.life > 0.6 ? 1 : cloud.life / 0.6);
    for (let i = 0; i < 7; i += 1) {
      const angle = cloud.spin + i * 0.9;
      const radius = cloud.radius * (0.15 + 0.42 * ((i * 0.37) % 1));
      const x = cloud.x + Math.cos(angle) * radius;
      const y = cloud.y + Math.sin(angle) * radius * 0.72;
      const size = cloud.radius * (0.5 + 0.18 * ((i * 0.53) % 1));
      const gradient = ctx.createRadialGradient(x, y, 4, x, y, size);
      gradient.addColorStop(0, `rgba(196, 207, 210, ${alpha * 0.9})`);
      gradient.addColorStop(0.6, `rgba(150, 164, 168, ${alpha * 0.55})`);
      gradient.addColorStop(1, 'rgba(120, 136, 140, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawParticles(ctx, world, time) {
  for (const particle of world.particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const ring of world.rings) {
    const alpha = clamp(ring.life / ring.maxLife, 0, 1);
    ctx.strokeStyle = ring.color;
    ctx.globalAlpha = alpha * 0.8;
    ctx.lineWidth = ring.width;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Ambient gold dust in the loot's light.
  if (!world.loot.taken) {
    for (let i = 0; i < 14; i += 1) {
      const t = time * 0.25 + i * 1.7;
      const x = world.loot.x + Math.sin(t * 1.3 + i) * 46;
      const y = world.loot.y - 20 + Math.cos(t * 0.9 + i * 0.7) * 40;
      ctx.globalAlpha = 0.2 + 0.25 * (0.5 + 0.5 * Math.sin(time * 2 + i));
      ctx.fillStyle = '#f2c96b';
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawRain(ctx, world, time) {
  const panes = world.level.decor === 'atrium'
    ? [[360, 6, 250, 24], [990, 6, 250, 24]]
    : world.level.decor === 'archive'
      ? [[520, 6, 420, 24]]
      : [[230, 6, 280, 24], [1090, 6, 280, 24]];
  ctx.save();
  for (const [x, y, w, h] of panes) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(170, 210, 225, 0.28)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 26; i += 1) {
      const seed = i * 37.3;
      const px = x + ((hash01(seed) * w + time * 26) % w);
      const py = y + ((hash01(seed + 9) * h + time * 80) % h);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - 2, py + 5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Colour helpers

function lighten(hex, amount) {
  return shift(hex, amount);
}

function darken(hex, amount) {
  return shift(hex, -amount);
}

function shift(hex, amount) {
  const value = hex.replace('#', '');
  const num = Number.parseInt(value, 16);
  const r = clamp(((num >> 16) & 255) + amount, 0, 255);
  const g = clamp(((num >> 8) & 255) + amount, 0, 255);
  const b = clamp((num & 255) + amount, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}
