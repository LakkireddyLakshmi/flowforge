/**
 * A tiny seedable pseudo-random number generator (mulberry32).
 *
 * Why not just Math.random()? Because "seedable" means *reproducible*: the same
 * seed replays the exact same simulation, every time. That's what makes the
 * engine unit-testable ("with seed 42 the p99 latency is X") and lets two
 * machines run the identical scenario and agree — important once the engine is
 * distributed.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform random in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * A sample from an exponential distribution with the given mean. Real arrivals
   * and service times aren't perfectly evenly spaced — they cluster and gap.
   * Exponential inter-arrival times are the textbook model of a Poisson process,
   * which is what gives the simulation its realistic "bursty" feel.
   */
  exponential(mean: number): number {
    const u = 1 - this.next(); // in (0, 1], so log() is safe
    return -Math.log(u) * mean;
  }

  /** True with probability `p` (a Bernoulli trial) — e.g. a cache hit. */
  chance(p: number): boolean {
    return this.next() < p;
  }
}
