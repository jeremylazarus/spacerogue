export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.sqrt(dist2(ax, ay, bx, by));
/** shortest signed angle from a to b */
export function angDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
/** rotate angle a toward b by at most step */
export function turnToward(a: number, b: number, step: number): number {
  const d = angDiff(a, b);
  return Math.abs(d) <= step ? b : a + Math.sign(d) * step;
}
/** time-to-intercept aim: returns angle to lead a moving target */
export function leadAngle(sx: number, sy: number, tx: number, ty: number, tvx: number, tvy: number, speed: number, svx = 0, svy = 0): number {
  const rx = tx - sx, ry = ty - sy;
  const vx = tvx - svx, vy = tvy - svy;
  const a = vx * vx + vy * vy - speed * speed;
  const b = 2 * (rx * vx + ry * vy);
  const c = rx * rx + ry * ry;
  let t = 0;
  if (Math.abs(a) < 1e-6) t = -c / b;
  else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      const t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a);
      t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
    }
  }
  if (!(t > 0) || t > 4) t = 0;
  return Math.atan2(ry + vy * t, rx + vx * t);
}
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
