// The alarm is the real health bar: cameras and guards feed it, silence drains it,
// and a hundred closes every door in the house.

import { ALARM } from './config.js';

export function raiseAlarm(world, amount, why = '') {
  if (world.phase !== 'play' || amount <= 0) return;
  world.alarm = Math.min(ALARM.max, world.alarm + amount);
  world.lastAlarmAt = world.time;
  if (why) world.alarmWhy = why;
  world.alarmFlash = Math.min(1, world.alarmFlash + amount / 28);
  if (world.alarm >= ALARM.max) {
    world.phase = 'caught';
    world.caughtBy = world.caughtBy || 'The alarm';
    world.caughtAt = world.time;
    world.shake = 18;
  }
}

export function updateAlarm(world, dt) {
  world.alarmFlash = Math.max(0, world.alarmFlash - dt * 3.2);
  world.shake = Math.max(0, world.shake - dt * 26);

  if (world.time - world.lastAlarmAt > ALARM.decayDelay) {
    world.alarm = Math.max(0, world.alarm - ALARM.decay * dt);
  }

  if (world.alarm >= ALARM.hot) {
    world.pulseTimer -= dt;
    if (world.pulseTimer <= 0) {
      world.pulseTimer = world.alarm >= ALARM.critical ? 0.42 : 0.86;
      world.pulseNow = true;
    }
  } else {
    world.pulseTimer = 0.2;
  }
}
