export class SceneManager {
  constructor() { this.scene = null; }
  set(scene) { if (this.scene?.exit) this.scene.exit(); this.scene = scene; this.scene?.enter?.(); }
  update(dt) { this.scene?.update?.(dt); }
  render() { this.scene?.render?.(); }
}
