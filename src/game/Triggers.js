import * as THREE from 'three';

/** True if the player (a vertical capsule) touches one of the trigger boxes. */
export function touchesTriggers(triggers, p) {
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
