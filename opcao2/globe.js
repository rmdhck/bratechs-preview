/* BRATECHS — /opcao2 · globo WebGL (Three.js + shaders GLSL)
   Ataques saem de cidades do mundo, viajam em arco e são bloqueados em São Paulo. */
import * as THREE from 'three';

const canvas = document.getElementById('globe');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const D = Math.PI / 180;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 0, 4.2);

const stage = new THREE.Group();   // posição na tela + parallax do mouse
const globe = new THREE.Group();   // rotação do planeta
stage.add(globe);
scene.add(stage);

/* ---------- utilitário lat/lon -> vetor ---------- */
function ll(lat, lon, r = 1) {
  const phi = (90 - lat) * D, theta = (lon + 180) * D;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

/* ---------- núcleo escuro (dá corpo ao planeta) ---------- */
globe.add(new THREE.Mesh(
  new THREE.SphereGeometry(0.985, 64, 64),
  new THREE.MeshBasicMaterial({ color: 0x040a2a })   // opaco: desenhado antes dos pontos
));

/* ---------- pontos (esfera de Fibonacci) com shader ---------- */
const N = 12000;
const pos = new Float32Array(N * 3), rnd = new Float32Array(N);
const golden = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
  pos[i * 3] = Math.cos(th) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(th) * r;
  rnd[i] = Math.random();
}
const dotsGeo = new THREE.BufferGeometry();
dotsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
dotsGeo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
const dotsMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uPix: { value: renderer.getPixelRatio() } },
  vertexShader: /* glsl */`
    uniform float uPix; attribute float aRand;
    varying float vAlpha; varying float vRand;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * position);
      float facing = dot(n, normalize(-mv.xyz));
      vAlpha = smoothstep(-0.15, 0.55, facing);
      vRand = aRand;
      gl_PointSize = uPix * (2.0 + aRand * 1.8) * (3.2 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform float uTime; varying float vAlpha; varying float vRand;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float tw = 0.55 + 0.45 * sin(uTime * 1.6 + vRand * 60.0);
      vec3 col = mix(vec3(0.086, 0.65, 0.99), vec3(0.247, 0.976, 0.647), pow(vRand, 3.0));
      gl_FragColor = vec4(col, vAlpha * (0.3 + 0.6 * tw) * (1.0 - smoothstep(0.05, 0.5, d)));
    }`
});
globe.add(new THREE.Points(dotsGeo, dotsMat));

/* ---------- atmosfera (fresnel) ---------- */
const atmo = new THREE.Mesh(
  new THREE.SphereGeometry(1.14, 64, 64),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    /* face de trás: brilha junto à borda do planeta e some para fora */
    fragmentShader: `varying vec3 vN; void main(){ float i = pow(clamp(-dot(vN, vec3(0.0,0.0,1.0)), 0.0, 1.0), 1.7);
      vec3 c = mix(vec3(0.137,0.204,0.698), vec3(0.086,0.65,0.99), i); gl_FragColor = vec4(c, i * 0.95); }`
  })
);
stage.add(atmo);

/* ---------- órbitas com "satélites" ---------- */
const orbits = [];
[[1.45, 0.35, 0.2], [1.7, -0.5, -0.6]].forEach(([r, tx, tz], k) => {
  const pts = new THREE.EllipseCurve(0, 0, r, r).getPoints(160).map(p => new THREE.Vector3(p.x, 0, p.y));
  const o = new THREE.Group();
  o.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x16a6fc, transparent: true, opacity: 0.18 })));
  const sat = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), new THREE.MeshBasicMaterial({ color: k ? 0x3ff9a5 : 0x16a6fc }));
  o.add(sat);
  o.rotation.set(tx, 0, tz);
  stage.add(o);
  orbits.push({ sat, r, speed: k ? -0.25 : 0.38, a: Math.random() * 6 });
});

