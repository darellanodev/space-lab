import * as THREE from 'three';

/**
 * Rules of one level (ported from Computer.cs, Exitdoor.cs and Teleport.cs):
 * - Touch a computer to turn it on (4 per level).
 * - When all computers are on, the exit door opens when the player gets near it.
 * - Touch the teleport to finish the level.
 */

const BASE = import.meta.env.BASE_URL;
const DOOR_SLIDE = new THREE.Vector3(0, 2.2, 0); // how far the door moves when it opens (door local space)
const DOOR_SECONDS = 1;
const OK_SIGN_TURN = Math.PI; // the OK signs of the computers face the other way

function hasScript(obj, name) {
  const comps = obj.userData.components || [];
  return comps.some((c) => c.type === 'Script' && c.script === name);
}

/** Makes a small plane that shows one cell of spritesheet1.png (4 columns x 2 rows). */
function makeCellMaterial(texture, col, row) {
  const t = texture.clone();
  t.needsUpdate = true;
  t.repeat.set(0.25, 0.5);
  t.offset.set(col * 0.25, 1 - (row + 1) * 0.5);
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
}

export class LevelLogic {
  /**
   * @param level      result of LevelLoader.load()
   * @param options    { playerShape, collisionWorld, boxesByObj, sound, onChange(state), onFinish() }
   */
  constructor(level, options) {
    this.level = level;
    this.o = options;
    this.computers = [];
    this.door = null;
    this.teleport = null;
    this.finished = false;
    this.sheet = new THREE.TextureLoader().load(`${BASE}textures/spritesheet1.png`);
    this.sheet.colorSpace = THREE.SRGBColorSpace;
    this._find();
  }

  _triggersOf(obj) {
    return this.level.triggers.filter((t) => t.obj === obj);
  }

  _find() {
    this.level.group.traverse((obj) => {
      if (hasScript(obj, 'Computer.cs')) this._addComputer(obj);
      else if (hasScript(obj, 'Exitdoor.cs')) this._addDoor(obj);
      else if (hasScript(obj, 'Teleport.cs')) this.teleport = { obj, triggers: this._triggersOf(obj) };
    });
    this._notify();
  }

  _addComputer(obj) {
    const off = makeCellMaterial(this.sheet, 2, 0); // yellow OK
    const on = makeCellMaterial(this.sheet, 3, 0); // green OK
    const lamps = [];
    obj.children.forEach((child) => {
      if (!child.name.startsWith('SpriteComputerOk')) return;
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), off);
      lamp.rotation.y = OK_SIGN_TURN;
      child.add(lamp);
      lamps.push(lamp);
    });
    this.computers.push({ obj, triggers: this._triggersOf(obj), active: false, lamps, off, on });
  }

  _addDoor(obj) {
    const lamps = [];
    const locked = makeCellMaterial(this.sheet, 1, 1); // yellow triangle
    const open = makeCellMaterial(this.sheet, 0, 1); // green triangle
    obj.children.forEach((child) => {
      if (child.name !== 'SpriteExitDoorOK') return;
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), locked);
      child.add(lamp);
      lamps.push(lamp);
    });
    this.door = {
      obj, triggers: this._triggersOf(obj), opened: false, progress: 0, lamps, locked, open,
      start: obj.position.clone(),
    };
  }

  get total() {
    return this.computers.length;
  }

  get active() {
    return this.computers.filter((c) => c.active).length;
  }

  get allOn() {
    return this.total > 0 && this.active === this.total;
  }

  _notify() {
    if (this.o.onChange) this.o.onChange({ active: this.active, total: this.total, doorOpen: !!(this.door && this.door.opened) });
  }

  /** True if the player (a vertical capsule) touches one of the trigger boxes. */
  _touches(triggers, p) {
    const shape = p.capsule;
    const r = shape.radius * 0.8;
    const heights = [shape.bottom + 0.3, shape.bottom + shape.height * 0.5, shape.bottom + shape.height - 0.3];
    const point = new THREE.Vector3();
    const local = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const inv = new THREE.Matrix4();
    for (const t of triggers) {
      t.obj.updateWorldMatrix(true, false);
      inv.copy(t.obj.matrixWorld).invert();
      scale.setFromMatrixScale(t.obj.matrixWorld);
      const h = new THREE.Vector3().fromArray(t.size).multiplyScalar(0.5);
      const c = new THREE.Vector3().fromArray(t.center);
      for (const y of heights) {
        point.set(p.pos.x, p.pos.y + y, p.pos.z);
        local.copy(point).applyMatrix4(inv).sub(c);
        const out = new THREE.Vector3(
          Math.max(Math.abs(local.x) - h.x, 0) * scale.x,
          Math.max(Math.abs(local.y) - h.y, 0) * scale.y,
          Math.max(Math.abs(local.z) - h.z, 0) * scale.z,
        );
        if (out.length() <= r) return true;
      }
    }
    return false;
  }

  /** Starts the level again after the player loses a life: computers off, door closed. */
  reset() {
    for (const c of this.computers) {
      c.active = false;
      c.lamps.forEach((l) => { l.material = c.off; });
    }
    const d = this.door;
    if (d) {
      if (d.opened) for (const box of this.o.boxesByObj.get(d.obj) || []) this.o.collisionWorld.boxes.push(box);
      d.opened = false;
      d.progress = 0;
      d.obj.position.copy(d.start);
      d.lamps.forEach((l) => { l.material = d.locked; });
    }
    this._notify();
  }

  /** Call once per frame. */
  update(dt, player) {
    if (this.finished) return;
    for (const c of this.computers) {
      if (c.active || !this._touches(c.triggers, player)) continue;
      c.active = true;
      c.lamps.forEach((l) => { l.material = c.on; });
      this.o.sound.play('computer.mp3');
      if (this.allOn && this.door) this.door.lamps.forEach((l) => { l.material = this.door.open; });
      this._notify();
    }
    const d = this.door;
    if (d) {
      if (!d.opened && this.allOn && this._touches(d.triggers, player)) {
        d.opened = true;
        this.o.sound.play('opendoor.mp3');
        // the closed door blocks the player: remove its collision boxes
        for (const box of this.o.boxesByObj.get(d.obj) || []) this.o.collisionWorld.removeBox(box);
        this._notify();
      }
      if (d.opened && d.progress < 1) {
        d.progress = Math.min(1, d.progress + dt / DOOR_SECONDS);
        const k = d.progress * d.progress * (3 - 2 * d.progress); // smooth start and end
        d.obj.position.copy(d.start).add(DOOR_SLIDE.clone().applyQuaternion(d.obj.quaternion).multiplyScalar(k));
      }
    }
    if (this.teleport && this._touches(this.teleport.triggers, player)) {
      this.finished = true;
      if (this.o.onFinish) this.o.onFinish();
    }
  }
}
