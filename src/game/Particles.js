import * as THREE from 'three';

/**
 * Simple particle effects (teleport sparks, smoke, gas).
 * The Unity particle settings were not exported, so these are look-alike effects
 * that are chosen by the name of the level object.
 */

const KINDS = {
  teleport: { // sparks that go up from the teleport
    count: 45, color: [0.45, 0.9, 1.0], life: 1.6, speed: 0.9, spread: 0.45, size: 0.22, grow: 0, alpha: 0.9, additive: true, light: true,
  },
  smoke: { // slow grey puffs
    count: 22, color: [0.72, 0.72, 0.75], life: 3.5, speed: 0.55, spread: 0.3, size: 0.9, grow: 1.6, alpha: 0.28, additive: false,
  },
  gas: { // reddish lava gas from the small holes: spread over the hole, new random places all the time
    count: 40, color: [1.0, 0.42, 0.2], life: 2.6, speed: 0.7, spread: 0.9, size: 0.8, grow: 1.4, alpha: 0.22, additive: true,
  },
  gasBig: { // the same for the big pit with the turning platform: many more points over a wide area
    count: 170, color: [1.0, 0.42, 0.2], life: 3.4, speed: 1.0, spread: 7, size: 1.6, grow: 1.4, alpha: 0.2, additive: true,
  },
};

function kindOf(name) {
  if (name === 'Particulas') return 'teleport';
  if (name === 'Smoke') return 'smoke';
  if (name === 'Gases_granFoso') return 'gasBig';
  if (name.startsWith('Gases')) return 'gas';
  return null;
}

/** A soft round sprite drawn with canvas (no image file needed). */
function softCircle() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const VERTEX = `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  uniform float uPixelScale;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const FRAGMENT = `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(uColor, t.a * vAlpha);
  }`;

class Emitter {
  constructor(cfg, texture) {
    this.cfg = cfg;
    const n = cfg.count;
    this.age = new Float32Array(n);
    this.offset = new Float32Array(n * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uMap: { value: texture }, uColor: { value: new THREE.Color().fromArray(cfg.color) }, uPixelScale: { value: 500 } },
      transparent: true,
      depthWrite: false,
      blending: cfg.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      this._respawn(i);
      this.age[i] = Math.random() * cfg.life; // start spread in time
    }
  }

  _respawn(i) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * this.cfg.spread;
    this.offset[i * 3] = Math.cos(a) * r;
    this.offset[i * 3 + 1] = 0;
    this.offset[i * 3 + 2] = Math.sin(a) * r;
    this.age[i] = 0;
  }

  update(dt, pixelScale) {
    const { life, speed, size, grow, alpha } = this.cfg;
    const pos = this.geometry.attributes.position.array;
    const sizes = this.geometry.attributes.aSize.array;
    const alphas = this.geometry.attributes.aAlpha.array;
    for (let i = 0; i < this.age.length; i++) {
      this.age[i] += dt;
      if (this.age[i] >= life) this._respawn(i);
      const t = this.age[i] / life; // 0 .. 1
      pos[i * 3] = this.offset[i * 3];
      pos[i * 3 + 1] = this.age[i] * speed;
      pos[i * 3 + 2] = this.offset[i * 3 + 2];
      sizes[i] = size * (1 + grow * t);
      alphas[i] = alpha * Math.sin(Math.PI * t); // fade in and out
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
    this.material.uniforms.uPixelScale.value = pixelScale;
  }
}

export class Particles {
  constructor(level) {
    this.emitters = [];
    const texture = softCircle();
    level.group.traverse((obj) => {
      const kind = kindOf(obj.name);
      const hasParticles = (obj.userData.components || []).some((c) => c.type === 'ParticleSystem');
      if (!kind || !hasParticles) return;
      const emitter = new Emitter(KINDS[kind], texture);
      obj.add(emitter.points);
      if (KINDS[kind].light) {
        const glow = new THREE.PointLight(0x66ddff, 6, 8, 2);
        glow.position.set(0, 1, 0);
        obj.add(glow);
      }
      this.emitters.push(emitter);
    });
  }

  update(dt, camera, viewportHeight) {
    const pixelScale = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (const e of this.emitters) e.update(dt, pixelScale);
  }
}
