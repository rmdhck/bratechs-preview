/* BRATECHS — /opcao3 · Partículas + Shader
   - Aurora em GLSL (fbm + domain warping) reagindo ao mouse
   - Partículas na GPU que mudam de forma por seção (escudo, esfera, cadeado, "24/7", onda)
   - Coreografia com Lenis + GSAP ScrollTrigger */
import * as THREE from 'three';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGSAP = !!(window.gsap && window.ScrollTrigger);
const mobile = matchMedia('(max-width: 720px)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* =====================================================================
   1. TEXTO: quebra em palavras (hero) e manifesto palavra a palavra
   ===================================================================== */
function splitWords(el) {
  const out = [];
  [...el.childNodes].forEach(node => {
    const isEm = node.nodeName === 'EM';
    const text = node.textContent;
    const frag = document.createDocumentFragment();
    text.split(/(\s+)/).forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
      const w = document.createElement('span'); w.className = 'w';
      const inner = document.createElement(isEm ? 'em' : 'span'); inner.textContent = part;
      if (isEm) inner.style.display = 'inline-block';
      w.appendChild(inner); frag.appendChild(w); out.push(inner);
    });
    el.replaceChild(frag, node);
  });
  return out;
}
const heroWords = splitWords($('[data-words]'));
const mText = $('#manifestoText');
mText.innerHTML = mText.textContent.trim().split(/\s+/).map(w => `<span class="mw">${w}</span>`).join(' ');

/* =====================================================================
   2. WEBGL
   ===================================================================== */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.autoClear = false;