/* ---------- São Paulo: farol + escudo ---------- */
const SP = ll(-23.56, -46.65, 1.0);
const beacon = new THREE.Group();
beacon.position.copy(SP);
beacon.lookAt(SP.clone().multiplyScalar(2));
globe.add(beacon);
const coreDot = new THREE.Mesh(new THREE.CircleGeometry(0.022, 32), new THREE.MeshBasicMaterial({ color: 0x3ff9a5 }));
beacon.add(coreDot);
const halo = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.056, 64),
  new THREE.MeshBasicMaterial({ color: 0x3ff9a5, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
beacon.add(halo);
const shield = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0x3ff9a5, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
beacon.add(shield);

/* ---------- ataques (arcos com rastro de cometa) ---------- */
const ORIGINS = [
  [50.11, 8.68], [55.75, 37.62], [39.9, 116.4], [6.52, 3.38], [39.04, -77.49], [37.57, 126.98],
  [52.37, 4.9], [19.08, 72.88], [50.45, 30.52], [1.35, 103.82], [59.93, 30.36], [22.32, 114.17],
  [40.71, -74.0], [-33.87, 151.21], [35.68, 139.69], [25.2, 55.27], [-34.6, -58.38], [19.43, -99.13]
];
const arcMat = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uP: { value: 0 }, uFade: { value: 1 }, uCol: { value: new THREE.Color(Math.random() < .5 ? 0x16a6fc : 0xff6b8a) } },
  vertexShader: `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform float uP; uniform float uFade; uniform vec3 uCol; varying float vT;
    void main(){ if (vT > uP) discard; float tail = smoothstep(uP - 0.45, uP, vT);
      vec3 c = mix(uCol, vec3(1.0), smoothstep(uP - 0.04, uP, vT) * 0.8);
      gl_FragColor = vec4(c, tail * uFade); }`
});
const arcs = [], blasts = [];
function spawnArc() {
  const [lat, lon] = ORIGINS[(Math.random() * ORIGINS.length) | 0];
  const a = ll(lat, lon, 1.0), b = SP.clone();
  const h = 1 + a.distanceTo(b) * 0.42;
  const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(h);
  const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(90);
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  geo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(pts.map((_, i) => i / (pts.length - 1))), 1));
  const line = new THREE.Line(geo, arcMat());
  globe.add(line);
  const origin = new THREE.Mesh(new THREE.CircleGeometry(0.012, 16), new THREE.MeshBasicMaterial({ color: 0xff6b8a, transparent: true }));
  origin.position.copy(a); origin.lookAt(a.clone().multiplyScalar(2)); globe.add(origin);
  arcs.push({ line, origin, p: 0, speed: 0.28 + Math.random() * 0.2, hit: false });
}
function blast() {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.04, 64),
    new THREE.MeshBasicMaterial({ color: 0x3ff9a5, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }));
  beacon.add(ring);
  blasts.push({ ring, t: 0 });
  shield.material.opacity = 0.35;
  dispatchEvent(new CustomEvent('bt:intercept'));
}

/* ---------- layout responsivo ---------- */
let W = 1, H = 1, baseRotY = 0, baseRotX = 0;
function layout() {
  W = canvas.clientWidth; H = canvas.clientHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  const wide = W / H > 1.1;
  stage.position.set(wide ? 1.05 : 0, wide ? -0.05 : 0.62, 0);
  stage.scale.setScalar(wide ? 1.12 : 0.82);
}
/* gira o planeta para São Paulo ficar de frente para a câmera */
baseRotY = -Math.atan2(SP.x, SP.z);
const spAfterY = SP.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), baseRotY);
baseRotX = Math.atan2(spAfterY.y, spAfterY.z) * 0.75;
globe.rotation.set(baseRotX, baseRotY, 0);

/* ---------- mouse: parallax suave ---------- */
let mx = 0, my = 0;
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });

/* ---------- loop ---------- */
let visible = true, last = performance.now(), t = 0, nextSpawn = 0;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (visible) {
    t += dt;
    dotsMat.uniforms.uTime.value = t;
    globe.rotation.y = baseRotY + Math.sin(t * 0.12) * 0.55;
    stage.rotation.x += ((my * 0.25) - stage.rotation.x) * 0.04;
    stage.rotation.y += ((mx * 0.35) - stage.rotation.y) * 0.04;

    orbits.forEach(o => { o.a += dt * o.speed; o.sat.position.set(Math.cos(o.a) * o.r, 0, Math.sin(o.a) * o.r); });

    if (t > nextSpawn && arcs.length < 14) { spawnArc(); nextSpawn = t + 0.45 + Math.random() * 0.5; }
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i];
      /* cabeça do cometa = p * 1.45: chega ao alvo em 1.0 e o rastro termina de entrar em 1.45 */
      a.p += dt * a.speed;
      const head = a.p * 1.45;
      if (!a.hit && head >= 1) { a.hit = true; blast(); }
      a.origin.material.opacity = Math.max(1 - a.p, 0);
      if (a.p >= 1) {
        globe.remove(a.line, a.origin);
        a.line.geometry.dispose(); a.line.material.dispose(); a.origin.geometry.dispose(); a.origin.material.dispose();
        arcs.splice(i, 1); continue;
      }
      a.line.material.uniforms.uP.value = head;
    }
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i]; b.t += dt;
      b.ring.scale.setScalar(1 + b.t * 9);
      b.ring.material.opacity = Math.max(1 - b.t * 1.4, 0);
      if (b.t > 0.75) { beacon.remove(b.ring); b.ring.geometry.dispose(); b.ring.material.dispose(); blasts.splice(i, 1); }
    }
    shield.material.opacity *= 0.93;
    halo.scale.setScalar(1 + Math.sin(t * 3) * 0.25);
    renderer.render(scene, camera);
  }
  if (!reduce) requestAnimationFrame(frame);
}

layout();
addEventListener('resize', layout);
if (reduce) {
  for (let k = 0; k < 8; k++) { spawnArc(); arcs[k].p = 0.25 + k * 0.05; arcs[k].line.material.uniforms.uP.value = arcs[k].p * 1.45; }
  frame(performance.now()); renderer.render(scene, camera);
} else {
  requestAnimationFrame(frame);
}
