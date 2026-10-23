import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'gsap';

// Kenney models (CC0) copied to public/progress. Island 1 sits at the back and the road
// winds toward the camera, so the last levels are the closest and biggest.
const SPREAD = 1.45;
const ISLANDS = [[-7.5, -7.5], [-1.8, -8.2], [4.6, -5.6], [1.2, -1.4], [-5, -0.6], [-3.6, 5], [3.4, 6.4]].map(([x, z]) => [x * SPREAD, z * SPREAD]);
const PROPS = [
  [['industrial/building-h', 0, 0, 0, .62], ['platformer/crate', .95, .55, .3, .24], ['platformer/tree', -1, .6, 0, .4], ['platformer/tree-pine', -.75, -.8, 0, .36]],
  [['industrial/building-i', -.2, .05, 0, .62], ['industrial/detail-tank', .95, -.45, 0, .46], ['platformer/tree', -1.1, .7, 0, .4], ['platformer/tree-pine', .95, .85, 0, .34]],
  [['industrial/building-j', -.3, 0, 0, .64], ['industrial/chimney-small', .75, -.75, 0, .52], ['industrial/detail-tank', 1, .5, 0, .46], ['industrial/shipping-container-a', -1.1, .9, Math.PI / 2, .3], ['platformer/tree', -1.15, -.75, 0, .36]],
  [['industrial/building-m', -.2, -.1, 0, .7], ['industrial/detail-tank-large', 1.15, .35, 0, .46], ['industrial/water-tower', -1.25, -.6, 0, .44], ['industrial/shipping-container-b', .2, 1.15, 0, .3], ['platformer/tree-pine', -1.2, .9, 0, .34]],
  [['industrial/building-e', -.3, -.2, 0, .72], ['industrial/chimney-large', 1, -.8, 0, .56], ['industrial/detail-tank-large', 1.1, .6, 0, .5], ['industrial/shipping-container-c', -1.2, .9, 0, .3], ['industrial/shipping-container-a', -.65, 1.2, 0, .3], ['platformer/tree', -1.4, -.6, 0, .36]],
  [['industrial/building-o', -.5, -.3, 0, .66], ['industrial/building-l', .9, .5, 0, .56], ['industrial/chimney-large', .95, -.9, 0, .56], ['industrial/solar-panel-landscape-group', -.9, 1, 0, .46], ['industrial/windmill', -1.5, -.45, 0, .5], ['platformer/tree-pine', .1, 1.3, 0, .32]],
  [['industrial/building-d', -.4, -.4, 0, .7], ['industrial/building-e', .8, .3, 0, .64], ['industrial/chimney-large', 1.3, -.8, 0, .56], ['industrial/chimney-large', -1.35, .1, 0, .5], ['industrial/detail-tank-large', -.6, 1, 0, .5], ['industrial/windmill', 1.4, 1.1, 0, .46], ['industrial/water-tower', .2, -1.4, 0, .44]],
];
// Radius of the flat sides of each hexagon (its inscribed circle): props must stay inside it.
const radiusFor = index => 1.8 + index * .16;
const WATER_Y = -1.5;
const CAMERA_OFFSET = new THREE.Vector3(0, 19, 22);

const loader = new GLTFLoader();
const templates = new Map();
function loadModel(name) {
  if (!templates.has(name)) {
    templates.set(name, loader.loadAsync(`/progress/${name}.glb`).then(gltf => {
      const model = gltf.scene;
      // Normalise every template: centred on x/z and resting on y = 0.
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -box.min.y, -center.z);
      const wrapper = new THREE.Group();
      wrapper.add(model);
      wrapper.userData.height = box.max.y - box.min.y;
      wrapper.userData.width = Math.min(box.max.x - box.min.x, box.max.z - box.min.z);
      return wrapper;
    }));
  }
  return templates.get(name);
}

