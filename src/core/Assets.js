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
    this.textureLoader = new THREE.TextureLoader();
    // Material name in the FBX -> texture file
    this.materialTextures = {
      skin: 'skin_diffuse.png',
      clothes: 'clothes_diffuse.png',
    };
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
    let meshes = 0;
    const extra = [];
    model.traverse((node) => {
      // Remove helper objects (points, sprites, lights, lines) that come inside the FBX
      if (node.isPoints || node.isSprite || node.isLight || node.isLine) extra.push(node);
      if (!node.isMesh) return;
      meshes++;
      node.frustumCulled = false; // skinned meshes can have a wrong bounding sphere
      // The bone weights of this FBX do not sum to 1 (head, hands and feet shrink to the
      // origin). Unity normalizes them when it imports the model, so we do the same.
      if (node.isSkinnedMesh) node.normalizeSkinWeights();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of materials) {
        m.normalMap = null; // missing in our assets
        m.side = THREE.DoubleSide; // some faces are flipped in the FBX
        const texFile = this.materialTextures[m.name];
        if (texFile) {
          // We set the texture by hand. It is more reliable than the FBX paths.
          m.map = this.textureLoader.load(`${BASE}textures/character/${texFile}`);
          m.color.set(0xffffff);
        }
        m.emissive?.set(0x000000); // the FBX exports white emissive, that makes it glow
        m.emissiveMap = null;
        m.specular?.set(0x222222);
        m.opacity = 1; // some FBX files export opacity 0 by mistake
        m.transparent = false;
        if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
        m.needsUpdate = true;
        console.info(`[${file}] material "${m.name}" map:`, m.map ? 'yes' : 'no');
      }
    });
    for (const node of extra) node.removeFromParent();
    if (extra.length) console.info(`[${file}] removed helper objects:`, extra.map((n) => n.type));
    console.info(`[${file}] meshes: ${meshes}, animations: ${model.animations.length}`);
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
  let box = getBox(object);
  const size = box.getSize(new THREE.Vector3());
  console.info('[fitToHeight] original size', size.toArray().map((v) => +v.toFixed(3)));
  if (size.y > 0 && Number.isFinite(size.y)) {
    object.scale.multiplyScalar(height / size.y);
    object.updateMatrixWorld(true);
    box = getBox(object);
    object.position.y -= box.min.y;
    object.updateMatrixWorld(true);
  } else {
    console.warn('[fitToHeight] invalid size, model not scaled');
  }
  return getBox(object);
}

/** Bounding box that also works for skinned meshes (uses the skinned vertices). */
function getBox(object) {
  const box = new THREE.Box3();
  object.traverse((node) => {
    if (!node.isMesh) return;
    if (node.isSkinnedMesh) {
      node.skeleton.update();
      node.computeBoundingBox();
    } else {
      node.geometry.computeBoundingBox();
    }
    const b = (node.boundingBox || node.geometry.boundingBox).clone();
    box.union(b.applyMatrix4(node.matrixWorld));
  });
  return box;
}
