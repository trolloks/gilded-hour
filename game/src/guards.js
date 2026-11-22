// Guards read the room before they move. Each has a patrol, a vision cone, a
// suspicion clock and a search state, and a chase that ends at the thief.

import { angleDelta, angleOf, distance, inCone, moveTowardAngle } from './geometry.js';
import { hasLineOfSight, inShadow, inVent, moveCircle, smokeAt } from './collision.js';
import { raiseAlarm } from './alarm.js';

const GUARD_RADIUS = 14;
const SUSPICION_UP = 1.55;
const SUSPICION_DOWN = 0.85;

export function createGuard(definition, index) {
  const [firstX, firstY] = definition.path[0];
  const [nextX, nextY] = definition.path[1 % definition.path.length];
  return {
    ...definition,
    index,
    x: firstX,
    y: firstY,
    waypoint: 1,
    angle: angleOf(nextX - firstX, nextY - firstY),
    facing: 0,
    state: 'patrol',
    suspicion: 0,
    pause: 0.6 + index * 0.35,
    search: 0,
    lastSeen: { x: firstX, y: firstY },
    animTime: index * 1.7,
    alertFlash: 0,
    heardAt: -10,
  };
}

export function updateGuard(guard, world, dt, audio) {
  const player = world.player;
  guard.animTime += dt;
  guard.alertFlash = Math.max(0, guard.alertFlash - dt);

  const sees = canSee(world, guard);
  if (sees) {
    guard.lastSeen.x = player.x;
    guard.lastSeen.y = player.y;
    const closeness = 1 - distance(guard.x, guard.y, player.x, player.y) / (guard.range * 1.4);
    guard.suspicion += SUSPICION_UP * (0.55 + closeness) * dt;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - SUSPICION_DOWN * dt);
  }

  if (guard.state !== 'chase' && guard.suspicion >= 1) {
    guard.state = 'chase';
    guard.alertFlash = 1;
    raiseAlarm(world, 11, 'A warden has your scent');
    if (audio) audio.spotted();
    world.stats.spotted += 1;
  }

  if (guard.state === 'chase') {
    updateChase(guard, world, dt, sees);
  } else if (guard.state === 'search') {
    updateSearch(guard, dt);
  } else if (guard.state === 'investigate') {
    updateInvestigate(guard, world, dt);
  } else {
    updatePatrol(guard, world, dt);
  }

  listenForNoise(guard, world);
}

function canSee(world, guard) {
  const player = world.player;
  if (inVent(world, player.x, player.y)) return false;
  if (smokeAt(world, guard.x, guard.y)) return false;

  let range = guard.range;
  if (player.shadowed) range *= player.sneaking ? 0.5 : 0.66;
  if (player.sneaking) range *= 0.82;
  if (!inCone(guard.x, guard.y, guard.angle, guard.fov, range, player.x, player.y)) return false;
  return hasLineOfSight(world, guard.x, guard.y, player.x, player.y);
}

function updatePatrol(guard, world, dt) {
  const target = guard.path[guard.waypoint % guard.path.length];
  const tx = target[0];
  const ty = target[1];
  const d = distance(guard.x, guard.y, tx, ty);

  if (guard.pause > 0) {
    guard.pause -= dt;
    const next = guard.path[(guard.waypoint + 1) % guard.path.length];
    const base = angleOf(next[0] - tx, next[1] - ty);
    guard.angle = moveTowardAngle(guard.angle, base + Math.sin(world.time * 1.35 + guard.index) * 0.62, dt * 1.6);
    return;
  }

  if (d < 7) {
    guard.waypoint = (guard.waypoint + 1) % guard.path.length;
    guard.pause = guard.wait;
    return;
  }

  guard.angle = moveTowardAngle(guard.angle, angleOf(tx - guard.x, ty - guard.y), dt * 3.4);
  stepToward(guard, world, tx, ty, guard.speed, dt);
}

function updateInvestigate(guard, world, dt) {
  const target = guard.lastSeen;
  const d = distance(guard.x, guard.y, target.x, target.y);
  guard.angle = moveTowardAngle(guard.angle, angleOf(target.x - guard.x, target.y - guard.y), dt * 3);
  if (d < 12) {
    guard.state = 'search';
    guard.search = 2.6;
    return;
  }
  stepToward(guard, world, target.x, target.y, guard.speed * 1.18, dt);
}

function updateSearch(guard, dt) {
  guard.search -= dt;
  guard.angle += dt * 1.25;
  if (guard.search <= 0) {
    guard.state = 'patrol';
    guard.pause = 0.4;
  }
}

function updateChase(guard, world, dt, sees) {
  const player = world.player;
  const target = sees ? player : guard.lastSeen;
  const d = distance(guard.x, guard.y, target.x, target.y);
  guard.angle = moveTowardAngle(guard.angle, angleOf(target.x - guard.x, target.y - guard.y), dt * 5.2);
  if (sees) {
    raiseAlarm(world, world.alarmChaseRate * dt, 'A warden is chasing you');
    if (distance(guard.x, guard.y, player.x, player.y) < 27) {
      world.caughtBy = guard.name;
      world.phase = 'caught';
      world.caughtAt = world.time;
      world.shake = 16;
      return;
    }
  }
  if (d < 14 && !sees) {
    guard.state = 'search';
    guard.search = 3.8;
    return;
  }
  stepToward(guard, world, target.x, target.y, 188, dt);
}

function stepToward(actor, world, tx, ty, speed, dt) {
  const angle = angleOf(tx - actor.x, ty - actor.y);
  const step = speed * dt;
  const moved = moveCircle(world, actor.x, actor.y, Math.cos(angle) * step, Math.sin(angle) * step, GUARD_RADIUS);
  actor.x = moved.x;
  actor.y = moved.y;
}

function listenForNoise(guard, world) {
  if (guard.state === 'chase' || guard.state === 'search') return;
  for (const noise of world.noiseEvents) {
    if (noise.time <= guard.heardAt) continue;
    if (distance(guard.x, guard.y, noise.x, noise.y) > noise.radius) continue;
    guard.heardAt = noise.time;
    guard.lastSeen.x = noise.x;
    guard.lastSeen.y = noise.y;
    guard.state = 'investigate';
    guard.pause = 0;
    guard.alertFlash = 0.6;
    guard.suspicion = Math.max(guard.suspicion, 0.24);
  }
}

export function guardMood(guard) {
  if (guard.state === 'chase') return { text: '!', color: '#e8484f' };
  if (guard.state === 'investigate' || guard.suspicion > 0.3) return { text: '?', color: '#f2c96b' };
  return null;
}

export { angleDelta, inShadow };
