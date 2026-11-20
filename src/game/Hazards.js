import { touchesTriggers } from './Triggers.js';

/**
 * Dangers of the level (ported from DeathFloor.cs and Laser.cs).
 * - Death floor (lava / pit): touching it hurts.
 * - Laser: on for 2 seconds, off for 2 seconds (cycle of 4 seconds). Only hurts while on.
 * update() returns true when the player was hurt in this frame.
 */

const LASER_ON_SECONDS = 2;
const LASER_CYCLE_SECONDS = 4;

function scriptOf(obj, name) {
  return (obj.userData.components || []).find((c) => c.type === 'Script' && c.script === name);
}

export class Hazards {
  constructor(level) {
    this.floors = [];
    this.lasers = [];
    level.group.traverse((obj) => {
      const triggers = level.triggers.filter((t) => t.obj === obj);
      if (scriptOf(obj, 'DeathFloor.cs')) this.floors.push({ obj, triggers });
      const laser = scriptOf(obj, 'Laser.cs');
      if (laser) this.lasers.push({ obj, triggers, time: (laser.props && laser.props.tiempo) || 0 });
    });
  }

  /** Puts the lasers at the start of their cycle (used when the level starts again). */
  reset() {
    for (const l of this.lasers) {
      l.time = 0;
      l.obj.visible = true;
    }
  }

  update(dt, player) {
    let hurt = false;
    for (const l of this.lasers) {
      l.time = (l.time + dt) % LASER_CYCLE_SECONDS;
      const on = l.time < LASER_ON_SECONDS;
      l.obj.visible = on;
      if (on && touchesTriggers(l.triggers, player)) hurt = true;
    }
    for (const f of this.floors) {
      if (touchesTriggers(f.triggers, player)) hurt = true;
    }
    return hurt;
  }
}
