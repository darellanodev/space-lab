# SpaceLab (web port)

Requirements: Node 18+ and pnpm.

```bash
pnpm install
pnpm dev     # development
pnpm build   # creates dist/
```

The version is defined in `manifest.json` (it is shown on screen and must match `package.json`).
In the 0.2.0 demo: drag with the mouse to rotate the camera, keys 0, 1, 2, 3 change the character animation (base pose, idle, walk, run).
See `ROADMAP.md` for the plan.

`unity-meta/` keeps the Unity `.meta` files of the original project (they will be used by the level importer).

## Levels (0.3.0)
Open `http://localhost:5173/?level=1` (or 2, 3).
Levels are read from `public/levels/levelN.json`. They are made from the Unity scenes with a Python tool (not needed to run the game):

```bash
# 1. Unity 4.5 binary2text.exe makes a .txt file for each scene / material
# 2. guids.txt: grep -rH "^guid:" --include=*.meta Assets > guids.txt
python tools/unity2json.py scene scene1.unity.txt public/levels/level1.json unity-meta/guids.txt unity-meta
python tools/unity2json.py materials public/levels/materials.json unity-meta/guids.txt unity-meta --mats Assets/Materials
```
Textures go in `public/textures/` (one flat folder, same file names as in Unity).

## Controls (0.4.0)
WASD or arrows: move (relative to the camera). Shift: run. Space: jump.
Right mouse button or Alt: put the camera behind the character. O: free camera (mouse). K: show collision boxes.

Logic tests (no browser needed): `node tests/collision.test.mjs` and `node tests/player.test.mjs`.

## Character animations
The FBX animations are baked to `public/animations/character.json`:
`python tools/bake_animations.py public/models/character.fbx public/animations/character.json 30`
(needs Python 3 and numpy). Debug keys: P bind pose, M debug colors, 1 baked clips, 2 original FBX clips.

## Level rules (0.5.0)
Turn on the 4 computers by touching them, go to the exit door (it opens when all computers are on) and reach the teleport.
Code: `src/game/LevelLogic.js`. Door movement is set by `DOOR_SLIDE` in that file.

## Lives (0.6.0)
3 lives. `Game.loseLife()` takes one life, plays a sound and starts the level again (computers off, door closed, player at the start).
With no lives left, the Game Over sign is shown for 4 seconds and the page reloads. Test key: L (lose a life).

## Dangers (0.7.0)
Death floors (lava / pits) and lasers hurt the player: see `src/game/Hazards.js`. Lasers are on 2 seconds and off 2 seconds.
Level 1 has none; levels 2 and 3 do.

## Moving parts (0.8.0)
UFOs (go back and forth, hurt the player) and turning platforms (carry the player): see `src/game/Mechanisms.js`.

## Audio (0.9.0)
Each level plays its own music (the one set in the `InitLevel` object of the Unity scene). Effects: computer, door, life lost.
Key N turns the sound on / off (the choice is saved in the browser).

## Particles (0.10.0)
Teleport sparks (with a blue light), smoke and gas: `src/game/Particles.js`. The Unity particle settings were not exported,
so the effects are similar, not identical. Change the numbers in `KINDS` to adjust them.

## Menu (0.11.0)
Pages: main menu (no address), level list (`?screen=levels`) and game (`?level=N`). Code: `src/ui/Menu.js`, `src/core/Nav.js`.
Progress (last level finished, medals) is saved in the browser by `src/core/Save.js`. To start from zero, clear the site data of the page.

## Tutorial and credits (0.12.0)
The first time the player presses Start, the 4 tutorial pages are shown. After that, the tutorial and the credits are in the main menu.

## Congratulations (0.13.0)
The first time the player finishes the last level, the Congratulations screen is shown (`?screen=congratulations`).