/* ---------- 2a. aurora (quad de tela cheia) ---------- */
const bgScene = new THREE.Scene();
const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const bgUniforms = {
  uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
  uMouse: { value: new THREE.Vector2(0, 0) }, uDim: { value: 0 }, uHue: { value: 0 }
};
bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: bgUniforms, depthWrite: false,
  vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform float uTime, uDim, uHue; uniform vec2 uRes, uMouse;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
      for (int i = 0; i < 5; i++){ v += a * noise(p); p = r * p * 2.02; a *= 0.5; } return v; }
    void main(){
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
      float t = uTime * 0.04;
      vec2 q = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 + vec2(5.2, 1.3) - t));
      vec2 r = vec2(fbm(p * 1.4 + 3.5 * q + vec2(1.7, 9.2) + 0.6 * t), fbm(p * 1.4 + 3.5 * q + vec2(8.3, 2.8) - 0.5 * t));
      float f = fbm(p * 1.4 + 3.0 * r + uMouse * 0.35);
      vec3 base  = vec3(0.012, 0.02, 0.06);
      vec3 blue  = vec3(0.137, 0.204, 0.698);
      vec3 cyan  = vec3(0.086, 0.65, 0.99);
      vec3 green = vec3(0.247, 0.976, 0.647);
      vec3 col = mix(base, blue, smoothstep(0.25, 0.95, f));
      col = mix(col, cyan, smoothstep(0.55, 1.1, length(q)) * 0.45);
      col = mix(col, mix(green, cyan, uHue), smoothstep(0.62, 1.0, r.y) * 0.32);
      float m = 1.0 - smoothstep(0.0, 0.55, distance(p, uMouse));
      col += cyan * m * 0.10;
      float vig = 1.0 - smoothstep(0.35, 1.05, length(uv - 0.5) * 1.25);
      col *= mix(0.95, 0.42, uDim) * vig;
      col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.018;   // grão
      gl_FragColor = vec4(col, 1.0);
    }`
})));

/* ---------- 2b. partículas ---------- */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.z = 5.2;
const N = mobile ? 7000 : 12000;

/* amostra pixels de um desenho em canvas -> pontos 2D centrados */
function sampleCanvas(draw, w, h, test, height = 2.5) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  draw(g, w, h);
  const d = g.getImageData(0, 0, w, h).data, pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (test(d[i], d[i + 1], d[i + 2], d[i + 3])) pts.push([x, y]);
  }
  const s = height / h;
  return pts.map(([x, y]) => [(x - w / 2) * s, -(y - h / 2) * s]);
}
function fill(pool2d, depth = 0.12) {
  const a = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const p = pool2d[(Math.random() * pool2d.length) | 0] || [0, 0];
    a[i * 3] = p[0] + (Math.random() - 0.5) * 0.015;
    a[i * 3 + 1] = p[1] + (Math.random() - 0.5) * 0.015;
    a[i * 3 + 2] = (Math.random() - 0.5) * depth;
  }
  return a;
}
const SHAPES = {};
function buildShapes(shieldImg) {
  /* escudo: pixels coloridos do logo (as linhas brancas do circuito viram "vazios") */
  SHAPES.shield = fill(sampleCanvas((g, w, h) => g.drawImage(shieldImg, 0, 0, w, h), 150, 150,
    (r, gg, b, a) => a > 120 && !(r > 200 && gg > 200 && b > 200), 2.7), 0.18);
  /* esfera (fibonacci) */
  const sph = new Float32Array(N * 3), gold = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = gold * i, R = 1.3;
    sph[i * 3] = Math.cos(th) * r * R; sph[i * 3 + 1] = y * R; sph[i * 3 + 2] = Math.sin(th) * r * R;
  }
  SHAPES.sphere = sph;
  /* cadeado */
  SHAPES.lock = fill(sampleCanvas((g, w, h) => {
    g.fillStyle = '#fff'; g.strokeStyle = '#fff';
    g.lineWidth = w * 0.09; g.beginPath(); g.arc(w / 2, h * 0.42, w * 0.22, Math.PI, 0); g.lineTo(w / 2 + w * 0.22, h * 0.5);
    g.moveTo(w / 2 - w * 0.22, h * 0.42); g.lineTo(w / 2 - w * 0.22, h * 0.5); g.stroke();
    g.beginPath(); g.roundRect(w * 0.18, h * 0.48, w * 0.64, h * 0.44, w * 0.06); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(w / 2, h * 0.65, w * 0.06, 0, Math.PI * 2); g.fill(); g.fillRect(w / 2 - w * 0.025, h * 0.66, w * 0.05, h * 0.14);
  }, 140, 160, (r, gg, b, a) => a > 128, 2.6), 0.3);
  /* "24/7" */
  SHAPES.text = fill(sampleCanvas((g, w, h) => {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `600 ${h * 0.82}px "Inter Tight", Arial, sans-serif`; g.fillText('24/7', w / 2, h * 0.54);
  }, 360, 140, (r, gg, b, a) => a > 128, 1.7), 0.2);
  /* onda (malha) */
  const wav = new Float32Array(N * 3), cols = Math.ceil(Math.sqrt(N * 2.2)), rows = Math.ceil(N / cols);
  for (let i = 0; i < N; i++) {
    const cx = i % cols, cy = (i / cols) | 0;
    wav[i * 3] = (cx / cols - 0.5) * 6.4; wav[i * 3 + 1] = -0.9; wav[i * 3 + 2] = (cy / rows - 0.5) * 3.2;
  }
  SHAPES.wave = wav;
  /* nuvem dispersa (entrada e seção do vídeo) */
  const sc = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { sc[i * 3] = (Math.random() - 0.5) * 9; sc[i * 3 + 1] = (Math.random() - 0.5) * 6; sc[i * 3 + 2] = (Math.random() - 0.5) * 4; }
  SHAPES.none = sc;
}

const geo = new THREE.BufferGeometry();
const aFrom = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
const aTo = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
const rnd = new Float32Array(N); for (let i = 0; i < N; i++) rnd[i] = Math.random();
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); // exigido pelo three
geo.setAttribute('aFrom', aFrom); geo.setAttribute('aTo', aTo);
geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));

const pUniforms = {
  uTime: { value: 0 }, uMorph: { value: 1 }, uWave: { value: 0 }, uAlpha: { value: 0.9 },
  uSize: { value: mobile ? 2.4 : 2.1 }, uPix: { value: renderer.getPixelRatio() }, uMouse: { value: new THREE.Vector3(99, 99, 0) }
};
const points = new THREE.Points(geo, new THREE.ShaderMaterial({
  uniforms: pUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    uniform float uTime, uMorph, uWave, uSize, uPix; uniform vec3 uMouse;
    attribute vec3 aFrom; attribute vec3 aTo; attribute float aRnd;
    varying float vRnd; varying float vY;
    void main(){
      float m = smoothstep(0.0, 1.0, clamp(uMorph * 1.5 - aRnd * 0.5, 0.0, 1.0));   // transição em cascata
      vec3 p = mix(aFrom, aTo, m);
      float k = sin(m * 3.14159);
      p += k * vec3(sin(aRnd * 40.0 + uTime), cos(aRnd * 31.0 + uTime * 1.3), sin(aRnd * 17.0)) * 0.55;  // redemoinho
      p += 0.018 * vec3(sin(uTime * 0.8 + aRnd * 50.0), cos(uTime * 0.7 + aRnd * 80.0), sin(uTime * 0.6 + aRnd * 30.0));
      p.y += uWave * sin(p.x * 1.6 + uTime * 1.2) * cos(p.z * 1.8 + uTime * 0.9) * 0.35;
      vec4 world = modelMatrix * vec4(p, 1.0);
      vec2 d = world.xy - uMouse.xy;                                    // repulsão do mouse
      float f = 1.0 - smoothstep(0.0, 0.85, length(d));
      world.xy += normalize(d + 1e-4) * f * 0.5;
      vec4 mv = viewMatrix * world;
      gl_PointSize = uSize * uPix * (0.55 + aRnd) * (5.2 / -mv.z);
      gl_Position = projectionMatrix * mv;
      vRnd = aRnd; vY = p.y;
    }`,
  fragmentShader: /* glsl */`
    uniform float uAlpha; varying float vRnd; varying float vY;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      vec3 c = mix(vec3(0.086, 0.65, 0.99), vec3(0.247, 0.976, 0.647), clamp(vY * 0.32 + 0.5 + (vRnd - 0.5) * 0.35, 0.0, 1.0));
      c = mix(c, vec3(1.0), step(0.965, vRnd) * 0.75);                  // alguns pontos brancos "faísca"
      gl_FragColor = vec4(c, uAlpha * (1.0 - smoothstep(0.0, 0.5, d)));
    }`
}));
const group = new THREE.Group();
group.add(points);
scene.add(group);

