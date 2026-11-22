// Small pure geometry helpers shared by movement, sight and rendering.

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function angleOf(dx, dy) {
  return Math.atan2(dy, dx);
}

/** Shortest signed turn from a to b, in radians. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function moveTowardAngle(angle, target, step) {
  const d = angleDelta(angle, target);
  if (Math.abs(d) <= step) return target;
  return angle + Math.sign(d) * step;
}

export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

export function pointInCircle(px, py, cx, cy, r) {
  return distance(px, py, cx, cy) <= r;
}

export function rectCenter(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/** Does the segment touch an axis-aligned rectangle? Slab clipping, no allocations. */
export function segmentHitsRect(x1, y1, x2, y2, rect, pad = 0) {
  const minX = rect.x - pad;
  const minY = rect.y - pad;
  const maxX = rect.x + rect.w + pad;
  const maxY = rect.y + rect.h + pad;
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;

  for (let axis = 0; axis < 2; axis += 1) {
    const p = axis === 0 ? -dx : -dy;
    const q = axis === 0 ? x1 - minX : y1 - minY;
    const p2 = axis === 0 ? dx : dy;
    const q2 = axis === 0 ? maxX - x1 : maxY - y1;
    if (Math.abs(p) < 1e-9) {
      if (q < 0 || q2 < 0) return false;
      continue;
    }
    const r1 = q / p;
    const r2 = q2 / p2;
    const enter = Math.min(r1, r2);
    const leave = Math.max(r1, r2);
    t0 = Math.max(t0, enter);
    t1 = Math.min(t1, leave);
    if (t0 > t1) return false;
  }
  return true;
}

/** Does the segment pass through a circle? Used for smoke clouds and audio pings. */
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return distance(x1, y1, cx, cy) <= r;
  let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  t = clamp(t, 0, 1);
  return distance(x1 + dx * t, y1 + dy * t, cx, cy) <= r;
}

/** True when (x, y) lies inside the cone from (ox, oy). */
export function inCone(ox, oy, angle, fov, range, x, y) {
  const dx = x - ox;
  const dy = y - oy;
  const d = Math.hypot(dx, dy);
  if (d > range) return false;
  if (Math.abs(angleDelta(angle, Math.atan2(dy, dx))) > fov / 2) return false;
  return true;
}

/**
 * A fan of points along a vision cone, each ray stopped by the first blocker.
 * The renderer fills this polygon, so cones break exactly where walls do.
 */
export function conePolygon(ox, oy, angle, fov, range, blockers, rays = 26) {
  const points = [{ x: ox, y: oy }];
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - fov / 2 + (fov * i) / rays;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let reach = range;
    for (const rect of blockers) {
      const hit = rayRectDistance(ox, oy, dx, dy, rect);
      if (hit !== null && hit < reach) reach = hit;
    }
    points.push({ x: ox + dx * reach, y: oy + dy * reach });
  }
  return points;
}

/** Distance to a rect along a unit ray, or null. */
function rayRectDistance(ox, oy, dx, dy, rect) {
  let tmin = 0;
  let tmax = Infinity;
  const bounds = [
    [ox, dx, rect.x, rect.x + rect.w],
    [oy, dy, rect.y, rect.y + rect.h],
  ];
  for (const [origin, direction, min, max] of bounds) {
    if (Math.abs(direction) < 1e-9) {
      if (origin < min || origin > max) return null;
      continue;
    }
    let t1 = (min - origin) / direction;
    let t2 = (max - origin) / direction;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin > 0 ? tmin : null;
}

/** Deterministic 0..1 noise, so the same seed always paints the same floor. */
export function hash01(n) {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
}