// Locked islands are rendered desaturated through a shared uniform instead of swapping materials.
function tintable(root, grey) {
  root.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.material = node.material.clone();
    node.material.onBeforeCompile = shader => {
      shader.uniforms.uGrey = grey;
      shader.fragmentShader = `uniform float uGrey;\n${shader.fragmentShader}`.replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float luma = dot(gl_FragColor.rgb, vec3(.299, .587, .114));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(luma) * .8 + vec3(.07, .09, .12), uGrey);`);
    };
    node.material.customProgramCacheKey = () => 'progress-grey';
  });
}

function makeCloud() {
  const cloud = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: '#dfe9f2', roughness: 1, flatShading: true, transparent: true, opacity: .7 });
  for (const [x, y, z, s] of [[0, 0, 0, .7], [.6, -.1, .2, .5], [-.6, -.12, .1, .52], [.2, .25, -.2, .45], [-.25, .2, .3, .4]]) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), material);
    puff.position.set(x, y, z);
    cloud.add(puff);
  }
  return cloud;
}

// Low-poly sea: waves move on the GPU, shallow water and foam ring each island.
function makeWater(islands) {
  const geometry = new THREE.PlaneGeometry(170, 170, 150, 150);
  geometry.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uIslands: { value: islands.map(island => new THREE.Vector3(island.x, island.z, island.radius * 1.06)) },
  };
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .28, metalness: .05, flatShading: true });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `uniform float uTime;\nvarying vec2 vWaterWorld;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec2 waterXZ = (modelMatrix * vec4(position, 1.)).xz;
      transformed.y += sin(waterXZ.x * .42 + uTime * 1.1) * .09 + cos(waterXZ.y * .5 + uTime * .8) * .08 + sin((waterXZ.x + waterXZ.y) * .9 - uTime * 1.7) * .035;
      vWaterWorld = waterXZ;`);
    shader.fragmentShader = `uniform float uTime;\nuniform vec3 uIslands[${islands.length}];\nvarying vec2 vWaterWorld;
      float waterHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      ${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
      float shore = 1e3;
      for (int i = 0; i < ${islands.length}; i++) shore = min(shore, length(vWaterWorld - uIslands[i].xy) - uIslands[i].z);
      float wobble = sin(vWaterWorld.x * 2.3 + uTime * 1.3) * sin(vWaterWorld.y * 2.1 - uTime) * .14;
      vec3 deep = vec3(.004, .035, .085), open = vec3(.008, .09, .17), shallow = vec3(.02, .26, .32);
      vec3 sea = mix(deep, open, smoothstep(-35., 15., vWaterWorld.y));
      sea = mix(sea, shallow, 1. - smoothstep(0., 3.2, shore + wobble));
      float foam = 1. - smoothstep(.0, .3, abs(shore - .12 - .1 * sin(uTime * 1.4) + wobble));
      float ripple = smoothstep(.9, 1., fract(shore * .55 - uTime * .22)) * (1. - smoothstep(.4, 2.6, shore)) * .55;
      float sparkle = step(.998, waterHash(floor(vWaterWorld * 4.) + floor(uTime * 1.2))) * (1. - smoothstep(8., 30., length(vWaterWorld))) * .35;
      diffuseColor.rgb = mix(sea, vec3(.75, .88, .92), clamp(foam + ripple + sparkle, 0., 1.));`);
  };
  material.customProgramCacheKey = () => 'progress-water';
  const water = new THREE.Mesh(geometry, material);
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  water.userData.uniforms = uniforms;
  return water;
}

function makeRoad(curve, islands) {
  const samples = 480, width = .6;
  const positions = [], indices = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const point = curve.getPointAt(t);
    const side = curve.getTangentAt(t).cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(width / 2);
    positions.push(point.x + side.x, .05, point.z + side.z, point.x - side.x, .05, point.z - side.z);
    if (i < samples) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const road = new THREE.Group();
  const asphalt = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#3a4656', roughness: .9, side: THREE.DoubleSide }));
  asphalt.receiveShadow = true;
  road.add(asphalt);
  // Bridge pillars wherever the road crosses open water.
  const pillar = new THREE.CylinderGeometry(.07, .09, 1.6, 6);
  const pillarMaterial = new THREE.MeshStandardMaterial({ color: '#8a96a6', roughness: .8 });
  for (let i = 0; i <= 90; i++) {
    const point = curve.getPointAt(i / 90);
    if (islands.some(island => Math.hypot(point.x - island.x, point.z - island.z) < island.radius * .95)) continue;
    const post = new THREE.Mesh(pillar, pillarMaterial);
    post.position.set(point.x, -.75, point.z);
    post.castShadow = true;
    road.add(post);
  }
  return road;
}

export async function createProgressScene(container, { level = 1, skinImage = '/mascot/pinguino-feliz.png', labels = new Map(), onSelect = () => {}, reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.className = 'progress-canvas';
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#06192a');
  scene.fog = new THREE.Fog('#06192a', 50, 110);
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 180);
  scene.add(new THREE.HemisphereLight('#d7ecff', '#0b2a3a', 1.6));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
  sun.position.set(9, 16, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 60 });
  scene.add(sun);

  const names = new Set(['platformer/block-grass-overhang-hexagon', 'platformer/chest', 'platformer/coin-gold', 'car/truck', ...PROPS.flat().map(([name]) => name)]);
  const loaded = new Map(await Promise.all([...names].map(async name => [name, await loadModel(name)])));
  const instance = name => loaded.get(name).clone(true);

  const islands = ISLANDS.map(([x, z], index) => {
    const radius = radiusFor(index);
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const grey = { value: 0 };
    const base = instance('platformer/block-grass-overhang-hexagon');
    const { height: baseHeight, width: baseWidth } = loaded.get('platformer/block-grass-overhang-hexagon').userData;
    const baseScale = radius * 2 / baseWidth;
    base.scale.set(baseScale, 1.25, baseScale);
    base.position.y = -baseHeight * 1.25;
    base.rotation.y = index * .7;
    const props = new THREE.Group();
    const footprint = new THREE.Box3(), size = new THREE.Vector3();
    for (const [name, px, pz, rotation, scale] of PROPS[index]) {
      const prop = instance(name);
      prop.rotation.y = rotation + (index % 2 ? -.35 : .35);
      prop.scale.setScalar(scale * 1.55 * (1 + index * .04));
      // Pull a prop inward when its footprint would hang over the edge of the island.
      footprint.setFromObject(prop).getSize(size);
      const half = Math.hypot(size.x, size.z) / 2;
      const spot = new THREE.Vector2(px, pz).multiplyScalar(radius * .58);
      const limit = Math.max(0, radius * .9 - half);
      if (spot.length() > limit) spot.setLength(limit);
      prop.position.set(spot.x, 0, spot.y);
      props.add(prop);
    }
    group.add(base, props);
    tintable(group, grey);
    const cloud = makeCloud();
    cloud.position.set(0, 2.6, 0);
    cloud.scale.setScalar(radius * .42);
    group.add(cloud);
    scene.add(group);
    return { level: index + 1, x, z, radius, group, base, props, grey, cloud };
  });
  const water = makeWater(islands);
  scene.add(water);

  const curve = new THREE.CatmullRomCurve3(islands.map(island => new THREE.Vector3(island.x, 0, island.z)), false, 'centripetal');
  scene.add(makeRoad(curve, islands));
  const islandT = islands.map((_, index) => {
    // Arc-length position of each island on the road, used for lights and the truck.
    let best = 0, bestDistance = Infinity;
    for (let i = 0; i <= 400; i++) {
      const point = curve.getPointAt(i / 400);
      const distance = Math.hypot(point.x - islands[index].x, point.z - islands[index].z);
      if (distance < bestDistance) { bestDistance = distance; best = i / 400; }
    }
    return best;
  });

  const dotGeometry = new THREE.SphereGeometry(.07, 8, 6);
  const dotOn = new THREE.MeshStandardMaterial({ color: '#ffd124', emissive: '#ffb800', emissiveIntensity: 1.6 });
  const dotOff = new THREE.MeshStandardMaterial({ color: '#56677a', roughness: .8 });
  const dots = Array.from({ length: 90 }, (_, i) => {
    const t = i / 89;
    const dot = new THREE.Mesh(dotGeometry, dotOff);
    dot.position.copy(curve.getPointAt(t)).setY(.12);
    dot.userData.t = t;
    scene.add(dot);
    return dot;
  });

  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .045, 8, 64), new THREE.MeshStandardMaterial({ color: '#25d5e3', emissive: '#25d5e3', emissiveIntensity: 2.2 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = .08;
  scene.add(ring);

  const chest = instance('platformer/chest');
  chest.scale.setScalar(.32);
  const lid = chest.getObjectByName('lid');
  scene.add(chest);

  const truck = instance('car/truck');
  truck.scale.setScalar(.22);
  scene.add(truck);

  const mascotTexture = await new THREE.TextureLoader().loadAsync(skinImage);
  mascotTexture.colorSpace = THREE.SRGBColorSpace;
  const mascot = new THREE.Sprite(new THREE.SpriteMaterial({ map: mascotTexture, transparent: true }));
  const aspect = mascotTexture.image.width / mascotTexture.image.height;
  mascot.scale.set(1.5 * aspect, 1.5, 1);
  mascot.center.set(.5, 0);
  scene.add(mascot);

  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enablePan: false, enableDamping: !reducedMotion, dampingFactor: .08, minDistance: 12, maxDistance: 80, minPolarAngle: .45, maxPolarAngle: 1.15, rotateSpeed: .5 });

  let current = level, truckTween = null, idle = [], celebrating = false;
  const islandAt = n => islands[Math.min(islands.length, Math.max(1, n)) - 1];
  const placeMascot = island => mascot.position.set(island.x + island.radius * .38, .05, island.z + island.radius * .45);

  function lightRoad(upTo) {
    for (const dot of dots) dot.material = dot.userData.t <= upTo + .001 ? dotOn : dotOff;
  }
  function driveTruck() {
    truckTween?.kill();
    const end = islandT[current - 1];
    const place = t => {
      const point = curve.getPointAt(t);
      truck.position.set(point.x, .06, point.z);
      const ahead = curve.getPointAt(Math.min(1, t + .002));
      truck.lookAt(ahead.x, .06, ahead.z);
    };
    if (end < .01 || reducedMotion) { place(Math.max(0, end - .02)); return; }
    const proxy = { t: 0 };
    let previous = 0;
    truckTween = gsap.to(proxy, { t: end, duration: 3 + current * 1.2, ease: 'sine.inOut', yoyo: true, repeat: -1, repeatDelay: .8, onUpdate: () => {
      // The truck faces where it is heading, so it turns around on the way back.
      const step = proxy.t >= previous ? .002 : -.002;
      previous = proxy.t;
      const point = curve.getPointAt(proxy.t);
      truck.position.set(point.x, .06, point.z);
      const ahead = curve.getPointAt(Math.min(1, Math.max(0, proxy.t + step)));
      truck.lookAt(ahead.x, .06, ahead.z);
    } });
  }
  function placeChest() {
    const next = islands[current];
    chest.visible = Boolean(next);
    if (!next) return;
    chest.position.set(next.x - next.radius * .35, .02, next.z + next.radius * .5);
    chest.rotation.set(0, .4, 0);
    if (lid) lid.rotation.x = 0;
  }
  function applyLevel(levelNumber) {
    current = levelNumber;
    for (const island of islands) {
      const locked = island.level > current;
      island.grey.value = locked ? 1 : 0;
      island.cloud.visible = locked;
      island.cloud.scale.setScalar(island.radius * .42);
    }
    const here = islandAt(current);
    ring.position.set(here.x, .08, here.z);
    ring.scale.setScalar(here.radius * 1.2);
    placeMascot(here);
    lightRoad(islandT[current - 1]);
    placeChest();
    driveTruck();
  }

  // Overview frames the seven islands; narrow screens pull the camera further back.
  const mapCenter = new THREE.Vector3(islands.reduce((sum, island) => sum + island.x, 0) / islands.length, 0, islands.reduce((sum, island) => sum + island.z, 0) / islands.length + 2.5);
  function overview(instant = false) {
    const aspect = camera.aspect || 1.6;
    return moveCamera(mapCenter, CAMERA_OFFSET.clone().multiplyScalar(1.6 / Math.max(.78, Math.min(1, aspect / 1.35))), instant);
  }
  function focus(levelNumber, instant = false) {
    const island = islandAt(levelNumber);
    return moveCamera(new THREE.Vector3(island.x, 0, island.z), CAMERA_OFFSET, instant);
  }
  function moveCamera(target, offset, instant) {
    const position = target.clone().add(offset);
    if (instant || reducedMotion) {
      controls.target.copy(target);
      camera.position.copy(position);
      controls.update();
      return Promise.resolve();
    }
    return new Promise(resolve => {
      gsap.to(controls.target, { x: target.x, y: 0, z: target.z, duration: 1.1, ease: 'power3.inOut' });
      gsap.to(camera.position, { x: position.x, y: position.y, z: position.z, duration: 1.1, ease: 'power3.inOut', onComplete: resolve });
    });
  }

  function startIdle() {
    if (reducedMotion) return;
    idle = [
      gsap.to(mascot.position, { y: .22, duration: .7, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
      gsap.to(ring.material, { emissiveIntensity: .8, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
      gsap.timeline({ repeat: -1, repeatDelay: 1.6, delay: 1 }).to(chest.rotation, { z: .1, duration: .1, yoyo: true, repeat: 5, ease: 'sine.inOut' }),
      ...islands.map((island, i) => gsap.to(island.cloud.position, { y: 2.85, duration: 2.4 + i * .2, yoyo: true, repeat: -1, ease: 'sine.inOut' })),
    ];
  }

  async function celebrate(from, to) {
    if (to <= from || celebrating) return;
    celebrating = true;
    try { await playCelebration(from, to); } finally { celebrating = false; }
  }
  async function playCelebration(from, to) {
    idle.forEach(tween => tween.kill());
    applyLevel(from);
    const target = islandAt(to);
    if (reducedMotion) { applyLevel(to); focus(to, true); return; }
    await focus(from);
    const proxy = { t: islandT[from - 1] };
    await new Promise(resolve => {
      const timeline = gsap.timeline({ onComplete: resolve });
      timeline.to(proxy, { t: islandT[to - 1], duration: 1.6, ease: 'power1.inOut', onUpdate: () => {
        const point = curve.getPointAt(proxy.t);
        mascot.position.set(point.x, Math.abs(Math.sin(proxy.t * 90)) * .45, point.z);
        lightRoad(proxy.t);
      } });
      timeline.to(controls.target, { x: target.x, z: target.z, duration: 1.6, ease: 'power1.inOut' }, 0);
      timeline.to(camera.position, { x: target.x + CAMERA_OFFSET.x, z: target.z + CAMERA_OFFSET.z, y: CAMERA_OFFSET.y - 2, duration: 1.6, ease: 'power1.inOut' }, 0);
    });
    await new Promise(resolve => {
      const timeline = gsap.timeline({ onComplete: resolve });
      timeline.to(chest.scale, { x: .4, y: .26, z: .4, duration: .12, yoyo: true, repeat: 3 });
      if (lid) timeline.to(lid.rotation, { x: -1.9, duration: .35, ease: 'back.out(3)' });
      timeline.add(() => {
        for (let i = 0; i < 10; i++) {
          const coin = instance('platformer/coin-gold');
          coin.scale.setScalar(.18);
          coin.position.copy(chest.position).setY(.4);
          scene.add(coin);
          const angle = i / 10 * Math.PI * 2;
          gsap.timeline({ onComplete: () => scene.remove(coin) })
            .to(coin.position, { x: chest.position.x + Math.cos(angle) * 1.4, z: chest.position.z + Math.sin(angle) * 1.4, duration: 1.1, ease: 'power1.out' }, 0)
            .to(coin.position, { y: 2.2, duration: .5, ease: 'power2.out' }, 0)
            .to(coin.position, { y: .1, duration: .6, ease: 'bounce.out' }, .5)
            .to(coin.rotation, { y: Math.PI * 6, duration: 1.1 }, 0)
            .to(coin.scale, { x: 0, y: 0, z: 0, duration: .3 }, 1.2);
        }
      });
      timeline.to(target.cloud.scale, { x: 0, y: 0, z: 0, duration: .6, ease: 'back.in(2)' }, '<');
      timeline.to(target.grey, { value: 0, duration: .9, ease: 'power2.out' }, '<.2');
      timeline.fromTo(target.group.scale, { x: .9, y: .7, z: .9 }, { x: 1, y: 1, z: 1, duration: 1, ease: 'elastic.out(1, .45)' }, '<');
      timeline.from(target.props.children.map(prop => prop.position), { y: -2.4, duration: .8, ease: 'back.out(1.6)', stagger: .12 }, '<.1');
    });
    applyLevel(to);
    startIdle();
  }

  // Hover lifts an island; a click (not a drag) selects it.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null, downAt = null;
  const pick = event => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const [hit] = raycaster.intersectObjects(islands.map(island => island.group), true);
    if (!hit) return null;
    let node = hit.object;
    while (node && !islands.some(island => island.group === node)) node = node.parent;
    return islands.find(island => island.group === node) ?? null;
  };
  const onMove = event => {
    const island = pick(event);
    if (island === hovered) return;
    if (hovered) gsap.to(hovered.group.position, { y: 0, duration: .25 });
    hovered = island;
    renderer.domElement.style.cursor = island ? 'pointer' : '';
    if (island && !reducedMotion) gsap.to(island.group.position, { y: .18, duration: .25, ease: 'back.out(2)' });
  };
  const onDown = event => { downAt = [event.clientX, event.clientY]; };
  const onUp = event => {
    if (!downAt || Math.hypot(event.clientX - downAt[0], event.clientY - downAt[1]) > 6) return;
    const island = pick(event);
    if (island) onSelect(island.level);
  };
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  let labelMap = labels;
  const projected = new THREE.Vector3();
  function placeLabels() {
    const width = renderer.domElement.clientWidth, height = renderer.domElement.clientHeight;
    for (const island of islands) {
      const label = labelMap.get(island.level);
      if (!label) continue;
      projected.set(island.x, 3.4 + island.group.position.y, island.z - island.radius * .4).project(camera);
      const visible = projected.z < 1;
      label.style.transform = `translate(-50%, -50%) translate(${(projected.x + 1) / 2 * width}px, ${(1 - projected.y) / 2 * height}px)`;
      label.style.visibility = visible ? 'visible' : 'hidden';
    }
  }

  const resize = () => {
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    // Narrow screens need more distance to keep the island and its neighbours in frame.
    camera.fov = width < 560 ? 40 : 32;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  let visible = true, clock = new THREE.Clock();
  const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  visibility.observe(container);
  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    const time = clock.getElapsedTime();
    if (!reducedMotion) water.userData.uniforms.uTime.value = time;
    controls.update();
    renderer.render(scene, camera);
    placeLabels();
  });

  applyLevel(level);
  if (camera.aspect < .9) focus(level, true); else overview(true);
  startIdle();

  return {
    element: renderer.domElement,
    attach(nextContainer, nextLabels, nextOnSelect = onSelect) {
      container = nextContainer;
      nextContainer.append(renderer.domElement);
      labelMap = nextLabels;
      onSelect = nextOnSelect;
      resizeObserver.disconnect();
      resizeObserver.observe(nextContainer);
      visibility.disconnect();
      visibility.observe(nextContainer);
      resize();
    },
    setLevel(levelNumber) { if (!celebrating && levelNumber !== current) applyLevel(levelNumber); },
    focus,
    overview,
    celebrate,
    destroy() {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      visibility.disconnect();
      idle.forEach(tween => tween.kill());
      truckTween?.kill();
      gsap.killTweensOf([controls.target, camera.position]);
      controls.dispose();
      renderer.domElement.remove();
      renderer.dispose();
    },
  };
}