/* ---------- morph ---------- */
let current = null, morphTween = null;
function currentPositions() {
  const f = aFrom.array, t = aTo.array, out = new Float32Array(N * 3), u = pUniforms.uMorph.value;
  for (let i = 0; i < N; i++) {
    let m = Math.min(Math.max(u * 1.5 - rnd[i] * 0.5, 0), 1); m = m * m * (3 - 2 * m);
    for (let k = 0; k < 3; k++) out[i * 3 + k] = f[i * 3 + k] + (t[i * 3 + k] - f[i * 3 + k]) * m;
  }
  return out;
}
function morphTo(name, dur = 2.0) {
  if (!SHAPES[name] || name === current) return;
  current = name;
  aFrom.array.set(currentPositions()); aTo.array.set(SHAPES[name]);
  aFrom.needsUpdate = aTo.needsUpdate = true;
  if (morphTween) morphTween.kill();
  pUniforms.uMorph.value = 0;
  if (reduce || !hasGSAP) { pUniforms.uMorph.value = 1; return; }
  morphTween = gsap.to(pUniforms.uMorph, { value: 1, duration: dur, ease: 'power3.inOut' });
  gsap.to(pUniforms.uWave, { value: name === 'wave' ? 1 : 0, duration: 1.5 });
}

/* ---------- layout ---------- */
let W = 1, H = 1, side = 'right';
const stageTarget = { x: 0, y: 0, s: 1 };
function placeStage(s) {
  side = s;
  const wide = W / H > 1.15;
  const visW = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  if (s === 'right' && wide) Object.assign(stageTarget, { x: visW * 0.24, y: 0.15, s: 1 });
  else if (s === 'right') Object.assign(stageTarget, { x: 0, y: 1.12, s: 0.48 });
  else Object.assign(stageTarget, { x: 0, y: 0, s: wide ? 1 : 0.68 });
  if (hasGSAP && !reduce) gsap.to(group.position, { x: stageTarget.x, y: stageTarget.y, duration: 1.8, ease: 'power3.inOut' }),
    gsap.to(group.scale, { x: stageTarget.s, y: stageTarget.s, z: stageTarget.s, duration: 1.8, ease: 'power3.inOut' });
  else { group.position.set(stageTarget.x, stageTarget.y, 0); group.scale.setScalar(stageTarget.s); }
}
function resize() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  bgUniforms.uRes.value.set(W * renderer.getPixelRatio(), H * renderer.getPixelRatio());
  placeStage(side);
}

