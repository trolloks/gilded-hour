// Deterministic dioramas for the entry screenshots. Each one is a real frame of
// the same renderer the player sees: no post-processing, no borrowed art.

export const SHOT_LEVEL = { cover: 2, atrium: 0, vault: 2, tools: 1, getaway: 2 };

export function stageShot(world, name) {
  world.time = 4.2;
  world.stats = { spotted: 2, hacks: 1, time: 214, alarmsTriggered: 2 };

  if (name === 'atrium') {
    world.alarm = 58;
    world.player.x = 800;
    world.player.y = 552;
    world.player.facing = -1.48;
    world.player.sneaking = true;
    world.player.shadowed = true;
    world.hint = null;
    positionGuard(world.guards[0], 432, 334, 0.62, 'patrol', 0.2);
    positionGuard(world.guards[1], 1168, 328, 2.56, 'patrol', 0.34);
    freezeCamera(world.cameras[0], 1.02);
    freezeCamera(world.cameras[1], 2.18);
    return;
  }

  if (name === 'tools') {
    world.alarm = 46;
    world.player.x = 600;
    world.player.y = 540;
    world.player.facing = Math.PI;
    world.player.sneaking = true;
    world.player.shadowed = true;
    world.tools.smoke.charges = 1;
    world.tools.emp.charges = 0;
    world.tools.decoy.charges = 2;
    world.tools.emp.cooldown = 0.42;
    world.smokes.push({ x: 830, y: 480, radius: 110, life: 3.8, maxLife: 5.4, spin: 0.7 });
    world.rings.push({ x: 600, y: 540, radius: 250, grow: 0, life: 0.4, maxLife: 0.7, color: '#79d5e8', width: 2.5 });
    world.hint = null;
    world.level.doors[0].open = true;
    positionGuard(world.guards[0], 974, 500, Math.PI, 'investigate', 0.74);
    positionGuard(world.guards[1], 398, 500, 0.12, 'chase', 1);
    positionGuard(world.guards[2], 1300, 190, 2.9, 'patrol', 0.1);
    freezeCamera(world.cameras[0], 2.02, 8);
    freezeCamera(world.cameras[1], -1.42);
    world.particles.push(
      { x: 760, y: 478, vx: 22, vy: -12, life: 1.8, maxLife: 2.2, size: 18, color: 'rgba(190,203,206,0.22)' },
      { x: 706, y: 512, vx: -14, vy: 8, life: 1.4, maxLife: 2, size: 24, color: 'rgba(190,203,206,0.18)' },
      { x: 636, y: 522, vx: 0, vy: 0, life: 0.4, maxLife: 0.7, size: 3, color: '#79d5e8' },
    );
    return;
  }

  if (name === 'cover' || name === 'vault') {
    world.alarm = 74;
    world.player.x = 832;
    world.player.y = 470;
    world.player.facing = -2.75;
    world.player.sneaking = true;
    world.hint = 'HOLD E — PRISE THE SUNSTONE';
    world.interaction = { progress: 0.46 };
    world.level.doors[0].open = true;
    positionGuard(world.guards[0], 806, 654, -Math.PI / 2, 'chase', 1);
    positionGuard(world.guards[1], 1092, 152, 2.7, 'investigate', 0.62);
    positionGuard(world.guards[2], 186, 432, 0.05, 'patrol', 0.2);
    freezeCamera(world.cameras[0], 0.84);
    freezeCamera(world.cameras[1], 2.34);
    world.particles.push(
      { x: 800, y: 392, vx: 18, vy: -22, life: 1.2, maxLife: 1.6, size: 2, color: '#f2c96b' },
      { x: 812, y: 400, vx: -12, vy: -14, life: 1.5, maxLife: 1.8, size: 1.6, color: '#fff3cf' },
    );
    return;
  }

  if (name === 'getaway') {
    world.alarm = 94;
    world.loot.taken = true;
    world.player.carrying = true;
    world.player.x = 800;
    world.player.y = 756;
    world.player.facing = Math.PI / 2;
    world.player.sneaking = false;
    world.hint = 'THE LIFT — GO';
    world.flashRed = 0.45;
    world.shake = 3;
    positionGuard(world.guards[0], 620, 700, 0.55, 'chase', 1);
    positionGuard(world.guards[1], 984, 700, 2.58, 'chase', 1);
    positionGuard(world.guards[2], 186, 650, 0.12, 'investigate', 0.8);
    freezeCamera(world.cameras[0], 0.95);
    freezeCamera(world.cameras[1], 2.2);
    world.level.doors[0].open = true;
    return;
  }

  world.hint = 'STEAL THE SUNSTONE';
}

function positionGuard(guard, x, y, angle, state, suspicion) {
  guard.x = x;
  guard.y = y;
  guard.angle = angle;
  guard.state = state;
  guard.suspicion = suspicion;
  guard.pause = 3;
  guard.lastSeen = { x, y };
}

function freezeCamera(camera, angle, disabled = 0) {
  camera.angle = angle;
  camera.base = angle;
  camera.sweep = 0;
  camera.speed = 0;
  camera.disabled = disabled;
  camera.alert = disabled > 0 ? 0 : 0.4;
}
