// Tools at a cost: two smoke canisters, one EMP, two decoys per act. Each buys
// distance from a cone or pulls a patrol off its route.

import { TOOLS } from './config.js';
import { angleOf, distance } from './geometry.js';
import { pointBlocked } from './collision.js';
import { blindCameras } from './cameras.js';

export function createTools() {
  return {
    smoke: { charges: TOOLS.smoke.charges, cooldown: 0 },
    emp: { charges: TOOLS.emp.charges, cooldown: 0 },
    decoy: { charges: TOOLS.decoy.charges, cooldown: 0 },
  };
}

export function useTool(world, kind, aim, audio) {
  const slot = world.tools[kind];
  if (!slot || slot.charges <= 0 || slot.cooldown > 0 || world.phase !== 'play') return false;

  const player = world.player;
  const aimX = aim ? aim.x : player.x + Math.cos(player.facing) * 100;
  const aimY = aim ? aim.y : player.y + Math.sin(player.facing) * 100;
  const angle = angleOf(aimX - player.x, aimY - player.y);
  slot.charges -= 1;

  if (kind === 'smoke') {
    let x = player.x + Math.cos(angle) * 78;
    let y = player.y + Math.sin(angle) * 78;
    if (pointBlocked(world, x, y, 16)) {
      x = player.x + Math.cos(angle) * 34;
      y = player.y + Math.sin(angle) * 34;
    }
    world.smokes.push({
      x,
      y,
      radius: TOOLS.smoke.radius,
      life: TOOLS.smoke.life,
      maxLife: TOOLS.smoke.life,
      spin: Math.random() * Math.PI,
    });
    slot.cooldown = TOOLS.smoke.cooldown;
    for (let i = 0; i < 16; i += 1) {
      spawnParticle(world, x, y, {
        color: 'rgba(190, 203, 206, 0.5)',
        speed: 30 + Math.random() * 70,
        size: 5 + Math.random() * 10,
        life: 0.7 + Math.random() * 0.8,
      });
    }
    if (audio) audio.smoke();
    return true;
  }

  if (kind === 'emp') {
    blindCameras(world, player.x, player.y, TOOLS.emp.radius, TOOLS.emp.life);
    world.rings.push({
      x: player.x,
      y: player.y,
      radius: 20,
      grow: 640,
      life: 0.7,
      maxLife: 0.7,
      color: '#79d5e8',
      width: 4,
    });
    slot.cooldown = TOOLS.emp.cooldown;
    if (audio) audio.emp();
    return true;
  }

  if (kind === 'decoy') {
    let x = player.x + Math.cos(angle) * 170;
    let y = player.y + Math.sin(angle) * 170;
    if (pointBlocked(world, x, y, 8)) {
      x = player.x + Math.cos(angle) * 60;
      y = player.y + Math.sin(angle) * 60;
    }
    world.noiseEvents.push({ x, y, radius: TOOLS.decoy.radius, time: world.time, kind: 'decoy' });
    world.rings.push({
      x,
      y,
      radius: 8,
      grow: 120,
      life: 0.8,
      maxLife: 0.8,
      color: '#f2c96b',
      width: 2,
    });
    slot.cooldown = TOOLS.decoy.cooldown;
    if (audio) audio.decoy();
    return true;
  }

  return false;
}

export function updateTools(world, dt) {
  for (const slot of Object.values(world.tools)) {
    slot.cooldown = Math.max(0, slot.cooldown - dt);
  }

  for (const cloud of world.smokes) {
    cloud.life -= dt;
    cloud.spin += dt * 0.11;
    if (cloud.life > 0 && Math.random() < dt * 12) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * cloud.radius * 0.72;
      spawnParticle(world, cloud.x + Math.cos(angle) * radius, cloud.y + Math.sin(angle) * radius, {
        color: 'rgba(185, 198, 202, 0.22)',
        speed: 4,
        size: 12 + Math.random() * 20,
        life: 0.8 + Math.random() * 1.4,
      });
    }
  }
  world.smokes = world.smokes.filter((cloud) => cloud.life > 0);

  for (const ring of world.rings) {
    ring.life -= dt;
    ring.radius += ring.grow * dt;
  }
  world.rings = world.rings.filter((ring) => ring.life > 0);

  for (const particle of world.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    particle.vy += (particle.gravity ?? 0) * dt;
  }
  world.particles = world.particles.filter((particle) => particle.life > 0);
}

export function spawnParticle(world, x, y, options = {}) {
  const angle = options.angle ?? Math.random() * Math.PI * 2;
  const speed = options.speed ?? 40;
  world.particles.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: options.life ?? 0.6,
    maxLife: options.life ?? 0.6,
    size: options.size ?? 3,
    color: options.color ?? '#f2c96b',
    gravity: options.gravity ?? 0,
  });
}

export function toolRange(world, kind) {
  return kind === 'decoy' ? TOOLS.decoy.radius : kind === 'emp' ? TOOLS.emp.radius : TOOLS.smoke.radius;
}

export { distance };
