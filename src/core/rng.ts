/** Seeded PRNG (mulberry32) with helpers. Deterministic per seed. */
export class RNG {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  /** float in [0,1) */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** float in [a,b) */
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  /** integer in [a,b] inclusive */
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** pick by weight; weights must be >= 0 */
  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, weight(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /** gaussian-ish via sum of 3 uniforms, mean 0, ~sd 1 */
  normal(): number {
    return (this.next() + this.next() + this.next() - 1.5) * 2;
  }
  /** derive a new independent seed */
  fork(): number {
    return (this.next() * 4294967296) >>> 0;
  }
}

/** Hash a string/number list into a 32-bit seed. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x5f;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
