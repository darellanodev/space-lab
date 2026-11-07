# SpaceLab – Roadmap for the Unity → Three.js port

Versioning: `0.X.0` for each new feature. The first digit stays at 0 until the port is complete.
Each delivery: `spacelab-v0-X-0.zip` with `manifest.json` and `package.json` in sync.

## Original game summary
- 3 levels (`scene1..3`) and 10 menu / tutorial / credits screens.
- Goal: turn on the 4 computers (`Computer`) → the exit door (`Exitdoor`) opens → the `Teleport` ends the level.
- 3 lives. Any damage: -1 life, computers, door and player position are reset. At 0 lives: Game Over for 4 s, then back to the menu.
- Dangers: **Ufo** (moves between two points with a sine wave, spins), **Laser** (2 s on / 2 s off, 4 s cycle), **DeathFloor** (lava / pit), **Girador** (rotating platform that drags the player).
- Saved progress (PlayerPrefs): last unlocked level, medals per level (= lives left: 1 bronze, 2 silver, 3 gold), tutorial forced on first run.
- HUD: hearts (lives), computers (x/4), Game Over sign.
- PC and mobile (touch) controls. Space skybox, baked lightmaps, particles (gas / smoke), music and sound effects.

## Milestones
| Version | Feature | Status |
|---|---|---|
| 0.1.0 | Vite + Three.js skeleton, scene, camera, game loop, manifest | ✅ |
| 0.2.0 | FBX model loader (GLB later) + space skybox + character animations demo | ✅ |
| 0.3.0 | Character: movement, camera and wall collisions | ☐ |
| 0.4.0 | Unity scene → JSON level importer (prefab positions) and level 1 loading | ☐ |
| 0.5.0 | Computers, exit door, teleport and end of level | ☐ |
| 0.6.0 | GameManager: lives, level reset, Game Over | ☐ |
| 0.7.0 | Dangers: lava (DeathFloor) and lasers | ☐ |
| 0.8.0 | Dangers: UFOs and rotating platforms | ☐ |
| 0.9.0 | HUD (lives, computers, Game Over) | ☐ |
| 0.10.0 | Audio: music and sound effects | ☐ |
| 0.11.0 | Lighting, approximated lightmaps, particles | ☐ |
| 0.12.0 | Main menu, level selector, loading screen | ☐ |
| 0.13.0 | Tutorial and credits | ☐ |
| 0.14.0 | Saving (localStorage): unlocks and medals, Congratulations screen | ☐ |
| 0.15.0 | Levels 2 and 3 | ☐ |
| 0.16.0 | Touch / mobile controls | ☐ |
| 0.17.0 | Optimization, build and web deployment | ☐ |

## Waiting for files
- [ ] `Assets/Scenes/niveles/*.unity` (scene1–3) and `Assets/Scenes/portadas/*.unity`
- [ ] `Assets/Prefabs` (`.prefab`) and `Assets/Animations`
- [ ] Remaining models (`Assets/Meshes`, `.fbx` is fine) and textures
- [ ] Sounds (`Assets/Sounds`)
- [ ] Character controls and camera (see `Standard Assets/Character Controllers`)

## Technical decisions
- Vite + Three.js (ES modules). Own collisions (AABB / capsule) at first; Rapier if needed.
- Unity `.exr` lightmaps are not reused directly: they are approximated with lights / AO.
- `GUITexture` / `OnGUI` → HTML/CSS over the canvas.
