import { CollisionWorld } from '../src/game/Collision.js';
const w = new CollisionWorld();
w.addBox({ center: [0, -0.5, 0], half: [20, 0.5, 20], quat: [0, 0, 0, 1] });      // floor, top at y=0
w.addBox({ center: [5, 1.5, 0], half: [0.5, 1.5, 20], quat: [0, 0, 0, 1] });      // wall, face at x=4.5
const s = Math.SQRT1_2;
w.addBox({ center: [-5, 1.5, 0], half: [20, 1.5, 0.5], quat: [0, s, 0, s] });     // rotated 90deg wall (becomes a plane x-thin->z-thin)
const pos = { x: 0, y: 3, z: 0 };
const cap = { radius: 0.5, bottom: 0.12, height: 2.3 };
let g = false, vy = 0;
for (let i = 0; i < 120; i++) { vy -= 20 / 60; const r = w.moveCapsule(pos, [0, vy / 60, 0], cap); g = r.grounded; if (g) vy = 0; }
console.log('fall -> y', pos.y.toFixed(3), 'grounded', g, '(expected ~ -0.12 .. 0)');
// walk into the wall at x=4.5 diagonal: should slide along z
for (let i = 0; i < 120; i++) { vy = -0.3; const r = w.moveCapsule(pos, [0.1, vy / 60, 0.05], cap); }
console.log('wall x', pos.x.toFixed(3), '(expected <= 4.0)', 'z', pos.z.toFixed(2), '(slides, expected > 5)');
// big step test (tunneling): move 3 units in one go
const p2 = { x: 3, y: 0, z: 0 }; w.moveCapsule(p2, [3, 0, 0], cap); console.log('tunnel x', p2.x.toFixed(2), '(expected <= 4.0)');
// rotated wall
const p3 = { x: 0, y: 0, z: 0 }; for (let i = 0; i < 100; i++) w.moveCapsule(p3, [-0.1, -0.01, 0], cap); console.log('rot wall x', p3.x.toFixed(2), '(expected >= -4.0)');
