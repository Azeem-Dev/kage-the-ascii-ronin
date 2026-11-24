// ============================================================================
// Fixed-Timestep Game Loop
// 60 Hz deterministic update with interpolated render & performance telemetry
// ============================================================================

export interface LoopCallbacks {
  update: (dt: number) => void;
  render: (interpolation: number) => void;
}

export interface LoopStats {
  fps: number;
  frameTimeMs: number;
  renderTimeMs: number;
  updateTimeMs: number;
  elapsedTime: number;
  totalFrames: number;
}

export class GameLoop {
  private updateFn: (dt: number) => void;
  private renderFn: (interpolation: number) => void;

  private isRunning: boolean;
  private lastTime: number;
  private accumulator: number;
  private readonly fixedDt: number; // 1/60s in seconds

  // Telemetry stats
  public stats: LoopStats;
  private frameCount: number;
  private fpsTimer: number;

  constructor(callbacks: LoopCallbacks, targetFps = 60) {
    this.updateFn = callbacks.update;
    this.renderFn = callbacks.render;
    this.fixedDt = 1 / targetFps;
    this.isRunning = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.frameCount = 0;
    this.fpsTimer = 0;

    this.stats = {
      fps: 60,
      frameTimeMs: 16.6,
      renderTimeMs: 0,
      updateTimeMs: 0,
      elapsedTime: 0,
      totalFrames: 0,
    };
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.fpsTimer = this.lastTime;
    requestAnimationFrame(this.tick.bind(this));
  }

  public stop(): void {
    this.isRunning = false;
  }

  private tick(currentTime: number): void {
    if (!this.isRunning) return;

    // Delta time in seconds, clamped to avoid spiral of death
    const rawDelta = (currentTime - this.lastTime) / 1000;
    const dt = Math.min(rawDelta, 0.1);
    this.lastTime = currentTime;
    this.accumulator += dt;
    this.stats.elapsedTime += dt;

    // Fixed timestep update phase
    const updateStart = performance.now();
    while (this.accumulator >= this.fixedDt) {
      this.updateFn(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }
    this.stats.updateTimeMs = performance.now() - updateStart;

    // Interpolated render phase
    const interpolation = this.accumulator / this.fixedDt;
    const renderStart = performance.now();
    this.renderFn(interpolation);
    this.stats.renderTimeMs = performance.now() - renderStart;

    // Performance telemetry updates
    this.frameCount++;
    this.stats.totalFrames++;
    this.stats.frameTimeMs = dt * 1000;

    if (currentTime - this.fpsTimer >= 500) {
      this.stats.fps = Math.round((this.frameCount * 1000) / (currentTime - this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = currentTime;
    }

    requestAnimationFrame(this.tick.bind(this));
  }
}
