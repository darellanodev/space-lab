import { CollisionWorld } from '../src/game/Collision.js';
import { PlayerController, FollowCamera } from '../src/game/PlayerController.js';
const w = new CollisionWorld();
w.addBox({ center: [0, -0.5, 0], half: [50, 0.5, 50], quat: [0, 0, 0, 1] });
w.addBox({ center: [0, 1.5, 12], half: [20, 1.5, 0.5], quat: [0, 0, 0, 1] });
const pl = new PlayerController({ position: { x: 0, y: 0.5, z: 0 }, yaw: 0, controller: { radius: 0.5, height: 2.3, center: [0, 1.27, 0] }, world: w });
const cam = new FollowCamera({ distance: 4, height: 2 }); cam.cut(pl);
const dt = 1 / 60;
const run = (secs, input) => { for (let i = 0; i < secs * 60; i++) { pl.update(dt, { h: 0, v: 0, run: false, jumpPressed: false, ...input }, cam.angle); cam.update(dt, pl); } };
run(1, {}); console.log('idle  y', pl.pos.y.toFixed(3), 'grounded', pl.grounded, pl.anim);
run(1, { v: 1 }); console.log('W 1s  z', pl.pos.z.toFixed(2), 'x', pl.pos.x.toFixed(2), pl.anim, 'speed', pl.speed.toFixed(2));
run(1, { v: 1 }); console.log('W 2s  z', pl.pos.z.toFixed(2), pl.anim, '(trot after 1.5s)', 'speed', pl.speed.toFixed(2));
run(1, { h: 1 }); console.log('D 1s  x', pl.pos.x.toFixed(2), '(screen-right = -X expected), cam angle', cam.angle.toFixed(1));
run(3, { h: 1 }); console.log('D 4s  x', pl.pos.x.toFixed(2), 'cam angle', cam.angle.toFixed(1));
run(4, { v: 1, run: true }); console.log('run into wall z', pl.pos.z.toFixed(2), '(wall face at z=11.5 -> max ~11.0)');
pl.update(dt, { h: 0, v: 0, run: false, jumpPressed: true }, cam.angle); let maxY = pl.pos.y; for (let i = 0; i < 60; i++) { pl.update(dt, { h: 0, v: 0, run: false, jumpPressed: false }, cam.angle); maxY = Math.max(maxY, pl.pos.y); } console.log('jump max rise', (maxY - 0.0).toFixed(2), 'after', pl.pos.y.toFixed(2), pl.grounded);
console.log('cam pos', cam.position, 'look', cam.lookAt);
// fresh player: run straight to the wall
const pl2 = new PlayerController({ position: { x: 0, y: 0.5, z: 0 }, yaw: 0, controller: { radius: 0.5, height: 2.3, center: [0, 1.27, 0] }, world: w });
const cam2 = new FollowCamera(); cam2.cut(pl2);
for (let i = 0; i < 60 * 5; i++) { pl2.update(dt, { h: 0, v: 1, run: true, jumpPressed: false }, cam2.angle); cam2.update(dt, pl2); }
console.log('fresh run z', pl2.pos.z.toFixed(2), '(expected ~11.0)', 'grounded', pl2.grounded);
let flicker = 0; const pl3 = new PlayerController({ position: { x: 0, y: 0.5, z: 0 }, yaw: 0, controller: { radius: 0.5, height: 2.3, center: [0, 1.27, 0] }, world: w });
for (let i = 0; i < 120; i++) { pl3.update(dt, { h: 0, v: 0, run: false, jumpPressed: false }, 0); if (i > 30 && !pl3.grounded) flicker++; } console.log('idle grounded flicker frames:', flicker);
