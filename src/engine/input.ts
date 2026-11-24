// ============================================================================
// Input System & Debug Key Handler
// Handles keyboard input and intercepts F1-F4 debug hotkeys
// ============================================================================

export type KeyActionCallback = () => void;

export class InputManager {
  private keysDown: Set<string>;
  private keyJustPressed: Set<string>;
  private debugKeyCallbacks: Map<string, KeyActionCallback>;

  constructor() {
    this.keysDown = new Set();
    this.keyJustPressed = new Set();
    this.debugKeyCallbacks = new Map();

    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Intercept function keys to prevent default browser behavior
    if (['F1', 'F2', 'F3', 'F4', 'Tab'].includes(e.key)) {
      e.preventDefault();
    }

    const isNewPress = !this.keysDown.has(e.code);
    if (isNewPress) {
      this.keyJustPressed.add(e.code);
    }
    this.keysDown.add(e.code);

    // Trigger debug callbacks only on the initial keydown, not while held.
    const cb = this.debugKeyCallbacks.get(e.key) || this.debugKeyCallbacks.get(e.code);
    if (cb && isNewPress) {
      cb();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.code);
  }

  public registerDebugKey(key: string, callback: KeyActionCallback): void {
    this.debugKeyCallbacks.set(key, callback);
  }

  public isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  public isKeyJustPressed(code: string): boolean {
    return this.keyJustPressed.has(code);
  }

  public endFrame(): void {
    this.keyJustPressed.clear();
  }
}
