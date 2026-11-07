/** A seeded random generator whose whole state is one number, saved with every checkpoint: a run resumed from a
    checkpoint continues exactly as it would have. */
export type Rng = { next(): number; state: number };

export function createRng(seed: number): Rng {
  const r = { state: seed >>> 0, next() {
    r.state = (r.state + 0x6d2b79f5) >>> 0;
    let t = r.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  } };
  return r;
}
