import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Assets, fitToHeight } from './Assets.js';
import { LevelLoader, LIGHT_SCALE } from '../game/LevelLoader.js';
import { CollisionWorld } from '../game/Collision.js';
import { PlayerController, FollowCamera } from '../game/PlayerController.js';
import { Input } from '../game/Input.js';

/* global __APP_VERSION__ */
export const VERSION = __APP_VERSION__;

// If the character walks sideways or backwards, change this angle (radians): Math.PI, Math.PI / 2 ...
const MODEL_YAW_OFFSET = 0;

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
    this.controls.enabled = false;
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

    this.input = new Input();
    this.player = null; // PlayerController (Unity coordinates)
    this.holder = null; // Three.js group with the character model
    this.freeCamera = false;
    this.colliderDebug = null;

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
      if (start) this._createPlayer(start, character, level);
    } catch (err) {
      console.error(err);
      this.loadError = String(err.message || err);
    }
  }

  /** Builds the collision world and the player from the Unity "Player" object. */
  _createPlayer(start, character, level) {
    // Collision boxes: the world matrix of each object already is in Three.js space
    const world = new CollisionWorld();
    const debug = new THREE.Group();
    debug.visible = false;
    const wire = new THREE.MeshBasicMaterial({ color: 0x00ff66, wireframe: true });
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (const { obj, center, size } of level.colliders) {
      m.compose(new THREE.Vector3().fromArray(center), new THREE.Quaternion(), new THREE.Vector3().fromArray(size));
      m.premultiply(obj.matrixWorld);
      m.decompose(pos, quat, scale);
      const sx = Math.abs(scale.x), sy = Math.abs(scale.y), sz = Math.abs(scale.z);
      world.addBox({ center: pos.toArray(), half: [sx / 2, sy / 2, sz / 2], quat: [quat.x, quat.y, quat.z, quat.w] });
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wire);
      box.matrixAutoUpdate = false;
      box.matrix.compose(pos, quat, new THREE.Vector3(sx, sy, sz));
      debug.add(box);
    }
    this.scene.add(debug);
    this.colliderDebug = debug;

    const comps = start.userData.components;
    const cc = comps.find((c) => c.type === 'CharacterController');
    const script = (name) => (comps.find((c) => c.type === 'Script' && c.script === name) || {}).props || {};
    const shape = {
      radius: cc ? cc.radius : 0.5,
      height: cc ? cc.height : 2.3,
      center: cc ? cc.center : [0, 1.27, 0],
    };
    const wp = start.getWorldPosition(new THREE.Vector3());
    const wq = start.getWorldQuaternion(new THREE.Quaternion());
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(wq);
    const yaw = Math.atan2(fwd.x, fwd.z);
    this.player = new PlayerController({
      position: { x: wp.x, y: wp.y, z: wp.z }, yaw, controller: shape,
      props: script('ThirdPersonController.js'), world,
    });
    this.followCam = new FollowCamera(script('ThirdPersonCamera.js'));
    this.followCam.cut(this.player);

    // Character model inside a holder, so we can move and turn it as a whole
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    fitToHeight(character, shape.height);
    this.holder.add(character);
    this._setupAnimations(character);
    this._describeCharacter(character);
    this._syncPlayer();
  }

  /** Info for debugging (shown on screen): meshes, material groups and bones. */
  _describeCharacter(character) {
    const parts = [];
    character.traverse((n) => {
      if (!n.isMesh) return;
      const g = n.geometry.groups.map((x) => `${x.materialIndex}:${x.start}+${x.count}`).join(' ');
      const mats = (Array.isArray(n.material) ? n.material : [n.material]).map((m) => m.name).join('/');
      const w = n.geometry.attributes.skinWeight;
      parts.push(`${n.name}${n.isSkinnedMesh ? ` [skinned, ${n.skeleton.bones.length} bones]` : ''} mats ${mats} groups ${g} verts ${n.geometry.attributes.position.count}${w ? '' : ' NO WEIGHTS'}`);
    });
    this.charInfo = `Character meshes: ${parts.join(' | ')}\nKeys: P bind pose, M debug colors / wireframe`;
    console.info('[character]', parts);
  }

  /** Copies the player state to the Three.js objects and the camera. */
  _syncPlayer() {
    const p = this.player;
    this.holder.position.set(p.pos.x, p.pos.y + p.capsule.bottom, p.pos.z); // feet on the capsule bottom
    this.holder.rotation.y = p.yaw + MODEL_YAW_OFFSET;
    if (!this.freeCamera) {
      const c = this.followCam;
      this.camera.position.set(c.position.x, c.position.y, c.position.z);
      this.camera.lookAt(c.lookAt.x, c.lookAt.y, c.lookAt.z);
    }
    if (!this.charPaused) this._play(p.anim);
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

  /** Debug keys for the character: P = bind pose (no animation), M = flat shading / wireframe. */
  _debugCharacter(kind) {
    const root = this.holder && this.holder.children[0];
    if (!root) return;
    if (kind === 'pose') {
      this.charPaused = !this.charPaused;
      if (this.charPaused) {
        if (this.mixer) this.mixer.stopAllAction();
        this.currentAction = null;
        root.traverse((n) => { if (n.isSkinnedMesh) n.skeleton.pose(); });
      }
      return;
    }
    this.charDebugMode = ((this.charDebugMode || 0) + 1) % 3; // 0 normal, 1 flat colors, 2 wireframe
    root.traverse((n) => {
      if (!n.isMesh) return;
      if (!n.userData.origMaterial) n.userData.origMaterial = n.material;
      if (this.charDebugMode === 0) n.material = n.userData.origMaterial;
      else {
        n.material = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide, wireframe: this.charDebugMode === 2 });
      }
    });
  }

  _onKey(e) {
    if (e.code === 'KeyP') this._debugCharacter('pose');
    if (e.code === 'KeyM') this._debugCharacter('material');
    if (e.code === 'KeyO') { // free camera (mouse) for debugging
      this.freeCamera = !this.freeCamera;
      this.controls.enabled = this.freeCamera;
      if (this.player) this.controls.target.set(this.player.pos.x, this.player.pos.y + 1, this.player.pos.z);
    }
    if (e.code === 'KeyK' && this.colliderDebug) this.colliderDebug.visible = !this.colliderDebug.visible;
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
    if (this.player) {
      const step = Math.min(dt, 0.05);
      const input = this.input.read();
      this.player.update(step, input, this.followCam.angle);
      this.followCam.update(step, this.player, input.recenter);
      this._syncPlayer();
    }
    if (this.mixer) this.mixer.update(dt);
    for (const fn of this.updatables) fn(dt);
    if (this.freeCamera) this.controls.update();
    this.renderer.render(this.scene, this.camera);

    this._frames++;
    this._fpsTime += dt;
    if (this._fpsTime >= 0.5) {
      this._fps = Math.round(this._frames / this._fpsTime);
      this._frames = 0;
      this._fpsTime = 0;
      let text = `SpaceLab v${VERSION}\n${this._fps} fps\nWASD / arrows: move, Shift: run, Space: jump\nRight click / Alt: recenter camera\nO: free camera, K: show colliders`;
      if (this.clipsInfo) text += `\nClips: ${this.clipsInfo}`;
      if (this.currentName) text += `\nAnimation: ${this.currentName}${this.charPaused ? ' (P: paused, bind pose)' : ''}`;
      if (this.charInfo) text += `\n${this.charInfo}`;
      if (this.levelStats) text += `\nLevel ${this.levelNumber}: ${this.levelStats.meshes} meshes`;
      if (this.levelStats && this.levelStats.missingMeshes.length) text += `\nMissing meshes: ${this.levelStats.missingMeshes.length}`;
      if (this.loadError) text += `\nLOAD ERROR: ${this.loadError}`;
      this.infoEl.textContent = text;
    }
  }
}
