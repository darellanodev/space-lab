import * as THREE from 'three';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';

const BASE = import.meta.env.BASE_URL;

// Unity light intensities look different in Three.js. Change these numbers to tune the look.
const LIGHT_SCALE = { directional: 1.5, point: 40, spot: 40, ambient: 1.6 };

const sanitize = (name) => name.replace(/\s/g, '_').replace(/[[\].:/]/g, ''); // same as Three.js FBXLoader

/**
 * Builds a Three.js scene from a level JSON made by tools/unity2json.py.
 * The JSON already has the coordinates converted from Unity to Three.js.
 */
export class LevelLoader {
  constructor(assets) {
    this.assets = assets;
    this.modelCache = new Map(); // fbx file -> { meshName: geometry }
    this.materialCache = new Map();
    this.textureLoader = new THREE.TextureLoader();
    this.tgaLoader = new TGALoader();
    this.materialDefs = {};
    this.stats = { nodes: 0, meshes: 0, missingMeshes: [] };
  }

  async load(levelNumber) {
    const [level, materials] = await Promise.all([
      fetch(`${BASE}levels/level${levelNumber}.json`).then((r) => r.json()),
      fetch(`${BASE}levels/materials.json`).then((r) => r.json()),
    ]);
    this.materialDefs = materials;

    // Load every FBX that the level uses, only once
    const files = new Set();
    const collect = (n) => {
      for (const c of n.components) {
        if (c.type === 'MeshFilter' && c.mesh && c.mesh.file) files.add(c.mesh.file);
      }
      n.children.forEach(collect);
    };
    level.roots.forEach(collect);
    await Promise.all([...files].map((f) => this._loadGeometries(f)));

    const group = new THREE.Group();
    group.name = `level${levelNumber}`;
    for (const root of level.roots) group.add(this._buildNode(root));
    return { group, settings: level.settings, stats: this.stats, data: level };
  }

  async _loadGeometries(file) {
    const model = await this.assets.loadFBX(file);
    const map = {};
    model.traverse((n) => {
      if (n.isMesh && !map[n.name]) map[n.name] = n.geometry;
    });
    this.modelCache.set(file, map);
  }

  _geometry(ref) {
    const map = this.modelCache.get(ref.file);
    if (!map) return null;
    const geo = map[sanitize(ref.sub || '')] || map[ref.sub];
    if (geo) return geo;
    this.stats.missingMeshes.push(`${ref.file}:${ref.sub}`);
    return Object.values(map)[0] || null; // fallback: first mesh in the file
  }

  _material(ref) {
    const key = ref && ref.file ? ref.file : 'default';
    if (this.materialCache.has(key)) return this.materialCache.get(key);
    const def = this.materialDefs[key];
    const mat = new THREE.MeshLambertMaterial({ color: 0xc8c8c8 });
    if (def) {
      const c = def.colors._Color;
      if (c) {
        mat.color.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
        if (c[3] < 1) {
          mat.transparent = true;
          mat.opacity = c[3];
        }
      }
      const main = def.textures._MainTex;
      if (main && main.file) mat.map = this._texture(main);
    }
    mat.name = key;
    this.materialCache.set(key, mat);
    return mat;
  }

  _texture(ref) {
    const url = `${BASE}textures/${ref.file}`;
    const loader = /\.tga$/i.test(ref.file) ? this.tgaLoader : this.textureLoader;
    const tex = loader.load(url, (t) => { t.needsUpdate = true; }, undefined, () => {
      console.warn('[texture] not found:', ref.file);
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (ref.scale) tex.repeat.set(ref.scale[0], ref.scale[1]);
    if (ref.offset) tex.offset.set(ref.offset[0], ref.offset[1]);
    return tex;
  }

  _buildNode(n) {
    this.stats.nodes++;
    const obj = new THREE.Object3D();
    obj.name = n.name;
    obj.position.fromArray(n.pos);
    obj.quaternion.set(n.rot[0], n.rot[1], n.rot[2], n.rot[3]);
    obj.scale.fromArray(n.scale);
    obj.visible = n.active;
    obj.userData = { unityId: n.id, tag: n.tag, layer: n.layer, components: n.components };

    let geometry = null;
    let mats = [];
    for (const c of n.components) {
      if (c.type === 'MeshFilter' && c.mesh && c.mesh.file) geometry = this._geometry(c.mesh);
      else if (c.type === 'MeshRenderer') mats = c.materials;
      else if (c.type === 'Light') this._addLight(obj, c);
    }
    if (geometry) {
      const material = mats.length > 1 ? mats.map((m) => this._material(m)) : this._material(mats[0]);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `${n.name}_mesh`;
      obj.add(mesh);
      this.stats.meshes++;
    }
    for (const k of n.children) obj.add(this._buildNode(k));
    return obj;
  }

  // Unity light types: 0 = spot, 1 = directional, 2 = point
  _addLight(obj, c) {
    const color = new THREE.Color().setRGB(c.color[0], c.color[1], c.color[2], THREE.SRGBColorSpace);
    const intensity = c.intensity ?? 1;
    let light;
    if (c.lightType === 1) {
      light = new THREE.DirectionalLight(color, intensity * LIGHT_SCALE.directional);
      light.target.position.set(0, 0, 1); // Unity lights point along local +Z
      obj.add(light.target);
    } else if (c.lightType === 0) {
      light = new THREE.SpotLight(color, intensity * LIGHT_SCALE.spot, c.range, THREE.MathUtils.degToRad((c.spotAngle || 60) / 2), 0.3, 1);
      light.target.position.set(0, 0, 1);
      obj.add(light.target);
    } else {
      light = new THREE.PointLight(color, intensity * LIGHT_SCALE.point, c.range, 2);
    }
    light.visible = !!c.enabled;
    obj.add(light);
  }
}

export { LIGHT_SCALE };
