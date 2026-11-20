import * as THREE from 'three';
import { touchesTriggers } from './Triggers.js';

/**
 * Moving parts of the level (ported from Ufo.cs and Girador.cs).
 * - Ufo: goes back and forth between its start and a reference object, turning all the time. It hurts.
 * - Girador: a platform that turns slowly and carries the player with it.
 * Unity ran these scripts once per frame at about 60 fps, so the per-frame values are multiplied by 60.
 * Unity turns clockwise for positive angles and Three.js the other way, so angles get a minus sign.
 */

const FPS = 60;
const DEG = Math.PI / 180;
const UFO_TURN_DEG = 3; // per frame
const GIRADOR_TURN_DEG = 1; // per frame
const GIRADOR_CARRY_DEG = GIRADOR_TURN_DEG; // per frame; same as the platform, so the player does not slide

function scriptOf(obj, name) {
  return (obj.userData.components || []).find((c) => c.type === 'Script' && c.script === name);
}

export class Mechanisms {
  /**
   * @param level   result of LevelLoader.load()
   * @param refreshColliders(obj)  called after a level object moved, to move its collision boxes
   */
  constructor(level, refreshColliders) {
    this.refresh = refreshColliders;
    this.time = 0;
    this.ufos = [];
    this.giradores = [];
    const byId = new Map();
    level.group.traverse((o) => { if (o.userData.unityId !== undefined) byId.set(o.userData.unityId, o); });
    level.group.updateMatrixWorld(true);
    level.group.traverse((obj) => {
      const triggers = level.triggers.filter((t) => t.obj === obj);
      const ufo = scriptOf(obj, 'Ufo.cs');
      if (ufo) {
        const target = byId.get(ufo.props.finalPosRef && ufo.props.finalPosRef.ref);
        if (target) {
          this.ufos.push({
            obj, triggers, speed: ufo.props.speed || 1,
            from: obj.getWorldPosition(new THREE.Vector3()), to: target.getWorldPosition(new THREE.Vector3()),
          });
        }
      }
      const gir = scriptOf(obj, 'Girador.cs');
      if (gir) {
        const pivot = byId.get(gir.props.puntogiro && gir.props.puntogiro.ref);
        this.giradores.push({ obj, triggers, pivot: pivot ? pivot.getWorldPosition(new THREE.Vector3()) : obj.getWorldPosition(new THREE.Vector3()) });
      }
    });
  }

  /** Moves everything. Returns true if a ufo hit the player. */
  update(dt, player) {
    this.time += dt;
    let hurt = false;
    const pos = new THREE.Vector3();
    for (const u of this.ufos) {
      const k = (Math.sin(u.speed * this.time) + 1) / 2;
      pos.lerpVectors(u.from, u.to, k);
      if (u.obj.parent) u.obj.parent.worldToLocal(pos);
      u.obj.position.copy(pos);
      u.obj.rotateY(-UFO_TURN_DEG * FPS * DEG * dt);
      u.obj.updateMatrixWorld(true);
      if (touchesTriggers(u.triggers, player)) hurt = true;
    }
    for (const g of this.giradores) {
      const turn = -GIRADOR_TURN_DEG * FPS * DEG * dt;
      g.obj.rotateY(turn);
      g.obj.updateMatrixWorld(true);
      this.refresh(g.obj);
      if (touchesTriggers(g.triggers, player)) this._carry(player, g.pivot, -GIRADOR_CARRY_DEG * FPS * DEG * dt);
    }
    return hurt;
  }

  /** Turns the player around the pivot point (angle in radians, around the Y axis). */
  _carry(player, pivot, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const dx = player.pos.x - pivot.x;
    const dz = player.pos.z - pivot.z;
    player.pos.x = pivot.x + dx * c + dz * s;
    player.pos.z = pivot.z - dx * s + dz * c;
    player.yaw += a;
    const [mx, mz] = player.moveDir;
    player.moveDir = [mx * c + mz * s, -mx * s + mz * c];
  }
}
