import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Assets, fitToHeight } from './Assets.js';

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

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
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
    this.scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x202030, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(5, 10, 7);
    this.scene.add(sun);
    this.scene.add(new THREE.GridHelper(20, 20, 0x3388aa, 0x113344));
  }

  /** Loads the sky and the demo models. Errors are shown on screen. */
  async loadContent() {
    try {
      const [sky, character, computer] = await Promise.all([
        this.assets.loadSkybox(),
        this.assets.loadFBX('character.fbx'),
        this.assets.loadFBX('computer.fbx'),
      ]);

      this.scene.background = sky;

      fitToHeight(character, 1.8);
      character.position.x = -1.5;
      this.scene.add(character);
      this._setupAnimations(character);

      fitToHeight(computer, 1.2);
      computer.position.x = 1.5;
      this.scene.add(computer);
      this.updatables.push((dt) => { computer.rotation.y += dt * 0.5; });
    } catch (err) {
      console.error(err);
      this.loadError = String(err.message || err);
    }
  }

  _setupAnimations(character) {
    const clips = character.animations;
    console.info('[animations]', clips.map((c) => `${c.name} (${c.duration.toFixed(2)}s)`));
    if (!clips.length) return;

    this.mixer = new THREE.AnimationMixer(character);
    for (const clip of clips) this.actions[clip.name.toLowerCase()] = this.mixer.clipAction(clip);
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

  _onKey(e) {
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
      let text = `SpaceLab v${VERSION}\n${this._fps} fps\nKeys: 1 idle, 2 walk, 3 run`;
      if (this.currentName) text += `\nAnimation: ${this.currentName}`;
      if (this.loadError) text += `\nLOAD ERROR: ${this.loadError}`;
      this.infoEl.textContent = text;
    }
  }
}
