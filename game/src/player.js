// The thief: acceleration, sneak and run speeds, wall sliding, facing, footsteps.
// Footstep noise is what guards react to, so speed is always a risk decision.

import { PLAYER, TOOLS } from './config.js';
import { distance, angleOf } from './geometry.js';
import { inShadow, moveCircle } from './collision.js';

export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    facing: -Math.PI / 2,
    moving: false,
    sneaking: false,
    running: false,
    carrying: false,
    stepTimer: 0,
    animTime: 0,
    shadowed: false,
    inVent: false,
  };
}

export function updatePlayer(player, world, dt, input, aim, audio) {
  const axis = input.axis();
  const hasInput = axis.x !== 0 || axis.y !== 0;
  player.sneaking = input.sneaking();
  player.running = input.sprinting() && !player.sneaking && hasInput;

  let speed = PLAYER.walkSpeed;
  if (player.sneaking) speed = PLAYER.sneakSpeed;
  else if (player.running) speed = PLAYER.runSpeed;
  if (player.carrying) speed *= PLAYER.carryingPenalty;

  const length = Math.hypot(axis.x, axis.y) || 1;
  const targetX = (axis.x / length) * speed;
  const targetY = (axis.y / length) * speed;
  const rate = hasInput ? PLAYER.accel : PLAYER.brake;

  player.vx += Math.max(-rate * dt, Math.min(rate * dt, targetX - player.vx));
  player.vy += Math.max(-rate * dt, Math.min(rate * dt, targetY - player.vy));
  if (!hasInput && Math.hypot(player.vx, player.vy) < 4) {
    player.vx = 0;
    player.vy = 0;
  }

  const moved = moveCircle(world, player.x, player.y, player.vx * dt, player.vy * dt, PLAYER.radius);
  if (moved.x === player.x) player.vx = 0;
  if (moved.y === player.y) player.vy = 0;
  player.x = moved.x;
  player.y = moved.y;

  const actualSpeed = Math.hypot(player.vx, player.vy);
  player.moving = actualSpeed > 12;
  player.animTime += dt * (0.8 + actualSpeed / 120);

  if (aim) {
    player.facing = angleOf(aim.x - player.x, aim.y - player.y);
  } else if (player.moving) {
    player.facing = angleOf(player.vx, player.vy);
  }

  const shadow = inShadow(world, player.x, player.y);
  player.shadowed = Boolean(shadow) && !shadow.vent;

  if (player.moving) {
    player.stepTimer -= dt * (player.running ? 2.1 : player.sneaking ? 0.72 : 1.35);
    if (player.stepTimer <= 0) {
      player.stepTimer = 0.34;
      const quiet = player.sneaking;
      if (audio) audio.footstep(player.running);
      world.noiseEvents.push({
        x: player.x,
        y: player.y,
        radius: quiet ? 74 : player.running ? 250 : 150,
        time: world.time,
        kind: 'step',
      });
    }
  } else {
    player.stepTimer = Math.min(player.stepTimer, 0.08);
  }

  return { speed: actualSpeed };
}

/** Reset the tool belt for one act. */
export function createToolBelt() {
  return {
    smoke: { charges: TOOLS.smoke.charges, cooldown: 0 },
    emp: { charges: TOOLS.emp.charges, cooldown: 0 },
    decoy: { charges: TOOLS.decoy.charges, cooldown: 0 },
  };
}

export function canUseTool(world, kind) {
  const slot = world.tools[kind];
  return slot && slot.charges > 0 && slot.cooldown <= 0;
}

export function nearestInteractable(world) {
  const player = world.player;
  const candidates = [];

  if (!world.loot.taken) {
    const d = distance(player.x, player.y, world.loot.x, world.loot.y);
    if (d < 86) {
      candidates.push({
        kind: 'loot',
        x: world.loot.x,
        y: world.loot.y,
        distance: d,
        label: `PRISE ${world.loot.name.toUpperCase()}`,
        hold: world.loot.hold,
      });
    }
  }

  for (const terminal of world.level.terminals) {
    if (world.terminalSpent.has(terminal)) continue;
    const d = distance(player.x, player.y, terminal.x, terminal.y);
    if (d < 74) {
      candidates.push({
        kind: 'terminal',
        x: terminal.x,
        y: terminal.y,
        distance: d,
        label: terminal.label,
        hold: terminal.hold,
        terminal,
      });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0] ?? null;
}
