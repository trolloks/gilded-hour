// The 3D painting of Meridian House. three.js renders the room, its furniture,
// guards, cameras and light; a transparent 2D canvas draws the HUD and cards.
// Free CC0 textures and the OFL Cinzel face live under game/assets.

import * as THREE from '../vendor/three.module.min.js';
import { COLORS, WORLD } from './config.js';
import { conePolygon } from './geometry.js';
import { sightBlockers } from './collision.js';
import { drawBlueprint, drawBriefing, drawCaught, drawHud, drawPause, drawTitle, drawVictory } from './hud.js';
import { guardMood } from './guards.js';

const VIEW_HEIGHT = 1000;
const VIEW_ASPECT = 16 / 9;
const SX = (x) => x - WORLD.width / 2;
const SZ = (y) => y - WORLD.height / 2;

export function createRenderer(canvas) {
  let dpr = 1;
  let cssWidth = 0;
  let cssHeight = 0;
  let stage = { scale: 1, ox: 0, oy: 0, w: 0, h: 0 };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // A tiny studio gradient gives the brass and gold something to reflect.
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 64;
  envCanvas.height = 32;
  const envCtx = envCanvas.getContext('2d');
  const envGrad = envCtx.createLinearGradient(0, 0, 0, 32);
  envGrad.addColorStop(0, '#7f98a8');
  envGrad.addColorStop(0.45, '#3a464e');
  envGrad.addColorStop(0.55, '#b0803c');
  envGrad.addColorStop(1, '#241c12');
  envCtx.fillStyle = envGrad;
  envCtx.fillRect(0, 0, 64, 32);
  const envTexture = new THREE.CanvasTexture(envCanvas);
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  envTexture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(envTexture).texture;
  envTexture.dispose();
  pmrem.dispose();

  const overlay = document.createElement('canvas');
  overlay.id = 'hud';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '2';
  document.body.appendChild(overlay);
  const octx = overlay.getContext('2d');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);
  scene.fog = new THREE.FogExp2(0x05070c, 0.00062);
  scene.environment = envMap;

  const camera = new THREE.OrthographicCamera(
    (-VIEW_HEIGHT * VIEW_ASPECT) / 2,
    (VIEW_HEIGHT * VIEW_ASPECT) / 2,
    VIEW_HEIGHT / 2,
    -VIEW_HEIGHT / 2,
    1,
    5000,
  );
  camera.position.set(-215, 950, 760);
  camera.lookAt(0, 0, -30);

  const staticGroup = new THREE.Group();
  const dynamicGroup = new THREE.Group();
  scene.add(staticGroup, dynamicGroup);

  const ambient = new THREE.AmbientLight(0x1c2d38, 0.85);
  const hemi = new THREE.HemisphereLight(0x557486, 0x040608, 0.62);
  const key = new THREE.DirectionalLight(0xffdfb0, 1.25);
  key.position.set(-620, 1250, 520);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -1100;
  key.shadow.camera.right = 1100;
  key.shadow.camera.top = 900;
  key.shadow.camera.bottom = -900;
  key.shadow.camera.near = 10;
  key.shadow.camera.far = 3200;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.6;
  const fill = new THREE.DirectionalLight(0x4a7a95, 1.3);
  fill.position.set(700, 600, -800);
  const alarmLight = new THREE.PointLight(0xe8484f, 0, 1200, 2);
  alarmLight.position.set(0, 260, 0);
  scene.add(ambient, hemi, key, fill, alarmLight);

  const loader = new THREE.TextureLoader();
  const assets = {};
  const ready = loadAssets();

  let builtLevel = null;
  let refs = null;
  let grain = null;

  async function loadAssets() {
    const load = (url, srgb, repeatX, repeatY) => loader.loadAsync(url).then((texture) => {
      texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeatX, repeatY);
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return texture;
    });
    const [marble, marbleNormal, wood, woodNormal, metal, metalNormal] = await Promise.all([
      load('./assets/textures/marble-color.jpg', true, 3, 2),
      load('./assets/textures/marble-normal.jpg', false, 3, 2),
      load('./assets/textures/wood-color.jpg', true, 4, 3),
      load('./assets/textures/wood-normal.jpg', false, 4, 3),
      load('./assets/textures/metal-color.jpg', true, 4, 3),
      load('./assets/textures/metal-normal.jpg', false, 4, 3),
    ]);
    assets.floors = {
      atrium: new THREE.MeshStandardMaterial({ map: marble, normalMap: marbleNormal, roughness: 0.72, metalness: 0.06, color: 0x2c3f49 }),
      archive: new THREE.MeshStandardMaterial({ map: wood, normalMap: woodNormal, roughness: 0.82, metalness: 0.02, color: 0x7a6652 }),
      vault: new THREE.MeshStandardMaterial({ map: metal, normalMap: metalNormal, roughness: 0.58, metalness: 0.35, color: 0x5b6a6e }),
    };
    assets.trim = new THREE.MeshStandardMaterial({ color: 0xc8963a, metalness: 0.45, roughness: 0.32, emissive: 0x1e1202, emissiveIntensity: 0.5 });
    assets.brass = new THREE.MeshStandardMaterial({ color: 0x9c7330, metalness: 0.4, roughness: 0.36 });
    assets.brassBright = new THREE.MeshStandardMaterial({ color: 0xe8bd60, metalness: 0.35, roughness: 0.24, emissive: 0x3a2404, emissiveIntensity: 0.5 });
    assets.carpet = makeCarpetTexture();
    assets.velvet = new THREE.MeshStandardMaterial({ color: 0x4a161e, roughness: 0.9 });
    assets.wood = new THREE.MeshStandardMaterial({ color: 0x211a14, roughness: 0.85 });
    assets.woodLight = new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 0.8 });
    assets.glass = new THREE.MeshPhysicalMaterial({ color: 0x9fd6df, transparent: true, opacity: 0.18, roughness: 0.08, metalness: 0, depthWrite: false });
    assets.stone = new THREE.MeshStandardMaterial({ color: 0x263a46, roughness: 0.78 });
    assets.steel = new THREE.MeshStandardMaterial({ color: 0x2c3a40, metalness: 0.55, roughness: 0.45 });
    assets.cyan = new THREE.MeshStandardMaterial({ color: 0x79d5e8, emissive: 0x2c8a9c, emissiveIntensity: 1.6, roughness: 0.3 });
    assets.red = new THREE.MeshStandardMaterial({ color: 0xe8484f, emissive: 0x8a1119, emissiveIntensity: 1.4, roughness: 0.35 });
    assets.gold = new THREE.MeshStandardMaterial({ color: 0xf2c96b, metalness: 0.4, roughness: 0.16, emissive: 0x8a5a08, emissiveIntensity: 1.2 });
    assets.jewel = new THREE.MeshStandardMaterial({ color: 0xb52a3a, metalness: 0.3, roughness: 0.18, emissive: 0x3a0508, emissiveIntensity: 0.5 });
    assets.leaf = new THREE.MeshStandardMaterial({ color: 0x2f6b4f, roughness: 0.82 });
    assets.dark = new THREE.MeshStandardMaterial({ color: 0x0a0f14, roughness: 0.9 });
    assets.coat = new THREE.MeshStandardMaterial({ color: 0x2a6470, roughness: 0.62 });
    assets.coatShadow = new THREE.MeshStandardMaterial({ color: 0x1f4b55, roughness: 0.68 });
    assets.guardCoat = new THREE.MeshStandardMaterial({ color: 0x5a2329, roughness: 0.72 });
    assets.guardChase = new THREE.MeshStandardMaterial({ color: 0x7d2930, roughness: 0.65 });
    assets.guardCap = new THREE.MeshStandardMaterial({ color: 0x191416, roughness: 0.75 });
    assets.skin = new THREE.MeshStandardMaterial({ color: 0xd9b38c, roughness: 0.8 });
    assets.bookColors = [0x6b3a2e, 0x3c4f43, 0x4e3b5c, 0x6a5428, 0x34515a, 0x7a5a3a].map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
    );
  }

  function makeCarpetTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = '#4a121d';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(217, 164, 65, 0.75)';
    g.lineWidth = 8;
    g.strokeRect(12, 12, c.width - 24, c.height - 24);
    g.strokeStyle = 'rgba(217, 164, 65, 0.28)';
    g.lineWidth = 2;
    g.strokeRect(26, 26, c.width - 52, c.height - 52);
    for (let y = 70; y < c.height - 40; y += 96) {
      g.save();
      g.translate(c.width / 2, y);
      g.rotate(Math.PI / 4);
      g.strokeStyle = 'rgba(217, 164, 65, 0.3)';
      g.lineWidth = 2;
      g.strokeRect(-26, -26, 52, 52);
      g.restore();
    }
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cssWidth = window.innerWidth;
    cssHeight = window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(cssWidth, cssHeight, false);
    overlay.width = Math.floor(cssWidth * dpr);
    overlay.height = Math.floor(cssHeight * dpr);
    overlay.style.width = `${cssWidth}px`;
    overlay.style.height = `${cssHeight}px`;
    const scale = Math.min(cssWidth / WORLD.width, cssHeight / WORLD.height);
    stage = {
      scale,
      ox: (cssWidth - WORLD.width * scale) / 2,
      oy: (cssHeight - WORLD.height * scale) / 2,
      w: WORLD.width * scale,
      h: WORLD.height * scale,
    };
    if (!grain) grain = makeGrain();
  }

  function makeTextSprite(text, color = '#f2c96b', width = 512, height = 64, scaleX = 180) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const g = c.getContext('2d');
    g.clearRect(0, 0, width, height);
    g.fillStyle = color;
    g.font = '600 30px Cinzel, Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0, 0, 0, 0.9)';
    g.shadowBlur = 8;
    g.fillText(text, width / 2, height / 2 + 2);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false }));
    sprite.scale.set(scaleX, (scaleX * height) / width, 1);
    return sprite;
  }

  function makeGrain() {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 160;
    const g = c.getContext('2d');
    const image = g.createImageData(160, 160);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = Math.floor((Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * 255);
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = 16;
    }
    g.putImageData(image, 0, 0);
    return octx.createPattern(c, 'repeat');
  }

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const point = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -1), point);
    if (!hit) return { x: WORLD.width / 2, y: WORLD.height / 2 };
    return { x: point.x + WORLD.width / 2, y: point.z + WORLD.height / 2 };
  }

  function clearGroup(group) {
    while (group.children.length) {
      const child = group.children.pop();
      child.traverse?.((node) => {
        if (node.geometry) node.geometry.dispose();
      });
      group.remove(child);
    }
  }

  function box(w, h, d, material, x, y, z, options = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = options.castShadow ?? true;
    mesh.receiveShadow = options.receiveShadow ?? true;
    return mesh;
  }

  function addRim(group, x, y, z, w, d, material, thickness = 2.6) {
    group.add(box(w, 2, thickness, material, x, y, z - d / 2 + thickness / 2));
    group.add(box(w, 2, thickness, material, x, y, z + d / 2 - thickness / 2));
    group.add(box(thickness, 2, d, material, x - w / 2 + thickness / 2, y, z));
    group.add(box(thickness, 2, d, material, x + w / 2 - thickness / 2, y, z));
  }

  function buildLevel(level) {
    builtLevel = level.id;
    clearGroup(staticGroup);
    clearGroup(dynamicGroup);
    refs = {
      doors: [],
      terminals: [],
      lasers: [],
      guards: [],
      cameras: [],
      smoke: new Map(),
      rings: [],
      exit: null,
      loot: null,
      player: null,
      dust: null,
    };

    const floorMaterial = assets.floors[level.decor] ?? assets.floors.atrium;

    const base = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1800), new THREE.MeshStandardMaterial({ color: 0x05070b, roughness: 1 }));
    base.rotation.x = -Math.PI / 2;
    base.position.y = -6;
    base.receiveShadow = true;
    staticGroup.add(base);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.width, WORLD.height), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    floor.receiveShadow = true;
    staticGroup.add(floor);

    // Brass inlay around the room.
    const border = 4;
    for (const [x, z, w, d] of [
      [0, -WORLD.height / 2 + border, WORLD.width, 6],
      [0, WORLD.height / 2 - border, WORLD.width, 6],
      [-WORLD.width / 2 + border, 0, 6, WORLD.height],
      [WORLD.width / 2 - border, 0, 6, WORLD.height],
    ]) {
      const mesh = box(w, 1.5, d, assets.brass, x, 0.8, z, { castShadow: false });
      staticGroup.add(mesh);
    }

    buildCarpet(level);
    buildShadows(level);
    buildWalls(level);
    buildCover(level);
    buildVents(level);
    buildDecor(level);
    buildDoors(level);
    buildTerminals(level);
    buildLasers(level);
    buildExit(level);
    buildLoot(level);
    buildGuards(level);
    buildCameras(level);
    buildPlayer(level);
    buildDust(level);
  }

  function buildCarpet(level) {
    const spec = level.decor === 'atrium'
      ? { x: 0, z: 30, w: 152, d: 640 }
      : level.decor === 'archive'
        ? { x: 320, z: -280, w: 390, d: 170 }
        : { x: 0, z: 20, w: 304, d: 236 };
    const mat = new THREE.MeshStandardMaterial({ map: assets.carpet, roughness: 0.92, color: 0xffffff });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.d), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(spec.x, 0.6, spec.z);
    mesh.receiveShadow = true;
    staticGroup.add(mesh);
  }

  function buildShadows(level) {
    for (const zone of level.shadows) {
      if (zone.vent) continue;
      const mat = new THREE.MeshBasicMaterial({ color: 0x02070a, transparent: true, opacity: 0.38, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(zone.w, zone.h), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(SX(zone.x + zone.w / 2), 0.9, SZ(zone.y + zone.h / 2));
      staticGroup.add(mesh);
    }
  }

  function buildWalls(level) {
    for (const wall of level.walls) {
      const isBottom = wall.y > 820 && wall.w > 100;
      const height = isBottom ? 22 : wall.y < 40 ? 84 : 72;
      const w = wall.w;
      const d = wall.h;
      const x = SX(wall.x + w / 2);
      const z = SZ(wall.y + d / 2);
      const material = wall.y < 40 && level.decor !== 'vault' ? assets.stone : level.decor === 'archive' ? assets.wood : assets.stone;
      const mesh = box(w, height, d, material, x, height / 2, z);
      staticGroup.add(mesh);

      if (height > 30) {
        const horizontal = w >= d;
        if (horizontal) {
          staticGroup.add(box(w, 1.6, 2.4, assets.trim, x, height + 0.8, z - d / 2 + 1.2));
          staticGroup.add(box(w, 1.6, 2.4, assets.trim, x, height + 0.8, z + d / 2 - 1.2));
          staticGroup.add(box(w, 1.4, 2, assets.brass, x, 1.2, z + d / 2 + 0.5, { castShadow: false }));
        } else {
          staticGroup.add(box(2.4, 1.6, d, assets.trim, x - w / 2 + 1.2, height + 0.8, z));
          staticGroup.add(box(2.4, 1.6, d, assets.trim, x + w / 2 - 1.2, height + 0.8, z));
          staticGroup.add(box(2, 1.4, d, assets.brass, x + w / 2 + 0.5, 1.2, z, { castShadow: false }));
        }

        if (Math.max(w, d) > 80) {
          const step = 72;
          if (w > d) {
            for (let px = -w / 2 + step; px < w / 2; px += step) {
              staticGroup.add(box(3, height - 12, 1.2, assets.brass, x + px, height / 2, z + d / 2 + 0.7));
            }
          } else {
            for (let pz = -d / 2 + step; pz < d / 2; pz += step) {
              staticGroup.add(box(1.2, height - 12, 3, assets.brass, x + w / 2 + 0.7, height / 2, z + pz));
            }
          }
        }
      }
    }
  }

  function buildCover(level) {
    for (const item of level.cover) {
      const x = SX(item.x + item.w / 2);
      const z = SZ(item.y + item.h / 2);
      if (item.kind === 'column') {
        const radius = item.w / 2;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius * 0.92, 100, 18), assets.stone);
        shaft.position.set(x, 50, z);
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        staticGroup.add(shaft);
        staticGroup.add(box(radius * 2.2, 6, radius * 2.2, assets.stone, x, 103, z));
        addRim(staticGroup, x, 106, z, radius * 2.2, radius * 2.2, assets.brass, 2.2);
        staticGroup.add(box(radius * 2.1, 6, radius * 2.1, assets.stone, x, 3, z));
        addRim(staticGroup, x, 6, z, radius * 2.1, radius * 2.1, assets.brass, 2.2);
      } else if (item.kind === 'plinth') {
        staticGroup.add(box(item.w, 54, item.h, assets.stone, x, 27, z));
        addRim(staticGroup, x, 55, z, item.w + 8, item.h + 8, assets.trim, 2.4);
        staticGroup.add(box(item.w + 4, 4, item.h + 4, assets.brass, x, 2, z));
      } else if (item.kind === 'case') {
        staticGroup.add(box(item.w, 18, item.h, assets.wood, x, 9, z));
        const glass = box(item.w - 6, 52, item.h - 6, assets.glass, x, 44, z, { castShadow: false });
        staticGroup.add(glass);
        staticGroup.add(box(item.w - 8, 1.2, item.h - 8, assets.glass, x, 73, z, { castShadow: false }));
        addRim(staticGroup, x, 72, z, item.w, item.h, assets.brassBright, 2.2);
        staticGroup.add(box(item.w + 2, 3, item.h + 2, assets.brass, x, 20, z));
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 8, 10), assets.gold);
        stand.position.set(x, 26, z);
        staticGroup.add(stand);
        const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(8, 0), assets.jewel);
        jewel.position.set(x, 36, z);
        jewel.castShadow = true;
        staticGroup.add(jewel);
      } else if (item.kind === 'bench') {
        staticGroup.add(box(item.w, 26, item.h, assets.velvet, x, 16, z));
        addRim(staticGroup, x, 30, z, item.w, item.h, assets.brass, 2);
        for (const side of [-1, 1]) staticGroup.add(box(6, 14, 6, assets.brass, x + side * (item.w / 2 - 8), 7, z));
      } else if (item.kind === 'desk') {
        staticGroup.add(box(item.w, 38, item.h, assets.woodLight, x, 19, z));
        addRim(staticGroup, x, 39, z, item.w + 4, item.h + 4, assets.brass, 2);
        staticGroup.add(box(item.w * 0.4, 1.2, item.h * 0.55, new THREE.MeshStandardMaterial({ color: 0xe9dfc8, roughness: 0.9 }), x - 14, 41, z));
      } else if (item.kind === 'cabinet') {
        staticGroup.add(box(item.w, 54, item.h, assets.wood, x, 27, z));
        for (let i = 1; i < 4; i += 1) {
          staticGroup.add(box(item.w + 1, 2, 3, assets.brass, x, 14 + i * 11, z + item.h / 2));
        }
      } else if (item.kind === 'crate') {
        staticGroup.add(box(item.w, 46, item.h, assets.woodLight, x, 23, z));
        addRim(staticGroup, x, 46, z, item.w + 2, item.h + 2, assets.brass, 2.2);
        staticGroup.add(box(item.w + 2, 3, 3, assets.brass, x, 24, z));
      } else if (item.kind === 'piano') {
        staticGroup.add(box(item.w - 24, 34, item.h, assets.dark, x + 8, 20, z));
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(item.h / 2, item.h / 2, 34, 20, 1, false, -Math.PI / 2, Math.PI), assets.dark);
        tail.position.set(x - item.w / 2 + 18, 20, z);
        tail.castShadow = true;
        staticGroup.add(tail);
        addRim(staticGroup, x + 8, 38, z, item.w - 24, item.h, assets.brass, 2.4);
        staticGroup.add(box(item.w - 30, 4, 12, new THREE.MeshStandardMaterial({ color: 0xe8dfc8, roughness: 0.7 }), x + 12, 39, z + item.h / 2 - 10));
        for (const side of [-1, 1]) {
          staticGroup.add(box(5, 18, 5, assets.brass, x + side * (item.w / 2 - 20), 9, z + side * 24));
        }
      }
    }
  }

  function drawPalm(group, x, z) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(13, 10, 22, 12), assets.brass);
    pot.position.set(x, 11, z);
    pot.castShadow = true;
    group.add(pot);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4, 54, 7), assets.woodLight);
    trunk.position.set(x + 2, 46, z);
    trunk.rotation.z = 0.08;
    trunk.castShadow = true;
    group.add(trunk);
    for (let i = 0; i < 7; i += 1) {
      const angle = (Math.PI * 2 * i) / 7 + 0.3;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(6, 30, 5), assets.leaf);
      leaf.position.set(x + 2 + Math.cos(angle) * 12, 68, z + Math.sin(angle) * 12);
      leaf.rotation.y = -angle;
      leaf.rotation.z = 0.95;
      leaf.castShadow = true;
      group.add(leaf);
    }
  }

  function buildVents(level) {
    for (const vent of level.vents) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x050b0d, roughness: 1 });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(vent.w, vent.h), mat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(SX(vent.x + vent.w / 2), 1.1, SZ(vent.y + vent.h / 2));
      staticGroup.add(floor);
      const horizontal = vent.w > vent.h;
      const count = Math.floor((horizontal ? vent.w : vent.h) / 18);
      for (let i = 1; i < count; i += 1) {
        const slat = horizontal
          ? box(3, 2, vent.h - 6, assets.steel, SX(vent.x + i * 18), 2, SZ(vent.y + vent.h / 2), { castShadow: false })
          : box(vent.w - 6, 2, 3, assets.steel, SX(vent.x + vent.w / 2), 2, SZ(vent.y + i * 18), { castShadow: false });
        staticGroup.add(slat);
      }
    }
  }

  function buildDecor(level) {
    if (level.decor === 'atrium') {
      const cyan = new THREE.PointLight(0x4d9fb8, 26, 760, 2);
      cyan.position.set(0, 140, -280);
      staticGroup.add(cyan);
      const warm = new THREE.PointLight(0xffb45e, 12, 600, 2);
      warm.position.set(0, 120, 240);
      staticGroup.add(warm);
      for (const [x, y] of [[300, 512], [1300, 512]]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(32, 3.4, 8, 40), assets.brass);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(SX(x), 210, SZ(y));
        staticGroup.add(ring);
        for (let i = 0; i < 8; i += 1) {
          const a = (Math.PI * 2 * i) / 8;
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(4.4, 8, 8), assets.brassBright);
          bulb.position.set(SX(x) + Math.cos(a) * 30, 210, SZ(y) + Math.sin(a) * 30);
          staticGroup.add(bulb);
        }
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 120, 6), assets.brass);
        chain.position.set(SX(x), 270, SZ(y));
        staticGroup.add(chain);
        const light = new THREE.PointLight(0xffc873, 40, 470, 2);
        light.position.set(SX(x), 160, SZ(y));
        staticGroup.add(light);
      }
      // Rope stanchions.
      for (const x of [728, 872]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 30, 8), assets.brass);
        post.position.set(SX(x), 15, SZ(198));
        staticGroup.add(post);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 10), assets.gold);
        knob.position.set(SX(x), 32, SZ(198));
        staticGroup.add(knob);
      }
      const rope = new THREE.Mesh(new THREE.TorusGeometry(72, 1.6, 6, 30, Math.PI), assets.velvet);
      rope.rotation.set(-Math.PI / 2, 0, 0);
      rope.position.set(0, 18, SZ(198) + 4);
      rope.scale.set(1, 0.32, 1);
      staticGroup.add(rope);
      // Framed paintings on the gallery walls.
      for (const [x, y] of [[416, 390], [416, 630], [1184, 390], [1184, 630]]) {
        staticGroup.add(box(4, 34, 24, assets.brass, SX(x), 44, SZ(y)));
        staticGroup.add(box(2, 26, 17, new THREE.MeshStandardMaterial({ color: 0x2d4b55, roughness: 0.7 }), SX(x) + 2.5, 44, SZ(y)));
      }
      // Potted palms at the gallery corners.
      for (const [x, y] of [[250, 286], [1350, 286], [250, 700], [1350, 700]]) {
        drawPalm(staticGroup, SX(x), SZ(y));
      }
      // Wall sconces.
      for (const [x, y] of [[44, 330], [44, 610], [1556, 330], [1556, 610]]) {
        const light = new THREE.PointLight(0xffc36b, 10, 220, 2);
        light.position.set(SX(x), 52, SZ(y));
        staticGroup.add(light);
        staticGroup.add(box(8, 8, 12, assets.brassBright, SX(x), 46, SZ(y), { castShadow: false }));
      }
    }

    if (level.decor === 'archive') {
      for (const wall of level.walls) {
        if (wall.w < 300 || wall.h > 32) continue;
        for (let x = wall.x + 10; x < wall.x + wall.w - 10; x += 9) {
          const height = 14 + Math.floor(((Math.sin(x * 0.37 + wall.y) * 43758.5453) % 1 + 1) % 1 * 14);
          const material = assets.bookColors[Math.floor(((Math.sin(x * 1.13 + wall.y * 0.7) * 43758.5453) % 1 + 1) % 1 * assets.bookColors.length)];
          const book = box(5, height, 5, material, SX(x), 40 - height / 2, SZ(wall.y + wall.h) + 3, { castShadow: false });
          staticGroup.add(book);
        }
        staticGroup.add(box(wall.w, 2.5, 4, assets.brass, SX(wall.x + wall.w / 2), 24, SZ(wall.y + wall.h) + 4, { castShadow: false }));
        staticGroup.add(box(wall.w, 2.5, 4, assets.brass, SX(wall.x + wall.w / 2), 50, SZ(wall.y + wall.h) + 4, { castShadow: false }));
      }
      for (const [x, y] of [[520, 196], [820, 196], [1250, 716]]) {
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(10, 13, 6, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x1d3d33, roughness: 0.8, side: THREE.DoubleSide }));
        shade.position.set(SX(x), 52, SZ(y));
        staticGroup.add(shade);
        const bulb = new THREE.PointLight(0xffc873, 8, 150, 2);
        bulb.position.set(SX(x), 45, SZ(y));
        staticGroup.add(bulb);
      }
    }

    if (level.decor === 'vault') {
      for (const [x, y] of [[268, 280], [1342, 280]]) {
        for (let row = 0; row < 5; row += 1) {
          for (let col = 0; col < 2; col += 1) {
            staticGroup.add(box(11, 13, 3, assets.brass, SX(x + col * 14), 28 + row * 18, SZ(y), { castShadow: false }));
          }
        }
      }
      for (const [x, y] of [[482, 422], [1086, 422]]) {
        for (let i = 0; i < 3; i += 1) {
          staticGroup.add(box(22, 5, 8, assets.gold, SX(x - 8 + i * 8), 48 + i * 2, SZ(y)));
        }
      }
      const seal = new THREE.Mesh(new THREE.TorusGeometry(26, 4, 8, 36), assets.brass);
      seal.position.set(0, 52, SZ(292));
      staticGroup.add(seal);
      // The vault door proper: a steel disc behind the plinth.
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(58, 58, 8, 36), assets.steel);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(0, 62, SZ(298) - 1);
      disc.castShadow = true;
      staticGroup.add(disc);
      const doorRing = new THREE.Mesh(new THREE.TorusGeometry(56, 4, 8, 40), assets.brass);
      doorRing.position.set(0, 62, SZ(298) + 4);
      staticGroup.add(doorRing);
      for (let i = 0; i < 6; i += 1) {
        const spoke = box(6, 96, 4, assets.brass, 0, 62, SZ(298) + 5);
        spoke.rotation.z = (Math.PI * i) / 6;
        staticGroup.add(spoke);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 10, 16), assets.gold);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(0, 62, SZ(298) + 8);
      staticGroup.add(hub);
      const cyan = new THREE.PointLight(0x79d5e8, 10, 260, 2);
      cyan.position.set(SX(300), 60, SZ(348));
      staticGroup.add(cyan);
    }
  }

  function buildDoors(level) {
    for (const door of level.doors) {
      const horizontal = door.w > door.h;
      const group = new THREE.Group();
      const leaf = box(door.w - 4, 64, door.h - 4, assets.brass, 0, 32, 0);
      group.add(leaf);
      group.position.set(SX(door.x + door.w / 2), 0, SZ(door.y + door.h / 2));
      const frame = box(door.w + 8, 74, door.h + 8, assets.brass, SX(door.x + door.w / 2), 37, SZ(door.y + door.h / 2));
      frame.material = assets.trim;
      staticGroup.add(frame);
      dynamicGroup.add(group);
      refs.doors.push({ door, group, leafHeight: 64, horizontal });
    }
  }

  function buildTerminals(level) {
    for (const terminal of level.terminals) {
      const group = new THREE.Group();
      group.position.set(SX(terminal.x), 0, SZ(terminal.y));
      group.add(box(30, 44, 30, assets.steel, 0, 22, 0));
      group.add(box(34, 4, 34, assets.trim, 0, 45, 0));
      const screen = box(22, 14, 2, assets.cyan, 0, 36, 15.5, { castShadow: false });
      group.add(screen);
      const light = new THREE.PointLight(0x79d5e8, 12, 190, 2);
      light.position.set(0, 50, 0);
      group.add(light);
      const label = makeTextSprite('TERMINAL', '#79d5e8', 360, 64, 96);
      label.position.set(0, 68, 0);
      group.add(label);
      dynamicGroup.add(group);
      refs.terminals.push({ terminal, group, screen, light, label });
    }
  }

  function buildLasers(level) {
    for (const laser of level.lasers) {
      const dx = laser.x2 - laser.x1;
      const dy = laser.y2 - laser.y1;
      const length = Math.hypot(dx, dy);
      const group = new THREE.Group();
      const beam = new THREE.Mesh(new THREE.BoxGeometry(length, 2.4, 2.4), assets.red);
      beam.position.set(length / 2, 20, 0);
      group.add(beam);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(length, 12, 12), new THREE.MeshBasicMaterial({ color: 0xe8484f, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.set(length / 2, 20, 0);
      group.add(glow);
      group.position.set(SX(laser.x1), 0, SZ(laser.y1));
      group.rotation.y = -Math.atan2(dy, dx);
      for (const end of [0, length]) {
        group.add(box(5, 26, 5, assets.steel, end, 13, 0));
      }
      dynamicGroup.add(group);
      refs.lasers.push({ laser, group, beam, glow });
    }
  }

  function buildExit(level) {
    const exit = level.exit;
    const group = new THREE.Group();
    group.position.set(SX(exit.x + exit.w / 2), 0, SZ(exit.y + exit.h / 2));
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(exit.w + 22, exit.h + 30), new THREE.MeshStandardMaterial({ color: 0x241a10, emissive: 0xf2c96b, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 1.4;
    group.add(pad);
    group.add(box(exit.w + 46, 9, 8, assets.brass, 0, 5, -exit.h / 2 - 6));
    group.add(box(11, 210, 11, assets.brass, -exit.w / 2 - 16, 105, 0));
    group.add(box(11, 210, 11, assets.brass, exit.w / 2 + 16, 105, 0));
    group.add(box(exit.w + 48, 11, 9, assets.brass, 0, 212, 0));
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(exit.w * 0.5, exit.w * 0.36, 240, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xf2c96b, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    beam.position.y = 130;
    group.add(beam);
    const light = new THREE.PointLight(0xffc66b, 0, 320, 2);
    light.position.set(0, 40, 0);
    group.add(light);
    const label = makeTextSprite(`EXIT · ${exit.label.toUpperCase()}`, '#ffe6a8', 700, 64, 300);
    label.position.set(0, 255, 0);
    group.add(label);
    dynamicGroup.add(group);
    refs.exit = { group, pad, light, label, beam, open: false };
  }

  function buildLoot(level) {
    const group = new THREE.Group();
    group.position.set(SX(level.loot.x), 0, SZ(level.loot.y));
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(44, 26, 320, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xf2c96b, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    beam.position.y = 210;
    group.add(beam);

    const object = new THREE.Group();
    if (level.id === 'archive') {
      const stand = box(58, 22, 40, assets.wood, 0, 11, 0);
      object.add(stand);
      const cover = box(40, 8, 30, new THREE.MeshStandardMaterial({ color: 0x4a1118, roughness: 0.6 }), 0, 30, 0);
      cover.rotation.y = -0.18;
      object.add(cover);
      const pages = box(36, 5, 26, new THREE.MeshStandardMaterial({ color: 0xefe3c6, roughness: 0.85 }), 0, 32, 0);
      pages.rotation.y = -0.18;
      object.add(pages);
      const clasp = box(6, 9, 31, assets.gold, 14, 30, 0);
      clasp.rotation.y = -0.18;
      object.add(clasp);
    } else if (level.id === 'atrium') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.4, 20, 8), assets.gold);
      body.position.y = 80;
      object.add(body);
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.SphereGeometry(16, 12, 8), assets.gold);
        wing.scale.set(1.6, 0.18, 0.72);
        wing.position.set(side * 15, 82, 0);
        wing.rotation.z = side * 0.28;
        object.add(wing);
      }
      const pin = new THREE.Mesh(new THREE.TorusGeometry(5, 1, 6, 16), assets.brassBright);
      pin.position.y = 94;
      pin.rotation.x = Math.PI / 2;
      object.add(pin);
    } else {
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(30, 0), assets.gold);
      core.position.y = 76;
      core.castShadow = true;
      object.add(core);
      const heart = new THREE.Mesh(new THREE.OctahedronGeometry(14, 0), new THREE.MeshStandardMaterial({ color: 0xfff4d2, emissive: 0xffd27a, emissiveIntensity: 2.2, roughness: 0.15 }));
      heart.position.y = 76;
      object.add(heart);
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8;
        const ray = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 26), assets.brassBright);
        ray.position.set(Math.cos(angle) * 32, 76, Math.sin(angle) * 32);
        ray.rotation.y = -angle;
        object.add(ray);
      }
    }
    group.add(object);

    let halo = null;
    if (level.id !== 'archive') {
      halo = new THREE.Mesh(new THREE.TorusGeometry(38, 1.6, 6, 32), assets.brassBright);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 56;
      group.add(halo);
    }
    const light = new THREE.PointLight(0xffd27a, 60, 480, 2);
    light.position.set(0, 90, 0);
    group.add(light);
    const label = makeTextSprite(level.loot.name.toUpperCase(), '#ffe6a8', 640, 64, 320);
    label.position.set(0, 185, 0);
    group.add(label);
    dynamicGroup.add(group);
    refs.loot = { group, gem: object, beam, light, halo, label, taken: false, spin: level.id === 'vault' };
  }

  function buildPlayer(level) {
    const group = new THREE.Group();
    group.position.set(SX(level.start.x), 0, SZ(level.start.y));
    group.scale.setScalar(1.65);

    const ring = new THREE.Mesh(new THREE.RingGeometry(23, 28, 36), new THREE.MeshBasicMaterial({ color: 0xf2c96b, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1.2;
    group.add(ring);

    const legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 18, 8), assets.dark);
      leg.position.set(side * 6, 9, 0);
      leg.castShadow = true;
      group.add(leg);
      legs.push(leg);
    }

    const coat = new THREE.Mesh(new THREE.CylinderGeometry(11, 17, 32, 12), assets.coat);
    coat.position.y = 35;
    coat.castShadow = true;
    group.add(coat);
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 10), assets.coat);
    shoulders.scale.set(1.15, 0.55, 0.9);
    shoulders.position.y = 51;
    group.add(shoulders);

    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 17, 8), assets.coat);
      arm.position.set(-2, 43, side * 11);
      arm.rotation.x = side * 0.18;
      arm.castShadow = true;
      group.add(arm);
      arms.push(arm);
    }

    const head = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 12), assets.skin);
    head.position.y = 61;
    head.castShadow = true;
    group.add(head);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 2.2, 16), assets.dark);
    brim.position.y = 66;
    group.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.5, 10, 14), assets.dark);
    crown.position.y = 72;
    crown.castShadow = true;
    group.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(9.7, 9.7, 2.4, 16), assets.gold);
    band.position.y = 68.5;
    group.add(band);

    const shirt = new THREE.Mesh(new THREE.BoxGeometry(7, 10, 2), new THREE.MeshStandardMaterial({ color: 0xf1e4c8, roughness: 0.75 }));
    shirt.position.set(4, 43, 11);
    group.add(shirt);

    const scarf = new THREE.Mesh(new THREE.BoxGeometry(5, 18, 2), assets.gold);
    scarf.position.set(-12, 42, -8);
    scarf.rotation.x = 0.5;
    group.add(scarf);

    const satchel = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 10), assets.gold);
    satchel.position.set(-13, 34, 3);
    satchel.visible = false;
    group.add(satchel);

    dynamicGroup.add(group);
    refs.player = { group, legs, arms, scarf, satchel, coat, ring };
  }

  function buildGuards(level) {
    level.guards.forEach((guard, index) => {
      const group = new THREE.Group();
      group.position.set(SX(guard.path[0][0]), 0, SZ(guard.path[0][1]));
      group.scale.setScalar(1.65);

      const legs = [];
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5, 18, 8), assets.dark);
        leg.position.set(side * 6.5, 9, 0);
        leg.castShadow = true;
        group.add(leg);
        legs.push(leg);
      }
      const body = new THREE.Mesh(new THREE.CylinderGeometry(12, 15, 34, 12), assets.guardCoat);
      body.position.y = 37;
      body.castShadow = true;
      group.add(body);
      const shoulders = new THREE.Mesh(new THREE.BoxGeometry(32, 9, 18), assets.guardCoat);
      shoulders.position.y = 54;
      shoulders.castShadow = true;
      group.add(shoulders);
      const arms = [];
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.2, 19, 8), assets.guardCoat);
        arm.position.set(-3, 44, side * 13);
        arm.rotation.x = side * 0.16;
        arm.castShadow = true;
        group.add(arm);
        arms.push(arm);
      }
      const head = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 12), assets.skin);
      head.position.y = 64;
      group.add(head);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 10, 7, 14), assets.guardCap);
      cap.position.y = 71;
      cap.castShadow = true;
      group.add(cap);
      const peak = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 7), assets.guardCap);
      peak.position.set(0, 68, 6);
      group.add(peak);
      const badge = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8), assets.gold);
      badge.position.set(0, 56, 9);
      group.add(badge);
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 8), assets.brassBright);
      lantern.position.set(12, 44, 12);
      group.add(lantern);
      const baton = new THREE.Mesh(new THREE.BoxGeometry(4, 22, 4), assets.dark);
      baton.position.set(-16, 40, 6);
      baton.rotation.z = 0.25;
      group.add(baton);

      const mood = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      mood.position.set(0, 96, 0);
      mood.scale.set(30, 30, 1);
      mood.visible = false;
      group.add(mood);

    const cone = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
      color: 0xff2a38,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
      cone.position.y = 1.6;
      dynamicGroup.add(cone);

      dynamicGroup.add(group);
      refs.guards.push({ index, guard, group, legs, arms, body, cone, mood, face: guard.angle });
    });
  }

  function buildCameras(level) {
    level.cameras.forEach((cameraDef, index) => {
      const group = new THREE.Group();
      group.position.set(SX(cameraDef.x), 68, SZ(cameraDef.y));
      group.scale.setScalar(1.6);
      group.add(box(30, 18, 22, assets.steel, 0, 0, 0));
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 6.2, 8, 12), assets.cyan);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0, 14);
      group.add(lens);
      const bracket = box(6, 46, 6, assets.brass, -12, -22, -8);
      group.add(bracket);
      const blink = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xe8484f, transparent: true, opacity: 0.95, depthWrite: false }));
      blink.position.set(-12, 10, 0);
      blink.scale.set(16, 16, 1);
      group.add(blink);
      const lensGlow = new THREE.Mesh(new THREE.SphereGeometry(4.2, 10, 10), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.8 }));
      lensGlow.position.set(0, 0, 18);
      group.add(lensGlow);
      dynamicGroup.add(group);

      const cone = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
        color: 0xff4a20,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
      }));
      cone.position.y = 1.5;
      dynamicGroup.add(cone);

      const beamGroup = new THREE.Group();
      beamGroup.position.set(SX(cameraDef.x), 0, SZ(cameraDef.y));
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(cameraDef.range, 0.7, 1.6),
        new THREE.MeshBasicMaterial({ color: 0xff7a3a, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      beam.position.set(cameraDef.range / 2, 2.2, 0);
      beamGroup.add(beam);
      dynamicGroup.add(beamGroup);
      refs.cameras.push({ index, camera: cameraDef, group, lens, lensGlow, blink, cone, beamGroup, beam });
    });
  }

  function buildDust(level) {
    const count = 90;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = SX(level.loot.x) + (Math.sin(i * 7.1) * 0.5) * 260;
      positions[i * 3 + 1] = 20 + ((Math.sin(i * 3.7) * 0.5) + 0.5) * 180;
      positions[i * 3 + 2] = SZ(level.loot.y) + (Math.cos(i * 5.3) * 0.5) * 220;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xf2c96b, size: 2.2, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    refs.dust = new THREE.Points(geometry, material);
    dynamicGroup.add(refs.dust);
  }

  function updateCone(mesh, x, y, angle, fov, range, blockers, color) {
    const points = conePolygon(x, y, angle, fov, range, blockers, 28);
    let finite = points.length > 2;
    for (const point of points) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        finite = false;
        break;
      }
    }
    if (!finite) {
      mesh.visible = false;
      if (mesh.userData.outline) mesh.userData.outline.visible = false;
      return;
    }
    mesh.visible = true;
    const vertices = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i += 1) {
      vertices[i * 3] = SX(points[i].x);
      vertices[i * 3 + 1] = 0;
      vertices[i * 3 + 2] = SZ(points[i].y);
    }
    const indices = [];
    for (let i = 1; i < points.length - 1; i += 1) indices.push(0, i, i + 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    mesh.geometry.dispose();
    mesh.geometry = geometry;
    mesh.material.color.setHex(color);

    let outline = mesh.userData.outline;
    if (!outline) {
      outline = new THREE.LineLoop(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.42, depthWrite: false }),
      );
      mesh.userData.outline = outline;
      mesh.parent.add(outline);
    }
    outline.geometry.dispose();
    outline.geometry = new THREE.BufferGeometry().setFromPoints(
      points.map((point) => new THREE.Vector3(SX(point.x), 1.75, SZ(point.y))),
    );
    outline.material.color.setHex(color);
    outline.visible = true;
  }

  function poseActor(group, x, y, angle) {
    group.position.set(SX(x), 0, SZ(y));
    group.rotation.y = Math.PI / 2 - angle;
  }

  function update(world, time) {
    const blockers = sightBlockers(world);

    // The alarm paints the room red as it climbs.
    alarmLight.intensity = world.alarm >= 62
      ? (world.alarm / 100) * 18 * (0.78 + 0.22 * Math.sin(time * (world.alarm >= 84 ? 9 : 5)))
      : 0;

    // Player pose and legs.
    const p = refs.player;
    if (p) {
      poseActor(p.group, world.player.x, world.player.y, world.player.facing);
      p.group.scale.set(1.65, world.player.sneaking ? 1.32 : 1.65, 1.65);
      const stride = world.player.moving ? Math.sin(world.player.animTime * 10) * 8 : 0;
      p.legs[0].rotation.x = stride * 0.08;
      p.legs[1].rotation.x = -stride * 0.08;
      p.legs[0].position.z = stride * 0.35;
      p.legs[1].position.z = -stride * 0.35;
      p.arms[0].rotation.x = 0.18 + stride * 0.055;
      p.arms[1].rotation.x = -0.18 - stride * 0.055;
      p.satchel.visible = world.player.carrying;
      p.scarf.rotation.z = Math.sin(time * 2.2) * 0.08;
      p.coat.material = world.player.shadowed ? assets.coatShadow : assets.coat;
      p.ring.material.opacity = 0.28 + 0.15 * Math.sin(time * 2);
    }

    // Guards.
    for (const item of refs.guards) {
      const guard = world.guards[item.index];
      if (!guard) continue;
      poseActor(item.group, guard.x, guard.y, guard.angle);
      const stride = guard.state === 'chase' ? Math.sin(guard.animTime * 12) * 7 : Math.sin(guard.animTime * 5) * 3;
      item.legs[0].position.z = stride * 0.3;
      item.legs[1].position.z = -stride * 0.3;
      item.arms[0].rotation.x = 0.16 + stride * 0.04;
      item.arms[1].rotation.x = -0.16 - stride * 0.04;
      item.body.material = guard.state === 'chase' ? assets.guardChase : assets.guardCoat;
      const mood = guardMood(guard);
      if (mood) {
        item.mood.visible = true;
        item.mood.material.map = mood.text === '!' ? moodExclaim : moodQuestion;
        item.mood.material.needsUpdate = true;
      } else {
        item.mood.visible = false;
      }
      updateCone(item.cone, guard.x, guard.y, guard.angle, guard.fov, guard.range, blockers, 0xff2a38);
    }

    // Cameras.
    for (const item of refs.cameras) {
      const cameraState = world.cameras[item.index];
      if (!cameraState) continue;
      item.group.rotation.y = Math.PI / 2 - cameraState.angle;
      const disabled = cameraState.disabled > 0;
      item.lens.material = disabled ? assets.steel : assets.cyan;
      item.lensGlow.visible = !disabled;
      item.blink.material.opacity = disabled ? 0.2 : cameraState.alert > 0 ? 0.4 + 0.6 * Math.sin(time * 14) : 0.55 + 0.45 * Math.sin(time * 2.6);
      if (disabled) {
        item.cone.visible = false;
        item.beamGroup.visible = false;
      } else {
        item.cone.visible = true;
        item.beamGroup.visible = true;
        item.beamGroup.rotation.y = -cameraState.angle;
        updateCone(item.cone, cameraState.x, cameraState.y, cameraState.angle, cameraState.fov, cameraState.range, blockers, 0xff4a20);
      }
    }

    // Doors slide into the floor.
    for (const item of refs.doors) {
      const target = item.door.open ? -50 : 0;
      item.group.position.y += (target - item.group.position.y) * Math.min(1, 0.12);
    }

    // Terminals.
    for (const item of refs.terminals) {
      const used = item.terminal.used;
      item.screen.material = used ? assets.steel : assets.cyan;
      item.light.intensity = used ? 2 : 12;
      item.label.material.opacity = used ? 0.35 : 0.9;
    }

    // Lasers.
    for (const item of refs.lasers) {
      const active = world.laserOff <= 0;
      item.beam.visible = active;
      item.glow.visible = active;
      if (active) {
        item.glow.material.opacity = 0.08 + 0.06 * (0.5 + 0.5 * Math.sin(time * 9));
      }
    }

    // Loot.
    if (refs.loot) {
      const taken = world.loot.taken;
      refs.loot.gem.visible = !taken;
      refs.loot.beam.visible = !taken;
      if (refs.loot.halo) refs.loot.halo.visible = !taken;
      refs.loot.light.intensity = taken ? 0 : 30 + Math.sin(time * 2.4) * 8;
      refs.loot.label.visible = !taken;
      if (!taken) {
        if (refs.loot.spin) {
          refs.loot.gem.rotation.y = time * 0.9;
          refs.loot.gem.position.y = Math.sin(time * 1.8) * 3;
        } else {
          refs.loot.gem.rotation.y = Math.sin(time * 0.8) * 0.08;
          refs.loot.gem.position.y = Math.sin(time * 1.5) * 1.2;
        }
        if (refs.loot.halo) refs.loot.halo.rotation.z = time * 0.4;
      }
    }

    // Exit opens with the take.
    if (refs.exit) {
      const open = world.loot.taken;
      refs.exit.light.intensity = open ? 34 : 0;
      refs.exit.pad.material.emissiveIntensity = open ? 1.4 : 0.15;
      refs.exit.pad.material.color.setHex(open ? 0x6b4a18 : 0x2a1418);
      refs.exit.label.material.color.setHex(open ? 0xffffff : 0x8a5555);
      refs.exit.beam.material.opacity = open ? 0.1 + 0.04 * Math.sin(time * 2.2) : 0;
    }

    // Smoke.
    const liveClouds = new Set(world.smokes);
    for (const [cloud, group] of refs.smoke) {
      if (!liveClouds.has(cloud)) {
        dynamicGroup.remove(group);
        refs.smoke.delete(cloud);
      }
    }
    for (const cloud of world.smokes) {
      let group = refs.smoke.get(cloud);
      if (!group) {
        group = new THREE.Group();
        for (let i = 0; i < 7; i += 1) {
          const puff = new THREE.Mesh(
            new THREE.SphereGeometry(1, 10, 10),
            new THREE.MeshBasicMaterial({ color: 0xc4cfd2, transparent: true, opacity: 0.1, depthWrite: false }),
          );
          puff.userData.seed = i;
          group.add(puff);
        }
        refs.smoke.set(cloud, group);
        dynamicGroup.add(group);
      }
      group.position.set(SX(cloud.x), 0, SZ(cloud.y));
      const fade = Math.min(1, cloud.life / 1.2);
      for (const puff of group.children) {
        const i = puff.userData.seed;
        const angle = cloud.spin + i * 0.9;
        const radius = cloud.radius * (0.1 + 0.34 * ((i * 0.37) % 1));
        puff.position.set(Math.cos(angle) * radius, 24 + (i % 3) * 14, Math.sin(angle) * radius * 0.8);
        const size = cloud.radius * (0.56 + 0.18 * ((i * 0.53) % 1));
        puff.scale.setScalar(size * fade);
        puff.material.opacity = 0.13 * fade;
      }
    }

    // Particle points.
    if (refs.particles) {
      const positions = refs.particles.geometry.attributes.position.array;
      const colors = refs.particles.geometry.attributes.color.array;
      const count = Math.min(world.particles.length, 300);
      const tint = new THREE.Color();
      for (let i = 0; i < 300; i += 1) {
        if (i < count) {
          const particle = world.particles[i];
          positions[i * 3] = SX(particle.x);
          positions[i * 3 + 1] = 10 + (particle.life / particle.maxLife) * 70;
          positions[i * 3 + 2] = SZ(particle.y);
          if (particle.color.startsWith('#')) tint.set(particle.color);
          else tint.setHex(0xc4cfd2);
          colors[i * 3] = tint.r;
          colors[i * 3 + 1] = tint.g;
          colors[i * 3 + 2] = tint.b;
        } else {
          positions[i * 3 + 1] = -100;
        }
      }
      refs.particles.geometry.attributes.position.needsUpdate = true;
      refs.particles.geometry.attributes.color.needsUpdate = true;
    }

    // Rings.
    if (refs.rings.length < 4) {
      for (let i = refs.rings.length; i < 4; i += 1) {
        const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 8, 48), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 2;
        dynamicGroup.add(mesh);
        refs.rings.push(mesh);
      }
    }
    for (let i = 0; i < refs.rings.length; i += 1) {
      const mesh = refs.rings[i];
      const ring = world.rings[i];
      if (ring) {
        mesh.visible = true;
        mesh.position.x = SX(ring.x);
        mesh.position.z = SZ(ring.y);
        mesh.scale.setScalar(ring.radius);
        mesh.material.color.set(ring.color);
        mesh.material.opacity = Math.max(0, ring.life / ring.maxLife) * 0.8;
      } else {
        mesh.visible = false;
      }
    }

    // Dust motes drift around the plinth.
    if (refs.dust) {
      const positions = refs.dust.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(time * 0.7 + i) * 0.06;
        if (positions[i + 1] > 210) positions[i + 1] = 18;
      }
      refs.dust.geometry.attributes.position.needsUpdate = true;
      refs.dust.material.opacity = world.loot.taken ? 0 : 0.5;
    }
  }

  function ensureParticleSystem() {
    if (refs.particles) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(300 * 3), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(300 * 3), 3));
    const material = new THREE.PointsMaterial({ size: 4.5, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    refs.particles = new THREE.Points(geometry, material);
    dynamicGroup.add(refs.particles);
  }

  function drawOverlay(world, screen, time, stats) {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.setTransform(dpr * stage.scale, 0, 0, dpr * stage.scale, dpr * stage.ox, dpr * stage.oy);

    if (world.blueprint) {
      drawBlueprint(octx, world);
      return;
    }

    // Atmosphere under the HUD.
    const vignette = octx.createRadialGradient(800, 440, 260, 800, 440, 960);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.62, 'rgba(0,0,0,0.12)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.52)');
    octx.fillStyle = vignette;
    octx.fillRect(0, 0, WORLD.width, WORLD.height);

    if (grain) {
      octx.save();
      octx.globalAlpha = 0.5;
      octx.fillStyle = grain;
      octx.fillRect(0, 0, WORLD.width, WORLD.height);
      octx.restore();
    }

    if (world.flashRed > 0) {
      octx.fillStyle = `rgba(180, 20, 36, ${world.flashRed * 0.24})`;
      octx.fillRect(0, 0, WORLD.width, WORLD.height);
    }
    if (world.flashGold > 0) {
      octx.fillStyle = `rgba(242, 201, 107, ${world.flashGold * 0.14})`;
      octx.fillRect(0, 0, WORLD.width, WORLD.height);
    }
    if (world.alarm >= 62 && world.phase === 'play') {
      const pulse = 0.4 + 0.6 * Math.sin(world.time * (world.alarm >= 84 ? 9 : 5));
      octx.save();
      octx.strokeStyle = `rgba(232, 72, 79, ${0.08 + pulse * 0.16})`;
      octx.lineWidth = 10;
      octx.strokeRect(4, 4, WORLD.width - 8, WORLD.height - 8);
      octx.restore();
    }

    if (screen === 'play' || screen === 'paused') drawHud(octx, world);
    if (screen === 'paused') drawPause(octx);
    if (screen === 'caught') drawCaught(octx, world);
    if (screen === 'victory') drawVictory(octx, stats ?? world.stats, time);
    if (screen === 'title') drawTitle(octx, time);
    if (screen === 'briefing') drawBriefing(octx, world.level);
  }

  function draw(world, screen, time, stats) {
    if (builtLevel !== world.level.id) buildLevel(world.level);
    if (screen !== 'title' && screen !== 'briefing') ensureParticleSystem();
    update(world, time);

    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cssWidth, cssHeight);
    renderer.setScissor(0, 0, cssWidth, cssHeight);
    renderer.setClearColor(0x05070c, 1);
    renderer.clear();
    renderer.setViewport(stage.ox, cssHeight - stage.oy - stage.h, stage.w, stage.h);
    renderer.setScissor(stage.ox, cssHeight - stage.oy - stage.h, stage.w, stage.h);
    renderer.setScissorTest(true);
    renderer.render(scene, camera);

    drawOverlay(world, screen, time, stats);
  }

  // Cache the two mood textures once, before any guard asks for one.
  const moodQuestion = makeMoodTexture('?', '#f2c96b');
  const moodExclaim = makeMoodTexture('!', '#e8484f');

  resize();
  window.addEventListener('resize', resize);
  if (window.__fontReady) ready.then(() => buildLevelGraphIfPossible());

  function buildLevelGraphIfPossible() {
    // The first real draw builds the level; nothing else is needed here.
  }

  return { draw, toWorld, ready };
}

function makeMoodTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(5, 8, 12, 0.85)';
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '700 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
