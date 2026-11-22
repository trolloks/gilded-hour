// The floor's clock: player, tools, patrols, cameras, lasers, alarm and the two
// endings. Screens read this state; nothing else owns mutable game state.

import { ALARM } from './config.js';
import { createPlayer, createToolBelt, nearestInteractable, updatePlayer } from './player.js';
import { createGuard, updateGuard } from './guards.js';
import { createCamera, updateCamera } from './cameras.js';
import { spawnParticle, updateTools, useTool } from './tools.js';
import { raiseAlarm, updateAlarm } from './alarm.js';
import { pointInRect } from './geometry.js';
import { distanceToSegment } from './collision.js';

export function createWorld(level, options = {}) {
  const world = {
    level,
    player: createPlayer(level.start),
    guards: level.guards.map((guard, index) => createGuard(guard, index)),
    cameras: level.cameras.map((camera, index) => createCamera(camera, index)),
    tools: createToolBelt(),
    loot: { ...level.loot, taken: false },
    terminalSpent: new Set(),
    smokes: [],
    rings: [],
    particles: [],
    noiseEvents: [],
    alarm: options.alarm ?? 0,
    alarmFlash: 0,
    alarmWhy: '',
    lastAlarmAt: -99,
    pulseTimer: 0,
    pulseNow: false,
    time: 0,
    phase: 'play',
    blueprint: false,
    interaction: null,
    hint: null,
    exitHint: 0,
    laserOff: 0,
    zapCooldown: 0,
    flashRed: 0,
    flashGold: 0,
    shake: 0,
    caughtBy: null,
    caughtAt: 0,
    alarmChaseRate: ALARM.chaseRate,
    stats: { spotted: 0, hacks: 0, time: 0, alarmsTriggered: 0 },
  };

  for (const terminal of level.terminals) {
    terminal.used = false;
  }
  return world;
}

export function updateWorld(world, dt, input, aim, audio) {
  world.pulseNow = false;
  if (world.phase !== 'play') {
    updateTools(world, dt);
    updateAlarm(world, dt);
    world.flashRed = Math.max(0, world.flashRed - dt * 2);
    world.flashGold = Math.max(0, world.flashGold - dt * 1.6);
    return;
  }

  world.time += dt;
  world.stats.time = world.time;
  world.laserOff = Math.max(0, world.laserOff - dt);
  world.zapCooldown = Math.max(0, world.zapCooldown - dt);

  updatePlayer(world.player, world, dt, input, aim, audio);
  updateTools(world, dt);

  if (input.wasPressed('KeyQ') || input.takeRightClick()) useTool(world, 'smoke', aim, audio);
  if (input.wasPressed('KeyF')) useTool(world, 'emp', aim, audio);
  if (input.wasPressed('KeyR')) useTool(world, 'decoy', aim, audio);

  updateInteraction(world, dt, input, audio);

  for (const guard of world.guards) updateGuard(guard, world, dt, audio);
  for (const camera of world.cameras) updateCamera(camera, world, dt);

  if (world.phase !== 'play') {
    updateAlarm(world, dt);
    return;
  }

  checkLasers(world, audio);
  if (world.phase === 'play') checkExit(world, audio);
  updateAlarm(world, dt);

  if (world.pulseNow && audio) audio.alarmPulse(world.alarm / ALARM.max);
  world.flashRed = Math.max(0, world.flashRed - dt * 2);
  world.flashGold = Math.max(0, world.flashGold - dt * 1.6);

  world.noiseEvents = world.noiseEvents.filter((noise) => world.time - noise.time < 0.7);

  if (world.phase === 'caught' && audio) {
    // audio is triggered once by the screen transition in main.js
  }
}

function updateInteraction(world, dt, input, audio) {
  const target = nearestInteractable(world);
  world.interaction = target ? { ...target, progress: 0 } : null;

  if (!target) {
    world.interactionState = null;
    world.hint = interactionHint(world);
    return;
  }

  const holding = input.isDown('KeyE') || input.leftHeld();
  if (!world.interactionState || world.interactionState.key !== target.kind) {
    world.interactionState = { key: target.kind, progress: 0 };
  }

  if (holding) {
    world.interactionState.progress += dt;
    if (world.interactionState.progress >= target.hold) {
      completeInteraction(world, target, audio);
      world.interactionState = null;
    }
  } else {
    world.interactionState.progress = Math.max(0, world.interactionState.progress - dt * 2.4);
  }

  world.hint = interactionHint(world);
  if (world.interaction) {
    world.interaction.progress = Math.min(1, (world.interactionState?.progress ?? 0) / target.hold);
  }
}

