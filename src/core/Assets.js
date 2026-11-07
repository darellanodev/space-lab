import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// 1x1 transparent PNG. Used for textures that we do not have (normal maps).
const EMPTY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const BASE = import.meta.env.BASE_URL; // "./" in our config

/**
 * Loads models and textures.
 * The FBX files keep the old Windows paths of the author (D:\...\skin_diffuse.png).
 * The URL modifier below changes them to our own "textures/character/" folder.
 */
export class Assets {
  constructor() {
    this.manager = new THREE.LoadingManager();
    this.manager.setURLModifier((url) => this._fixUrl(url));
    this.fbxLoader = new FBXLoader(this.manager);
  }

  _fixUrl(url) {
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    const name = decodeURIComponent(url).split(/[\\/]/).pop();
    if (!/\.(png|jpg|jpeg|tga)$/i.test(name)) return url;
    if (name.includes('_normal')) return EMPTY_PNG; // we do not have these files
    return `${BASE}textures/character/${name}`;
  }

  /** Loads an FBX model. Returns the Object3D (with `.animations`). */
  async loadFBX(file) {
    const model = await this.fbxLoader.loadAsync(`${BASE}models/${file}`);
    model.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of materials) {
        m.normalMap = null; // missing in our assets
        if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
        m.needsUpdate = true;
      }
    });
    return model;
  }

  /** Loads the 6 sky images. Order: right, left, top, bottom, front, back. */
  async loadSkybox() {
    const names = ['right1', 'left2', 'top3', 'bottom4', 'front5', 'back6'];
    const files = names.map((n) => `${BASE}textures/skybox/spacestars_${n}.png`);
    const texture = await new THREE.CubeTextureLoader().loadAsync(files);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}

/**
 * Scales a model so its height is `height` units and puts its feet on y = 0.
 * Only for the 0.2.0 demo. Real levels will use the original Unity scale.
 */
export function fitToHeight(object, height) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  console.info('[fitToHeight] original size', size.toArray().map((v) => +v.toFixed(3)));
  if (size.y > 0) object.scale.multiplyScalar(height / size.y);
  object.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(object);
  object.position.y -= fitted.min.y;
}
