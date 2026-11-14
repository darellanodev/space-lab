import { CollisionWorld } from './Collision.js'; // eslint-disable-line no-unused-vars

/**
 * Port of Unity's ThirdPersonController.js and ThirdPersonCamera.js (Standard Assets).
 * It has no Three.js code, so it can be tested with plain Node.js.
 * Coordinates are already in Three.js space (X mirrored from Unity). Angles of the
 * camera are in degrees; "yaw" is atan2(x, z), so yaw 0 looks to +Z.
 */

const DEG = 180 / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const deltaAngle = (a, b) => ((((b - a) % 360) + 540) % 360) - 180; // shortest angle from a to b

/** Same as Unity's Mathf.SmoothDamp. `state.v` keeps the speed between frames. */
function smoothDamp(current, target, state, smoothTime, maxSpeed, dt) {
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const originalTo = target;
  const maxChange = maxSpeed * smoothTime;
  const change = clamp(current - target, -maxChange, maxChange);
  target = current - change;
  const temp = (state.v + omega * change) * dt;
  state.v = (state.v - omega * temp) * exp;
  let output = target + (change + temp) * exp;
  if (originalTo - current > 0 === output > originalTo) {
    output = originalTo;
    state.v = (output - originalTo) / dt;
  }
  return output;
}

function smoothDampAngle(current, target, state, smoothTime, maxSpeed, dt) {
  return smoothDamp(current, current + deltaAngle(current, target), state, smoothTime, maxSpeed, dt);
}

export const DEFAULT_PLAYER_PROPS = {
  walkSpeed: 3.5, trotSpeed: 6.5, runSpeed: 7, inAirControlAcceleration: 3, jumpHeight: 0.5,
  gravity: 20, speedSmoothing: 10, rotateSpeed: 1000, trotAfterSeconds: 1.5, canJump: 1,
};

export const DEFAULT_CAMERA_PROPS = {
  distance: 4, height: 2, angularSmoothLag: 0.3, angularMaxSpeed: 70, heightSmoothLag: 0.3,
  lockCameraTimeout: 0.2, snapSmoothLag: 0.2, snapMaxSpeed: 1720,
};

export class PlayerController {
  /**
   * @param {object} o
   * @param {{x,y,z}} o.position  origin of the character (feet)
   * @param {number} o.yaw        initial facing, radians
   * @param {{radius,height,center:number[]}} o.controller  Unity CharacterController values
   * @param {object} o.props      values of ThirdPersonController.js in the scene
   * @param {CollisionWorld} o.world
   */
  constructor({ position, yaw = 0, controller, props = {}, world }) {
    this.p = { ...DEFAULT_PLAYER_PROPS, ...props };
    this.pos = { x: position.x, y: position.y, z: position.z };
    this.controller = controller;
    this.world = world;
    this.capsule = {
      radius: controller.radius,
      bottom: controller.center[1] - controller.height / 2,
      height: controller.height,
    };

    this.time = 0;
    this.moveDir = [Math.sin(yaw), Math.cos(yaw)];
    this.moveSpeed = 0;
    this.verticalSpeed = 0;
    this.inAir = [0, 0];
    this.isMoving = false;
    this.movingBack = false;
    this.walkTimeStart = 0;
    this.lastJumpButtonTime = -10;
    this.lastJumpTime = -1;
    this.jumping = false;
    this.grounded = false;
    this.lockCameraTimer = 0;
    this.yaw = yaw; // facing of the model, radians
    this.speed = 0; // real speed (units per second)
    this.anim = 'idle'; // 'idle' | 'walk' | 'run'
  }