function interactionHint(world) {
  if (world.interaction) return `HOLD E — ${world.interaction.label}`;
  if (world.exitHint > 0) return `THE STREET IS NO USE WITHOUT ${world.loot.name.toUpperCase()}`;
  if (world.loot.taken) return `THE ${world.loot.name.toUpperCase()} IS YOURS — REACH ${world.level.exit.label.toUpperCase()}`;
  return `STEAL ${world.loot.name.toUpperCase()}`;
}

function completeInteraction(world, target, audio) {
  if (target.kind === 'loot') {
    world.loot.taken = true;
    world.player.carrying = true;
    world.flashGold = 1;
    raiseAlarm(world, 10, 'The plinth weight sensor');
    world.stats.alarmsTriggered += 1;
    if (audio) audio.pickup();
    for (let i = 0; i < 26; i += 1) {
      spawnParticle(world, world.loot.x, world.loot.y, {
        color: i % 2 ? '#f2c96b' : '#fff3cf',
        speed: 30 + Math.random() * 120,
        size: 1.5 + Math.random() * 3,
        life: 0.6 + Math.random() * 0.9,
      });
    }
    return;
  }

  if (target.kind === 'terminal') {
    const terminal = target.terminal;
    terminal.used = true;
    world.terminalSpent.add(terminal);
    world.laserOff = 12;
    world.stats.hacks += 1;
    raiseAlarm(world, 4, 'A terminal answers');
    if (audio) audio.hack();

    for (const door of world.level.doors) door.open = true;

    for (const laser of world.level.lasers) {
      spawnParticle(world, (laser.x1 + laser.x2) / 2, (laser.y1 + laser.y2) / 2, {
        color: '#79d5e8',
        speed: 90,
        size: 3,
        life: 0.5,
      });
    }
    for (const door of world.level.doors) {
      if (door.open) {
        for (let i = 0; i < 12; i += 1) {
          spawnParticle(world, door.x + door.w / 2, door.y + door.h / 2, {
            color: '#d9a441',
            speed: 45,
            size: 2,
            life: 0.7,
          });
        }
      }
    }
  }
}

function checkLasers(world, audio) {
  if (world.laserOff > 0) return;
  for (const laser of world.level.lasers) {
    const d = distanceToSegment(world.player.x, world.player.y, laser.x1, laser.y1, laser.x2, laser.y2);
    if (d < 15 && world.zapCooldown <= 0) {
      world.zapCooldown = 2.2;
      world.flashRed = 1;
      world.shake = Math.max(world.shake, 9);
      raiseAlarm(world, 20, 'The laser seam bites');
      world.stats.alarmsTriggered += 1;
      for (let i = 0; i < 18; i += 1) {
        spawnParticle(world, world.player.x, world.player.y, {
          color: '#e8484f',
          speed: 60 + Math.random() * 120,
          size: 1.5 + Math.random() * 2.5,
          life: 0.35 + Math.random() * 0.4,
        });
      }
      if (audio) audio.emp();
      break;
    }
  }
}

function checkExit(world, audio) {
  if (world.phase !== 'play') return;
  const exit = world.level.exit;
  const inside = pointInRect(world.player.x, world.player.y, {
    x: exit.x - 8,
    y: exit.y - 8,
    w: exit.w + 16,
    h: exit.h + 16,
  });

  if (inside && world.loot.taken) {
    world.phase = 'escaped';
    if (audio) audio.escape();
    return;
  }
  world.exitHint = inside && !world.loot.taken ? 1.2 : Math.max(0, world.exitHint - 0.016);
}

export function levelObjective(world) {
  return world.loot.taken
    ? `REACH ${world.level.exit.label.toUpperCase()}`
    : `STEAL ${world.loot.name.toUpperCase()}`;
}

/** Everything the renderer needs for one frame's alarm label. */
export function alarmLabel(world) {
  if (world.phase === 'caught') return 'CAUGHT';
  if (world.alarm >= 84) return 'LOCKDOWN';
  if (world.alarm >= 62) return 'HUNTED';
  if (world.alarm >= 34) return 'SUSPICION';
  if (world.alarm > 2) return 'WATCHFUL';
  return 'QUIET';
}
