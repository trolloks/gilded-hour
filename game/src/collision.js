// Collision and sight. Movement uses axis-separated circle-vs-rect sweeps; sight
// uses the true wall and cover rectangles, so a cone never leaks through a wall.

import { pointInRect, segmentHitsCircle, segmentHitsRect } from './geometry.js';

/** Everything the player cannot walk through right now. */
export function moveBlockers(world) {
  const blockers = world.level.walls.concat(world.level.cover);
  for (const door of world.level.doors) {
    if (!door.open) blockers.push(door);
  }
  for (const terminal of world.level.terminals) {
    blockers.push({ x: terminal.x - 16, y: terminal.y - 16, w: 32, h: 32 });
  }
  return blockers;
}

/** Everything that stops a guard's or camera's line of sight. */
export function sightBlockers(world) {
  const blockers = world.level.walls.concat(world.level.cover);
  for (const door of world.level.doors) {
    if (!door.open) blockers.push(door);
  }
  return blockers;
}

export function pointBlocked(world, x, y, radius = 0) {
  for (const rect of moveBlockers(world)) {
    if (
      x + radius > rect.x &&
      x - radius < rect.x + rect.w &&
      y + radius > rect.y &&
      y - radius < rect.y + rect.h
    ) {
      return true;
    }
  }
  return false;
}

/** Slide the player's centre by (dx, dy), one axis at a time. */
export function moveCircle(world, x, y, dx, dy, radius) {
  const blockers = moveBlockers(world);
  let nx = x;
  let ny = y;

  if (dx !== 0) {
    const step = Math.sign(dx) * Math.min(Math.abs(dx), radius);
    let remaining = dx;
    while (Math.abs(remaining) > 1e-4) {
      const amount = Math.abs(remaining) > step ? step : remaining;
      const test = nx + amount;
      if (hitsAny(blockers, test, ny, radius)) break;
      nx = test;
      remaining -= amount;
    }
  }

  if (dy !== 0) {
    const step = Math.sign(dy) * Math.min(Math.abs(dy), radius);
    let remaining = dy;
    while (Math.abs(remaining) > 1e-4) {
      const amount = Math.abs(remaining) > step ? step : remaining;
      const test = ny + amount;
      if (hitsAny(blockers, nx, test, radius)) break;
      ny = test;
      remaining -= amount;
    }
  }

  return { x: nx, y: ny };
}

function hitsAny(blockers, x, y, radius) {
  for (const rect of blockers) {
    if (
      x + radius > rect.x &&
      x - radius < rect.x + rect.w &&
      y + radius > rect.y &&
      y - radius < rect.y + rect.h
    ) {
      return true;
    }
  }
  return false;
}

export function hasLineOfSight(world, x1, y1, x2, y2) {
  const blockers = sightBlockers(world);
  for (const rect of blockers) {
    if (segmentHitsRect(x1, y1, x2, y2, rect)) return false;
  }
  for (const cloud of world.smokes) {
    if (segmentHitsCircle(x1, y1, x2, y2, cloud.x, cloud.y, cloud.radius * 0.82)) return false;
  }
  return true;
}

export function inShadow(world, x, y) {
  for (const zone of world.level.shadows) {
    if (pointInRect(x, y, zone)) return zone;
  }
  return null;
}

export function inVent(world, x, y) {
  for (const vent of world.level.vents) {
    if (pointInRect(x, y, vent)) return vent;
  }
  return null;
}

/** Guards standing in smoke see less far. */
export function smokeAt(world, x, y) {
  for (const cloud of world.smokes) {
    const dx = x - cloud.x;
    const dy = y - cloud.y;
    if (dx * dx + dy * dy < cloud.radius * cloud.radius) return cloud;
  }
  return null;
}

export function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1e-9) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}
