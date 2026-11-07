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
