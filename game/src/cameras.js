// Cameras sweep on their own clock. They are blind in smoke, blind while an EMP
// holds them, and their cone is clipped by the same walls that stop a guard.

import { angleDelta, distance, inCone } from './geometry.js';
import { hasLineOfSight, inVent, pointBlocked } from './collision.js';
import { raiseAlarm } from './alarm.js';
import { TOOLS } from './config.js';

export function createCamera(definition, index) {
  return {
    ...definition,
    sweepPhase: index * 1.91 + 0.4,
    angle: definition.base,
    disabled: 0,
    alert: 0,
    blink: index * 0.37,
  };
}

export function updateCamera(camera, world, dt) {
  camera.disabled = Math.max(0, camera.disabled - dt);
  camera.alert = Math.max(0, camera.alert - dt * 2.4);
  camera.blink += dt;
  camera.angle = camera.base + Math.sin(world.time * camera.speed + camera.sweepPhase) * camera.sweep;

  if (camera.disabled > 0) return;
  if (inVent(world, world.player.x, world.player.y)) return;

  let range = camera.range;
  if (world.player.shadowed) range *= 0.7;

  if (
    inCone(camera.x, camera.y, camera.angle, camera.fov, range, world.player.x, world.player.y) &&
    hasLineOfSight(world, camera.x, camera.y, world.player.x, world.player.y)
  ) {
    camera.alert = 0.7;
    raiseAlarm(world, 30 * dt, 'A camera has you in its sweep');
  }
}

/** The EMP ring: every camera it reaches goes dark for a while. */
export function blindCameras(world, x, y, radius, seconds) {
  let hit = 0;
  for (const camera of world.cameras) {
    if (distance(x, y, camera.x, camera.y) <= radius) {
      camera.disabled = Math.max(camera.disabled, seconds);
      camera.alert = 1;
      hit += 1;
    }
  }
  return hit;
}

export { pointBlocked };
