/* RADAR BRATECHS — página /newsletter
   Lê ../data/news.json (edições das 06h, 12h e 18h) e monta edição, radar e arquivo.
   Todo texto vindo dos feeds é escapado antes de ir para o HTML. */
(function () {
  'use strict';
  var DATA_URL = '../data/news.json';
  var SLOTS = ['06h', '12h', '18h'];
  var SEV_LABEL = { critica: 'Crítica', alta: 'Alta', media: 'Média' };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- segurança: escape + links só http(s) ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) {
    try { var x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : '#'; } catch (e) { return '#'; }
  }

  /* ---------------- datas ---------------- */
  var rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  function ago(iso) {
    var s = (new Date(iso) - Date.now()) / 1000, a = Math.abs(s);
    if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
    if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
    return rtf.format(Math.round(s / 86400), 'day');
  }
  function fmtDay(ymd) {
    var d = new Date(ymd + 'T12:00:00-03:00');
    var today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    var yest = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() - 864e5));
    var label = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' }).format(d);
    return ymd === today ? 'Hoje · ' + label : ymd === yest ? 'Ontem · ' + label : label;
  }
  function fmtTime(iso) {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
  }

  /* ---------------- contagem regressiva até a próxima edição (horário de Brasília, UTC-3) ---------------- */
  function nextSlot() {
    var now = Date.now(), spNow = new Date(now - 3 * 3600e3);
    var y = spNow.getUTCFullYear(), m = spNow.getUTCMonth(), d = spNow.getUTCDate();
    for (var k = 0; k < 2; k++) {
      for (var i = 0; i < 3; i++) {
        var t = Date.UTC(y, m, d + k, [6, 12, 18][i] + 3, 0, 0);
        if (t > now) return t;
      }
    }
  }
  function tick() {
    var ms = Math.max(0, nextSlot() - Date.now());
    var h = Math.floor(ms / 36e5), mi = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    $('countdown').textContent = [h, mi, s].map(function (n) { return (n < 10 ? '0' : '') + n; }).join(':');
  }
  tick(); setInterval(tick, 1000);

  /* ---------------- render: matérias da edição ---------------- */
  function storyHTML(it, i) {
    var initials = esc(it.source.name.replace(/[^A-Za-zÀ-ú ]/g, '').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase());
    var also = (it.alsoIn || []).length
      ? '<p class="also">Também repercutido por: ' + it.alsoIn.map(function (a) {
          return '<a href="' + esc(safeUrl(a.link)) + '" target="_blank" rel="noopener nofollow">' + esc(a.name) + '</a>';
        }).join(', ') + '</p>' : '';
    var lang = it.lang === 'en' ? '<span class="badge badge--lang" title="Matéria original em inglês">EN</span>' : '';
    return '<article class="story" id="n-' + esc(it.id) + '" style="--d:' + (i * 0.1) + 's" data-spot>' +
      '<span class="story__rank">0' + (i + 1) + '</span>' +
      '<div class="story__meta"><span class="badge badge--' + esc(it.severity) + '"><i class="sev sev--' + esc(it.severity) + '"></i>' + esc(SEV_LABEL[it.severity] || it.severity) + '</span>' +
      '<span class="badge">' + esc(it.category) + '</span>' + lang + '<span>' + esc(ago(it.publishedAt)) + '</span></div>' +
      '<h3><a href="' + esc(safeUrl(it.link)) + '" target="_blank" rel="noopener nofollow">' + esc(it.title) + '</a></h3>' +
      '<p class="story__summary">' + esc(it.summary) + '</p>' +
      '<p class="story__why"><b>Por que importa</b>' + esc(it.why) + '</p>' +
      '<div class="story__foot">' +
        '<span class="source"><span class="source__mark">' + initials + '</span><span>' + esc(it.source.name) + '<small>Fonte original</small></span></span>' +
        '<a class="read" href="' + esc(safeUrl(it.link)) + '" target="_blank" rel="noopener nofollow">Ler na fonte ↗</a>' +
        also +
      '</div></article>';
  }

  var DB = null, current = null;
  function showEdition(ed) {
    current = ed;
    $('edDate').textContent = fmtDay(ed.date);
    $('edTitle').textContent = 'Edição das ' + ed.slot.replace('h', 'h') + ' · ' + ed.items.length + ' destaques';
    $('stories').innerHTML = ed.items.map(storyHTML).join('');
    var sameDay = DB.editions.filter(function (e) { return e.date === ed.date; });
    $('slots').innerHTML = SLOTS.map(function (s) {
      var e = sameDay.find(function (x) { return x.slot === s; });
      return '<button type="button" ' + (e ? 'data-id="' + esc(e.id) + '"' : 'disabled') + ' aria-pressed="' + (e && e.id === ed.id) + '">' + s + '</button>';
    }).join('');
    bindSpot();
    setRadar(ed.items);
  }
  $('slots').addEventListener('click', function (e) {
    var id = e.target.getAttribute && e.target.getAttribute('data-id');
    if (!id) return;
    var ed = DB.editions.find(function (x) { return x.id === id; });
    if (ed) showEdition(ed);
  });

  function bindSpot() {
    [].forEach.call(document.querySelectorAll('[data-spot]'), function (el) {
      el.addEventListener('pointermove', function (ev) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
        el.style.setProperty('--my', (ev.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------------- arquivo com busca e filtros ---------------- */
  var activeCat = 'Todas';
  function normTxt(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function renderArchive() {
    var q = normTxt($('q').value.trim());
    var byDay = {}, total = 0;
    DB.editions.forEach(function (ed) {
      ed.items.forEach(function (it) {
        if (activeCat !== 'Todas' && it.category !== activeCat) return;
        if (q && normTxt([it.title, it.originalTitle, it.summary, it.source.name, it.category].join(' ')).indexOf(q) < 0) return;
        (byDay[ed.date] = byDay[ed.date] || []).push({ ed: ed, it: it });
        total++;
      });
    });
    $('timeline').innerHTML = Object.keys(byDay).sort().reverse().map(function (day) {
      return '<li class="day"><p class="day__label">' + esc(fmtDay(day)) + '</p>' + byDay[day].map(function (x) {
        return '<a class="row" href="?n=' + encodeURIComponent(x.it.id) + '#n-' + esc(x.it.id) + '" data-ed="' + esc(x.ed.id) + '" data-n="' + esc(x.it.id) + '">' +
          '<span class="row__slot">' + esc(x.ed.slot) + '</span>' +
          '<span class="row__title">' + esc(x.it.title) + '<small>' + esc(x.it.source.name) + ' · ' + esc(x.it.category) + '</small></span>' +
          '<i class="sev sev--' + esc(x.it.severity) + '" title="' + esc(SEV_LABEL[x.it.severity]) + '"></i></a>';
      }).join('') + '</li>';
    }).join('');
    $('empty').hidden = total > 0;
  }
  $('q').addEventListener('input', renderArchive);
  $('chips').addEventListener('click', function (e) {
    var c = e.target.getAttribute && e.target.getAttribute('data-cat');
    if (!c) return;
    activeCat = c;
    [].forEach.call($('chips').children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-cat') === c); });
    renderArchive();
  });
  $('timeline').addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.row');
    if (!a) return;
    e.preventDefault();
    focusItem(a.getAttribute('data-ed'), a.getAttribute('data-n'), true);
  });
  function focusItem(edId, nId, push) {
    var ed = DB.editions.find(function (x) { return x.id === edId; });
    if (!ed) return;
    showEdition(ed);
    if (push) history.replaceState(null, '', '?n=' + encodeURIComponent(nId));
    var el = document.getElementById('n-' + nId);
    if (el) { el.classList.add('is-target'); el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
  }

  /* ---------------- compartilhar ---------------- */
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-on'); });
    setTimeout(function () { t.classList.remove('is-on'); setTimeout(function () { t.remove(); }, 500); }, 2200);
  }
  $('shareBtn').addEventListener('click', function () {
    var data = { title: 'Radar Bratechs', text: 'As notícias de cibersegurança mais relevantes do dia', url: location.href };
    if (navigator.share) navigator.share(data).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { toast('Link copiado'); });
  });

  /* ---------------- radar (canvas) ---------------- */
  var cv = $('radar'), ctx = cv.getContext('2d'), blips = [], W = 0, angle = 0;
  var COLORS = { critica: '255,92,122', alta: '255,181,71', media: '22,166,252' };
  function sizeRadar() {
    var dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
    W = r.width; cv.width = W * dpr; cv.height = W * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function setRadar(items) {
    blips = items.map(function (it, i) {
      var ring = it.severity === 'critica' ? 0.32 : it.severity === 'alta' ? 0.55 : 0.78;
      return { a: (i / items.length) * Math.PI * 2 + 0.6, r: ring + (i % 2) * 0.06, c: COLORS[it.severity] || COLORS.media, glow: 0, main: true };
    });
    // pontos de edições anteriores, mais apagados
    (DB.editions.slice(1, 8)).forEach(function (ed, k) {
      ed.items.forEach(function (it, i) {
        blips.push({ a: (k * 1.7 + i * 2.1) % (Math.PI * 2), r: 0.25 + ((k * 13 + i * 7) % 60) / 100, c: COLORS[it.severity] || COLORS.media, glow: 0, main: false });
      });
    });
  }
  function drawRadar() {
    var c = W / 2, R = W * 0.46;
    ctx.clearRect(0, 0, W, W);
    ctx.strokeStyle = 'rgba(201,207,255,.10)'; ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(function (k) { ctx.beginPath(); ctx.arc(c, c, R * k, 0, Math.PI * 2); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(c - R, c); ctx.lineTo(c + R, c); ctx.moveTo(c, c - R); ctx.lineTo(c, c + R); ctx.stroke();
    // feixe de varredura
    var g = ctx.createConicGradient ? ctx.createConicGradient(angle - 0.9, c, c) : null;
    if (g) {
      g.addColorStop(0, 'rgba(63,249,165,0)'); g.addColorStop(0.14, 'rgba(63,249,165,.28)'); g.addColorStop(0.145, 'rgba(63,249,165,0)'); g.addColorStop(1, 'rgba(63,249,165,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(63,249,165,.8)'; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(angle) * R, c + Math.sin(angle) * R); ctx.stroke();
    // blips: acendem quando o feixe passa
    blips.forEach(function (b) {
      var d = ((angle - b.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (d < 0.08) b.glow = 1;
      b.glow *= 0.985;
      var x = c + Math.cos(b.a) * R * b.r, y = c + Math.sin(b.a) * R * b.r;
      var base = b.main ? 0.55 : 0.12, alpha = Math.min(1, base + b.glow * (b.main ? 0.45 : 0.5));
      var size = b.main ? 5 : 2.4;
      var gr = ctx.createRadialGradient(x, y, 0, x, y, size * 5);
      gr.addColorStop(0, 'rgba(' + b.c + ',' + alpha * 0.6 + ')'); gr.addColorStop(1, 'rgba(' + b.c + ',0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, size * 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(' + b.c + ',' + alpha + ')'; ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
      if (b.main) { ctx.strokeStyle = 'rgba(' + b.c + ',' + (0.25 + b.glow * 0.5) + ')'; ctx.beginPath(); ctx.arc(x, y, size + 6 + (1 - b.glow) * 10, 0, Math.PI * 2); ctx.stroke(); }
    });
    // núcleo
    ctx.fillStyle = 'rgba(63,249,165,.9)'; ctx.beginPath(); ctx.arc(c, c, 3, 0, Math.PI * 2); ctx.fill();
  }
  function loop() { if (!reduce) angle += 0.012; drawRadar(); requestAnimationFrame(loop); }

  /* ---------------- carga ---------------- */
  fetch(DATA_URL, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (db) {
    DB = db;
    if (!db.editions || !db.editions.length) throw new Error('sem edições');
    var last = db.editions[0];
    $('lastScan').textContent = last.date.split('-').reverse().slice(0, 2).join('/') + ' · ' + last.slot;
    $('srcCount').textContent = (db.sources || []).length;
    $('edCount').textContent = db.editions.length;
    $('sourceList').innerHTML = (db.sources || []).map(function (s) { return '<li>' + esc(s.name) + '<small>' + esc(s.lang) + '</small></li>'; }).join('');
    var cats = ['Todas'];
    db.editions.forEach(function (e) { e.items.forEach(function (it) { if (cats.indexOf(it.category) < 0) cats.push(it.category); }); });
    $('chips').innerHTML = cats.map(function (c) { return '<button type="button" data-cat="' + esc(c) + '" aria-pressed="' + (c === 'Todas') + '">' + esc(c) + '</button>'; }).join('');
    sizeRadar();
    var n = new URLSearchParams(location.search).get('n');
    var target = n && db.editions.find(function (e) { return e.items.some(function (it) { return it.id === n; }); });
    if (target) focusItem(target.id, n, false); else showEdition(db.editions[0]);
    renderArchive();
    loop();
  }).catch(function () {
    $('edTitle').textContent = 'Não foi possível carregar as notícias agora.';
    $('stories').innerHTML = '<p class="empty">Tente novamente em alguns minutos.</p>';
  });
  addEventListener('resize', function () { if (DB) sizeRadar(); });
})();
