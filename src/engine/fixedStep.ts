// Fixed-timestep helper: simulate at a constant rate, render with an interpolation alpha.
// Import-free.

export class FixedStepper {
  readonly step: number;
  /** Frame times longer than this (tab switch, breakpoint) are clamped. */
  maxFrame: number;
  /** Hard cap on simulation steps per frame (no spiral of death). */
  maxSteps: number;
  paused = false;
  accumulator = 0;
  /** Steps run by the last advance() call and time dropped by the cap (diagnostics). */
  lastSteps = 0; dropped = 0;

  constructor(hz = 60, maxSteps = 5, maxFrame = .25) {
    this.step = 1 / hz; this.maxSteps = maxSteps; this.maxFrame = maxFrame;
  }

  /** Feed the real elapsed seconds; calls update(step) zero or more times. Returns alpha in [0,1) for
   * interpolating between the previous and current simulation state when drawing. While paused no
   * time accumulates, no update runs, and alpha stays at its last value. */
  advance(frameSeconds: number, update: (dt: number) => void): number {
    this.lastSteps = 0;
    if (this.paused) return this.alpha;
    const frame = Number.isFinite(frameSeconds) ? Math.min(Math.max(frameSeconds, 0), this.maxFrame) : 0;
    this.accumulator += frame;
    while (this.accumulator >= this.step - 1e-9 && this.lastSteps < this.maxSteps) {
      update(this.step); this.accumulator -= this.step; this.lastSteps++;
    }
    if (this.accumulator >= this.step) { this.dropped += this.accumulator - (this.accumulator % this.step); this.accumulator %= this.step; }
    if (this.accumulator < 0) this.accumulator = 0;
    return this.alpha;
  }

  get alpha(): number { return Math.min(1, Math.max(0, this.accumulator / this.step)); }
  reset(): void { this.accumulator = 0; this.lastSteps = 0; }
}
