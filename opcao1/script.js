/* BRATECHS — /opcao1: interações */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  /* ---------- nav: vidro mais forte ao rolar + menu mobile ---------- */
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  function onScrollNav() { nav.classList.toggle('is-scrolled', window.scrollY > 40); }
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();
  toggle.addEventListener('click', function () {
    var open = links.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });
  links.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') { links.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
  });

  /* ---------- revelar ao rolar (com cascata) ---------- */
  var reveals = [].slice.call(document.querySelectorAll('.reveal'));
  reveals.forEach(function (el) {
    var sibs = [].filter.call(el.parentNode.children, function (c) { return c.classList.contains('reveal'); });
    el.style.setProperty('--d', Math.min(sibs.indexOf(el), 5) * 0.09 + 's');
  });
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- contadores ---------- */
  function countUp(el) {
    var target = +el.dataset.count, suffix = el.dataset.suffix || '';
    if (reduce) { el.textContent = target.toLocaleString('pt-BR') + suffix; return; }
    var t0 = null, dur = 1600;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e).toLocaleString('pt-BR') + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); co.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  } else { counters.forEach(countUp); }

  /* ---------- spotlight que segue o mouse nos cards ---------- */
  document.querySelectorAll('[data-spot]').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------- console: feed de eventos (demonstração) ---------- */
  var feed = document.getElementById('feed');
  var events = [
    ['block', 'BLOQUEADO', 'Ransomware em endpoint — Intercept X'],
    ['scan', 'ANALISADO', 'Anexo suspeito em e-mail — sandbox'],
    ['block', 'BLOQUEADO', 'Phishing direcionado ao financeiro'],
    ['alert', 'ALERTA', 'Login fora do padrão — ZTNA validou'],
    ['block', 'BLOQUEADO', 'Tráfego C2 detectado no firewall'],
    ['scan', 'VERIFICADO', 'Configuração de bucket em nuvem'],
    ['block', 'BLOQUEADO', 'Exploit em navegador — exploit guard'],
    ['scan', 'ANALISADO', 'Processo anômalo isolado — XDR'],
    ['alert', 'ALERTA', 'Tentativa de força bruta em VPN'],
    ['block', 'BLOQUEADO', 'Domínio malicioso — DNS protection']
  ];
  var i = 0;
  function pad(n) { return n < 10 ? '0' + n : n; }
  function push() {
    var ev = events[i++ % events.length], d = new Date();
    var li = document.createElement('li');
    li.innerHTML = '<time>' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '</time>' +
      '<span class="tag tag--' + ev[0] + '">' + ev[1] + '</span><span>' + ev[2] + '</span>';
    feed.insertBefore(li, feed.firstChild);
    while (feed.children.length > 7) feed.removeChild(feed.lastChild);
  }
  for (var k = 0; k < 5; k++) push();
  if (!reduce) setInterval(push, 2200);

  /* ---------- linha do "Como funciona" ---------- */
  var stepsEl = document.getElementById('steps');
  var fill = document.getElementById('stepsFill');
  var stepItems = [].slice.call(stepsEl.querySelectorAll('.step'));
  function onScrollSteps() {
    var r = stepsEl.getBoundingClientRect();
    var vh = window.innerHeight;
    var p = (vh * 0.75 - r.top) / (r.height + vh * 0.25);
    p = Math.max(0, Math.min(1, p));
    fill.style.setProperty('--p', p);
    var active = Math.round(p * (stepItems.length - 1) + 0.49);
    stepItems.forEach(function (s, idx) { s.classList.toggle('is-active', p > 0 && idx < active); });
  }
  window.addEventListener('scroll', onScrollSteps, { passive: true });
  window.addEventListener('resize', onScrollSteps);
  onScrollSteps();

  /* ---------- ecossistema: rede animada em canvas ---------- */
  var canvas = document.getElementById('ecoCanvas');
  var ctx = canvas.getContext('2d');
  var nodes = ['Endpoint', 'Firewall', 'E-mail', 'Nuvem', 'Identidade', 'XDR', 'MDR', 'PhishThreat'];
  var W, H, R, dpr, angle = 0, packets = [], visible = true;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height; R = Math.min(W, H) * 0.38;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function pos(idx) {
    var a = angle + idx / nodes.length * Math.PI * 2 - Math.PI / 2;
    var rr = R * (idx % 2 ? 0.86 : 1);
    return { x: W / 2 + Math.cos(a) * rr, y: H / 2 + Math.sin(a) * rr };
  }
  function spawn() {
    var a = Math.floor(Math.random() * nodes.length), b;
    var toCenter = Math.random() < 0.5;
    b = toCenter ? -1 : (a + 1 + Math.floor(Math.random() * (nodes.length - 1))) % nodes.length;
    packets.push({ a: a, b: b, t: 0, s: 0.006 + Math.random() * 0.008 });
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    var cx = W / 2, cy = H / 2;
    // anéis
    [1.18, 1, 0.62].forEach(function (k, j) {
      ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(201,207,255,' + (j === 1 ? 0.1 : 0.06) + ')';
      ctx.setLineDash(j === 1 ? [4, 8] : []); ctx.lineWidth = 1; ctx.stroke();
    });
    ctx.setLineDash([]);
    var P = nodes.map(function (_, idx) { return pos(idx); });
    // linhas centro -> nós e nó -> nó vizinho
    P.forEach(function (p, idx) {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = 'rgba(22,166,252,.16)'; ctx.stroke();
      var q = P[(idx + 1) % P.length];
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
      ctx.strokeStyle = 'rgba(201,207,255,.07)'; ctx.stroke();
    });
    // pacotes viajando
    packets.forEach(function (pk) {
      pk.t += pk.s;
      var A = P[pk.a], B = pk.b < 0 ? { x: cx, y: cy } : P[pk.b];
      var x = A.x + (B.x - A.x) * pk.t, y = A.y + (B.y - A.y) * pk.t;
      var g = ctx.createRadialGradient(x, y, 0, x, y, 10);
      g.addColorStop(0, 'rgba(63,249,165,.95)'); g.addColorStop(1, 'rgba(63,249,165,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#EFFFF8'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
    });
    packets = packets.filter(function (pk) { return pk.t < 1; });
    // nós
    var fs = Math.max(11, Math.min(13, W / 46));
    ctx.font = '500 ' + fs + 'px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    P.forEach(function (p, idx) {
      var label = nodes[idx], tw = ctx.measureText(label).width + 26, th = fs + 16;
      var x = p.x - tw / 2, y = p.y - th / 2, r = th / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + tw, y, x + tw, y + th, r); ctx.arcTo(x + tw, y + th, x, y + th, r);
      ctx.arcTo(x, y + th, x, y, r); ctx.arcTo(x, y, x + tw, y, r); ctx.closePath();
      ctx.fillStyle = 'rgba(10,17,64,.92)'; ctx.fill();
      ctx.strokeStyle = 'rgba(63,249,165,.45)'; ctx.stroke();
      ctx.fillStyle = '#DDE2FF'; ctx.fillText(label, p.x, p.y + 0.5);
    });
  }
  function loop() {
    if (visible) {
      if (!reduce) angle += 0.0012;
      if (!reduce && Math.random() < 0.06 && packets.length < 14) spawn();
      draw();
    }
    requestAnimationFrame(loop);
  }
  resize();
  window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(canvas);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  loop();
})();