  /**
   * @param {number} dt seconds
   * @param {{h:number, v:number, run:boolean, jumpPressed:boolean}} input
   * @param {number} camYawDeg  yaw of the camera (degrees)
   */
  update(dt, input, camYawDeg) {
    this.time += dt;
    const p = this.p;
    if (input.jumpPressed) this.lastJumpButtonTime = this.time;

    // --- UpdateSmoothedMovementDirection ---
    const cy = camYawDeg / DEG;
    const fwd = [Math.sin(cy), Math.cos(cy)];
    const right = [-fwd[1], fwd[0]]; // right of the camera in Three.js space
    const { h, v } = input;
    this.movingBack = v < -0.2;
    const wasMoving = this.isMoving;
    this.isMoving = Math.abs(h) > 0.1 || Math.abs(v) > 0.1;
    const target = [h * right[0] + v * fwd[0], h * right[1] + v * fwd[1]];
    const targetLen = Math.hypot(target[0], target[1]);

    if (this.grounded) {
      this.lockCameraTimer += dt;
      if (this.isMoving !== wasMoving) this.lockCameraTimer = 0;
      if (targetLen > 0) {
        const t = [target[0] / targetLen, target[1] / targetLen];
        if (this.moveSpeed < p.walkSpeed * 0.9) {
          this.moveDir = t;
        } else {
          const cur = Math.atan2(this.moveDir[0], this.moveDir[1]);
          const tgt = Math.atan2(t[0], t[1]);
          let d = tgt - cur;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          const step = clamp(d, -(p.rotateSpeed / DEG) * dt, (p.rotateSpeed / DEG) * dt);
          this.moveDir = [Math.sin(cur + step), Math.cos(cur + step)];
        }
      }
      let targetSpeed = Math.min(targetLen, 1);
      this.state = 'walk';
      if (input.run) { targetSpeed *= p.runSpeed; this.state = 'run'; }
      else if (this.time - p.trotAfterSeconds > this.walkTimeStart) { targetSpeed *= p.trotSpeed; this.state = 'trot'; }
      else targetSpeed *= p.walkSpeed;
      const k = Math.min(p.speedSmoothing * dt, 1);
      this.moveSpeed += (targetSpeed - this.moveSpeed) * k;
      if (this.moveSpeed < p.walkSpeed * 0.3) this.walkTimeStart = this.time;
    } else {
      if (this.jumping) this.lockCameraTimer = 0;
      if (this.isMoving && targetLen > 0) {
        this.inAir[0] += (target[0] / targetLen) * dt * p.inAirControlAcceleration;
        this.inAir[1] += (target[1] / targetLen) * dt * p.inAirControlAcceleration;
      }
    }

    // --- ApplyGravity ---
    if (this.grounded) this.verticalSpeed = 0;
    else this.verticalSpeed -= p.gravity * dt;

    // --- ApplyJumping ---
    if (this.lastJumpTime + 0.05 <= this.time && this.grounded && p.canJump
        && this.time < this.lastJumpButtonTime + 0.15) {
      this.verticalSpeed = Math.sqrt(2 * p.jumpHeight * p.gravity);
      this.jumping = true;
      this.lastJumpTime = this.time;
      this.lastJumpButtonTime = -10;
    }

    // --- Move ---
    const move = [
      (this.moveDir[0] * this.moveSpeed + this.inAir[0]) * dt,
      this.verticalSpeed * dt,
      (this.moveDir[1] * this.moveSpeed + this.inAir[1]) * dt,
    ];
    const before = { ...this.pos };
    const res = this.world.moveCapsule(this.pos, move, this.capsule);
    this.grounded = res.grounded;
    this.speed = Math.hypot(this.pos.x - before.x, this.pos.y - before.y, this.pos.z - before.z) / dt;

    // --- Animation (Unity Mecanim: 0 idle, 1 walk, 2 run) ---
    if (!this.jumping) {
      if (this.speed * this.speed < 0.1) this.anim = 'idle';
      else if (this.state === 'run' || this.state === 'trot') this.anim = 'run';
      else this.anim = 'walk';
    }

    // --- Rotation of the model ---
    if (this.grounded) {
      this.yaw = Math.atan2(this.moveDir[0], this.moveDir[1]);
    } else if (move[0] * move[0] + move[2] * move[2] > 1e-6) {
      this.yaw = Math.atan2(move[0], move[2]);
    }

    if (this.grounded) {
      this.inAir = [0, 0];
      this.jumping = false;
    }
  }
}

export class FollowCamera {
  constructor(props = {}) {
    this.c = { ...DEFAULT_CAMERA_PROPS, ...props };
    this.angle = 0; // degrees
    this.angleVel = { v: 0 };
    this.heightVel = { v: 0 };
    this.y = 0;
    this.snap = false;
    this.position = { x: 0, y: 0, z: 0 };
    this.lookAt = { x: 0, y: 0, z: 0 };
  }

  /** Puts the camera behind the player at once (no smoothing). */
  cut(player) {
    this.angle = player.yaw * DEG;
    this.y = player.pos.y + player.controller.center[1] + this.c.height;
    this.angleVel.v = 0;
    this.heightVel.v = 0;
    this._place(player);
  }

  /** @param {boolean} recenter  true while the "recenter camera" button is pressed */
  update(dt, player, recenter = false) {
    const c = this.c;
    const centerY = player.pos.y + player.controller.center[1];
    let targetAngle = player.yaw * DEG;
    if (recenter) this.snap = true;
    if (this.snap) {
      if (Math.abs(deltaAngle(this.angle, targetAngle)) < 3) this.snap = false;
      this.angle = smoothDampAngle(this.angle, targetAngle, this.angleVel, c.snapSmoothLag, c.snapMaxSpeed, dt);
    } else {
      if (player.lockCameraTimer < c.lockCameraTimeout) targetAngle = this.angle;
      if (Math.abs(deltaAngle(this.angle, targetAngle)) > 160 && player.movingBack) targetAngle += 180;
      this.angle = smoothDampAngle(this.angle, targetAngle, this.angleVel, c.angularSmoothLag, c.angularMaxSpeed, dt);
    }
    this.y = smoothDamp(this.y, centerY + c.height, this.heightVel, c.heightSmoothLag, Infinity, dt);
    this._place(player);
  }

  _place(player) {
    const a = this.angle / DEG;
    const cx = player.pos.x, cz = player.pos.z;
    const cy = player.pos.y + player.controller.center[1];
    this.position = { x: cx - Math.sin(a) * this.c.distance, y: this.y, z: cz - Math.cos(a) * this.c.distance };
    this.lookAt = { x: cx, y: cy, z: cz };
  }
}
