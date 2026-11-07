import * as THREE from 'three';

/* global __APP_VERSION__ */
export const VERSION = __APP_VERSION__;

export class Game {
  constructor(canvas, infoEl) {
    this.canvas = canvas;
    this.infoEl = infoEl;
    this.updatables = [];

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02030a);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    this.camera.position.set(6, 6, 8);
    this.camera.lookAt(0, 0, 0);

    this.clock = new THREE.Clock();
    this._frames = 0;
    this._fpsTime = 0;
    this._fps = 0;

    this._buildPlaceholderScene();
    window.addEventListener('resize', () => this._resize());
    this._resize();
  }

  // Temporary scene to check that the loop and the camera work.
  _buildPlaceholderScene() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(5, 10, 7);
    this.scene.add(sun);

    this.scene.add(new THREE.GridHelper(20, 20, 0x3388aa, 0x113344));

    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x44aaff })
    );
    cube.position.y = 0.5;
    this.scene.add(cube);
    this.updatables.push((dt) => { cube.rotation.y += dt; });
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
    for (const fn of this.updatables) fn(dt);
    this.renderer.render(this.scene, this.camera);

    this._frames++;
    this._fpsTime += dt;
    if (this._fpsTime >= 0.5) {
      this._fps = Math.round(this._frames / this._fpsTime);
      this._frames = 0;
      this._fpsTime = 0;
      this.infoEl.textContent = `SpaceLab v${VERSION}\n${this._fps} fps`;
    }
  }
}
