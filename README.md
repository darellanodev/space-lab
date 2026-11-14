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