/* ---------- mouse (posição no plano z=0) ---------- */
const mouseNdc = new THREE.Vector2(9, 9), tmp = new THREE.Vector3();
let mxs = 0, mys = 0, mx = 0, my = 0;
addEventListener('pointermove', e => {
  mouseNdc.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1);
  mx = e.clientX / W - 0.5; my = e.clientY / H - 0.5;
});
function mouseWorld() {
  tmp.set(mouseNdc.x, mouseNdc.y, 0.5).unproject(camera).sub(camera.position).normalize();
  const t = -camera.position.z / tmp.z;
  return camera.position.clone().add(tmp.multiplyScalar(t));
}

/* ---------- loop ---------- */
let t = 0, last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (!reduce) t += dt;
  mxs += (mx - mxs) * 0.05; mys += (my - mys) * 0.05;
  bgUniforms.uTime.value = t; pUniforms.uTime.value = t;
  bgUniforms.uMouse.value.set(mxs * 1.6, -mys * 1.0);
  pUniforms.uMouse.value.copy(mouseWorld());
  const spin = current === 'sphere' ? t * 0.25 : Math.sin(t * 0.3) * 0.28;
  group.rotation.y = spin + mxs * 0.5;
  group.rotation.x = (current === 'wave' ? 0.35 : 0) + mys * 0.3;
  renderer.clear();
  renderer.render(bgScene, bgCam);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* =====================================================================
   3. COREOGRAFIA (Lenis + GSAP)
   ===================================================================== */
