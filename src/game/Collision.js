/**
 * Simple collision for the player: a vertical capsule against oriented boxes.
 * This file has no dependencies, so it can be tested with plain Node.js.
 *
 * A box is { center: [x,y,z], half: [hx,hy,hz], quat: [x,y,z,w] }.
 * The capsule is approximated with several spheres placed from the feet to the head.
 */

/** Rotation matrix (3 columns = the box axes in world space) from a quaternion. */
function axesFromQuat([x, y, z, w]) {
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    [1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy)], // local X axis in world space
    [2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx)], // local Y axis
    [2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy)], // local Z axis
  ];
}

export class CollisionWorld {
  constructor() {
    this.boxes = [];
  }

  addBox({ center, half, quat }) {
    const axes = axesFromQuat(quat);
    // Bounding sphere radius, used to skip far boxes quickly
    const radius = Math.hypot(half[0], half[1], half[2]);
    this.boxes.push({ center, half, axes, radius });
  }

  /**
   * Pushes a sphere out of every box it touches.
   * Returns true if it touched the ground (a surface that looks up).
   */
  _resolveSphere(c, r, out) {
    let grounded = false;
    for (const b of this.boxes) {
      const dx = c[0] - b.center[0], dy = c[1] - b.center[1], dz = c[2] - b.center[2];
      const reach = b.radius + r;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;

      // Sphere center in the local space of the box
      const [ax, ay, az] = b.axes;
      const l = [
        dx * ax[0] + dy * ax[1] + dz * ax[2],
        dx * ay[0] + dy * ay[1] + dz * ay[2],
        dx * az[0] + dy * az[1] + dz * az[2],
      ];
      const q = [
        Math.max(-b.half[0], Math.min(b.half[0], l[0])),
        Math.max(-b.half[1], Math.min(b.half[1], l[1])),
        Math.max(-b.half[2], Math.min(b.half[2], l[2])),
      ];
      let n = [l[0] - q[0], l[1] - q[1], l[2] - q[2]];
      const dist = Math.hypot(n[0], n[1], n[2]);
      let push;
      if (dist > 1e-6) {
        if (dist >= r) continue;
        push = r - dist;
        n = [n[0] / dist, n[1] / dist, n[2] / dist];
      } else {
        // The center is inside the box: leave by the nearest face
        let axis = 0, best = Infinity;
        for (let i = 0; i < 3; i++) {
          const gap = b.half[i] - Math.abs(l[i]);
          if (gap < best) { best = gap; axis = i; }
        }
        n = [0, 0, 0];
        n[axis] = l[axis] >= 0 ? 1 : -1;
        push = best + r;
      }
      // Normal in world space
      const w = [
        ax[0] * n[0] + ay[0] * n[1] + az[0] * n[2],
        ax[1] * n[0] + ay[1] * n[1] + az[1] * n[2],
        ax[2] * n[0] + ay[2] * n[1] + az[2] * n[2],
      ];
      out[0] += w[0] * push; out[1] += w[1] * push; out[2] += w[2] * push;
      c[0] += w[0] * push; c[1] += w[1] * push; c[2] += w[2] * push;
      if (w[1] > 0.5) grounded = true;
    }
    return grounded;
  }

  /**
   * Moves the capsule. `pos` is the character origin (it is changed in place).
   * capsule: { radius, bottom (height of the capsule bottom over pos.y), height }
   * Returns { grounded, hitWall }.
   */
  moveCapsule(pos, movement, capsule) {
    const { radius, bottom, height } = capsule;
    const length = Math.hypot(movement[0], movement[1], movement[2]);
    const steps = Math.max(1, Math.ceil(length / (radius * 0.5))); // small steps: no tunneling
    let grounded = false;
    let hitWall = false;

    // Heights of the spheres, from the feet to the head
    const ys = [];
    const span = height - 2 * radius;
    const count = Math.max(2, Math.ceil(span / radius) + 1);
    for (let i = 0; i < count; i++) ys.push(bottom + radius + (span * i) / (count - 1));

    for (let s = 0; s < steps; s++) {
      pos.x += movement[0] / steps;
      pos.y += movement[1] / steps;
      pos.z += movement[2] / steps;
      for (let pass = 0; pass < 3; pass++) {
        const push = [0, 0, 0];
        for (const y of ys) {
          const c = [pos.x + push[0], pos.y + y + push[1], pos.z + push[2]];
          const before = [c[0], c[1], c[2]];
          if (this._resolveSphere(c, radius, [0, 0, 0])) grounded = true;
          push[0] += c[0] - before[0]; push[1] += c[1] - before[1]; push[2] += c[2] - before[2];
        }
        if (push[0] === 0 && push[1] === 0 && push[2] === 0) break;
        if (Math.abs(push[0]) + Math.abs(push[2]) > 1e-5) hitWall = true;
        pos.x += push[0]; pos.y += push[1]; pos.z += push[2];
      }
    }
    // Resting on the floor: gravity is 0 then, so we look a little below the feet
    if (!grounded && movement[1] <= 0) {
      const probe = [pos.x, pos.y + ys[0] - 0.03, pos.z];
      grounded = this._resolveSphere(probe, radius, [0, 0, 0]);
    }
    return { grounded, hitWall };
  }
}
