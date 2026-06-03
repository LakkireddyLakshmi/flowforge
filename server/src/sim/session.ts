import { SimulationEngine } from '../engine/engine.js';
import type { Scenario, SimSnapshot } from '../engine/types.js';

const FRAME_MS = 100; // emit ~10 frames per second

/**
 * One running simulation, tied to one connected browser.
 *
 * It owns an engine and drives it in real time: every FRAME_MS it advances the
 * engine's *virtual* clock by `FRAME_MS * speed` and emits a fresh snapshot.
 * Decoupling virtual time from wall-clock is what lets the "speed" control
 * fast-forward or slow-mo the simulation without touching the engine.
 */
export class SimSession {
  private engine: SimulationEngine;
  private scenario: Scenario;
  private virtualClock = 0;
  private speed = 1;
  private paused = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    scenario: Scenario,
    private readonly onFrame: (snap: SimSnapshot) => void,
  ) {
    this.scenario = scenario;
    this.engine = new SimulationEngine(scenario);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), FRAME_MS);
  }

  private tick(): void {
    if (this.paused) return;
    this.virtualClock += FRAME_MS * this.speed;
    this.engine.runUntil(this.virtualClock);
    this.onFrame(this.engine.snapshot());
  }

  getScenario(): Scenario {
    return this.scenario;
  }

  setLoad(multiplier: number): void {
    this.engine.setLoad(multiplier);
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.25, Math.min(8, speed));
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** Restart from t=0, optionally with a different architecture. */
  reset(scenario?: Scenario): void {
    if (scenario) this.scenario = scenario;
    this.engine = new SimulationEngine(this.scenario);
    this.virtualClock = 0;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