let lenis = null;
function setupScroll() {
  if (!hasGSAP) return;
  gsap.registerPlugin(ScrollTrigger);

  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.085 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault(); lenis.scrollTo(a.getAttribute('href') === '#topo' ? 0 : a.getAttribute('href'), { duration: 1.8 });
    }));
  }

  /* cada seção define a forma das partículas, o lado e o escurecimento da aurora */
  $$('[data-shape]').forEach(sec => {
    const apply = () => {
      const shape = sec.dataset.shape;
      if (shape === 'none') gsap.to(pUniforms.uAlpha, { value: 0, duration: 0.8 });
      else { gsap.to(pUniforms.uAlpha, { value: sec.dataset.dim ? 0.55 : 0.9, duration: 1.2 }); morphTo(shape); }
      placeStage(sec.dataset.side || 'center');
      gsap.to(bgUniforms.uDim, { value: sec.dataset.dim ? 1 : 0, duration: 1.4 });
      gsap.to(bgUniforms.uHue, { value: shape === 'lock' || shape === 'text' ? 1 : 0, duration: 2 });
    };
    ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onEnter: apply, onEnterBack: apply });
  });

  if (reduce) return;

  /* hero: palavras sobem */
  gsap.from(heroWords, { yPercent: 115, duration: 1.5, ease: 'expo.out', stagger: 0.06, delay: 0.3 });
  gsap.from('.hero .eyebrow, .hero__foot', { opacity: 0, y: 30, duration: 1.4, ease: 'expo.out', stagger: 0.1, delay: 0.7 });

  /* manifesto: palavras acendem com a rolagem */
  gsap.to('#manifestoText .mw', { opacity: 1, ease: 'none', stagger: 0.1,
    scrollTrigger: { trigger: '#manifestoText', start: 'top 80%', end: 'bottom 45%', scrub: true } });

  /* cards: entram em cascata */
  gsap.from('.tcard', { opacity: 0, y: 80, rotateX: -12, duration: 1.4, ease: 'expo.out', stagger: 0.08,
    scrollTrigger: { trigger: '.cards', start: 'top 80%' } });

  /* vídeo dentro do "24/7" */
  const tl = gsap.timeline({ scrollTrigger: { trigger: '.reveal24', start: 'top top', end: 'bottom bottom', scrub: 1 } });
  tl.fromTo('#mask24', { scale: 1 }, { scale: 5.5, ease: 'power2.in', duration: 1 })
    .to('#mask24', { opacity: 0, ease: 'none', duration: 0.35 }, 0.62)
    .to('.reveal24__sticky', { '--shade': 1, duration: 0.3 }, 0.75)
    .to('#cap24', { opacity: 1, y: 0, duration: 0.3 }, 0.8);
  gsap.set('#cap24', { y: 40 });

  /* método: cada card encolhe quando o próximo cobre */
  const items = $$('.stackc li');
  items.forEach((li, i) => {
    if (i === items.length - 1) return;
    gsap.to(li, { scale: 0.95 - (items.length - i) * 0.006, filter: 'brightness(.78)', ease: 'none',
      scrollTrigger: { trigger: items[i + 1], start: 'top 70%', end: 'top ' + (110 + (i + 1) * 22) + 'px', scrub: true } });
  });

  /* contato */
  gsap.from('.contact__title, .contact__ctas, .contact__info', { opacity: 0, y: 60, duration: 1.4, ease: 'expo.out', stagger: 0.1,
    scrollTrigger: { trigger: '.contact', start: 'top 60%' } });

  addEventListener('load', () => ScrollTrigger.refresh());
}

/* ---------- marquee guiado pela velocidade da rolagem ---------- */
function setupMarquee() {
  const track = $('#vtrack');
  track.innerHTML += track.innerHTML;
  let x = 0, skew = 0;
  const loop = () => {
    const v = lenis ? lenis.velocity : 0;
    const half = track.scrollWidth / 2;
    if (!reduce) x -= 0.6 + Math.abs(v) * 0.35;
    if (-x >= half) x += half;
    skew += ((Math.max(-14, Math.min(14, v * 0.6))) - skew) * 0.1;
    track.style.transform = `translate3d(${x}px,0,0) skewX(${-skew}deg)`;
    requestAnimationFrame(loop);
  };
  loop();
}

/* ---------- cards com inclinação 3D + brilho ---------- */
function setupTilt() {
  if (reduce || !matchMedia('(hover: hover)').matches) return;
  $$('[data-tilt]').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--rx', ((0.5 - py) * 10).toFixed(2) + 'deg');
      card.style.setProperty('--ry', ((px - 0.5) * 12).toFixed(2) + 'deg');
      card.style.setProperty('--gx', px * 100 + '%'); card.style.setProperty('--gy', py * 100 + '%');
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  });
}

/* ---------- botões magnéticos ---------- */
function setupMagnetic() {
  if (reduce || !hasGSAP || !matchMedia('(hover: hover)').matches) return;
  $$('[data-magnetic]').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.4, duration: 0.5, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, .4)' }));
  });
}

/* =====================================================================
   4. INÍCIO
   ===================================================================== */
const img = new Image();
img.src = '../assets/img/shield.png';
Promise.all([img.decode().catch(() => {}), document.fonts ? document.fonts.ready : null]).then(() => {
  buildShapes(img);
  aFrom.array.set(SHAPES.none); aTo.array.set(SHAPES.none);       // começa disperso…
  resize();
  addEventListener('resize', resize);
  requestAnimationFrame(frame);
  setupScroll();
  setupMarquee();
  setupTilt();
  setupMagnetic();
  morphTo('shield', 2.6);                                           // …e se monta no escudo
  placeStage('right');
});
