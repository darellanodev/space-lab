import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Assets, fitToHeight } from './Assets.js';
import { LevelLoader, LIGHT_SCALE } from '../game/LevelLoader.js';

/* global __APP_VERSION__ */
export const VERSION = __APP_VERSION__;

export class Game {
  constructor(canvas, infoEl) {
    this.canvas = canvas;
    this.infoEl = infoEl;
    this.updatables = [];
    this.assets = new Assets();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02030a);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(0, 2.2, 5);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 1, 0);
    this.controls.update();

    this.clock = new THREE.Clock();
    this._frames = 0;
    this._fpsTime = 0;
    this._fps = 0;

    // Animation state (demo)
    this.mixer = null;
    this.actions = {};
    this.currentAction = null;

    this._buildLights();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('keydown', (e) => this._onKey(e));
    this._resize();
  }

  _buildLights() {
    // The original level used baked lightmaps (not ported yet), so we add a soft ambient light.
    this.scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x606070, LIGHT_SCALE.ambient));
  }

  /** Loads the sky, the level (?level=1, 2 or 3 in the URL) and the character. */
  async loadContent() {
    try {
      const levelNumber = Number(new URLSearchParams(location.search).get('level')) || 1;
      this.levelNumber = levelNumber;
      const loader = new LevelLoader(this.assets);
      const [sky, level, character] = await Promise.all([
        this.assets.loadSkybox(),
        loader.load(levelNumber),
        this.assets.loadFBX('character.fbx'),
      ]);
      this.scene.background = sky;
      this.scene.add(level.group);
      this.scene.updateMatrixWorld(true);
      this.levelStats = level.stats;
      console.info('[level]', level.stats);

      // Put the character where the Unity player started (the active "Player" object)
      const start = this._findPlayerStart(level.group);
      if (start) {
        const cc = start.userData.components.find((c) => c.type === 'CharacterController');
        const height = cc ? cc.height : 2;
        const pos = start.getWorldPosition(new THREE.Vector3());
        const quat = start.getWorldQuaternion(new THREE.Quaternion());
        this.scene.add(character);
        fitToHeight(character, height);
        character.position.x += pos.x;
        character.position.z += pos.z;
        character.position.y += pos.y + (cc ? cc.center[1] - cc.height / 2 : 0);
        character.quaternion.copy(quat);
        this._setupAnimations(character);
        this.controls.target.copy(pos);
        this.camera.position.copy(pos).add(new THREE.Vector3(0, 8, 12));
        this.controls.update();
      }
    } catch (err) {
      console.error(err);
      this.loadError = String(err.message || err);
    }
  }

  _findPlayerStart(root) {
    let found = null;
    root.traverse((n) => {
      if (found || n.userData.tag !== 'Player' || !n.userData.components) return;
      let visible = true;
      for (let p = n; p; p = p.parent) visible = visible && p.visible;
      if (visible && n.userData.components.some((c) => c.type === 'CharacterController')) found = n;
    });
    return found;
  }

  _setupAnimations(character) {
    const clips = character.animations;
    console.info('[animations]', clips.map((c) => `${c.name} (${c.duration.toFixed(2)}s)`));
    this.clipsInfo = clips.map((c) => `${c.name} ${c.duration.toFixed(2)}s`).join(', ') || 'none';
    if (!clips.length) return;

    this.mixer = new THREE.AnimationMixer(character);
    // Clip names in this FBX look like "rig|Idle". We keep only the last part, in lower case.
    for (const clip of clips) {
      const key = clip.name.split('|').pop().toLowerCase();
      this.actions[key] = this.mixer.clipAction(clip);
    }
    this._play(this.actions.idle ? 'idle' : Object.keys(this.actions)[0]);
  }

  _play(name) {
    const next = this.actions[name];
    if (!next || next === this.currentAction) return;
    next.reset().fadeIn(0.2).play();
    if (this.currentAction) this.currentAction.fadeOut(0.2);
    this.currentAction = next;
    this.currentName = name;
  }

  _stopAnimation() {
    if (this.mixer) this.mixer.stopAllAction();
    this.currentAction = null;
    this.currentName = 'none (base pose)';
  }

  _onKey(e) {
    if (e.key === '0') this._stopAnimation(); // shows the base pose
    if (e.key === '1') this._play('idle');
    if (e.key === '2') this._play('walk');
    if (e.key === '3') this._play('run');
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start() {
    this.renderer.setAnimationLoop(() => this._tick());
  }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.mixer) this.mixer.update(dt);
    for (const fn of this.updatables) fn(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    this._frames++;
    this._fpsTime += dt;
    if (this._fpsTime >= 0.5) {
      this._fps = Math.round(this._frames / this._fpsTime);
      this._frames = 0;
      this._fpsTime = 0;
      let text = `SpaceLab v${VERSION}\n${this._fps} fps\nKeys: 0 base pose, 1 idle, 2 walk, 3 run`;
      if (this.clipsInfo) text += `\nClips: ${this.clipsInfo}`;
      if (this.currentName) text += `\nAnimation: ${this.currentName}`;
      if (this.levelStats) text += `\nLevel ${this.levelNumber}: ${this.levelStats.meshes} meshes`;
      if (this.levelStats && this.levelStats.missingMeshes.length) text += `\nMissing meshes: ${this.levelStats.missingMeshes.length}`;
      if (this.loadError) text += `\nLOAD ERROR: ${this.loadError}`;
      this.infoEl.textContent = text;
    }
  }
}
