/* BRATECHS — /opcao2 · interface (boot, cursor, scramble, Lenis + GSAP ScrollTrigger) */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP = !!(window.gsap && window.ScrollTrigger);
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  /* ---------------- relógio (UTC-3) ---------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tickClock() {
    var d = new Date(Date.now() - 3 * 3600e3 + new Date().getTimezoneOffset() * 60e3);
    var t = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    $('#clock').textContent = t + ' UTC-3';
    $('#footClock').textContent = t;
  }
  tickClock(); setInterval(tickClock, 1000);

  /* ---------------- scramble (texto que "decodifica") ---------------- */
  var GLYPHS = '!<>-_\\/[]{}—=+*^?#01ABCDEF';
  function scramble(el, duration) {
    var final = el.dataset.final || el.textContent;
    el.dataset.final = final;
    if (reduce) { el.textContent = final; return; }
    var start = performance.now(), dur = duration || 900;
    function frame(now) {
      var p = Math.min((now - start) / dur, 1), out = '';
      for (var i = 0; i < final.length; i++) {
        var ch = final[i];
        if (ch === ' ' || ch === '\n' || i < p * final.length) out += ch;
        else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame); else el.textContent = final;
    }
    requestAnimationFrame(frame);
  }
  /* títulos com <br>: aplica nos nós de texto preservando a quebra */
  function scrambleBlock(el) {
    $$('*', el).length
      ? [].slice.call(el.childNodes).forEach(function (n) {
          if (n.nodeType === 3 && n.textContent.trim()) {
            var s = document.createElement('span'); s.textContent = n.textContent; el.replaceChild(s, n); scramble(s, 1100);
          }
        })
      : scramble(el, 1100);
  }
  $$('[data-scramble]').forEach(function (a) { a.addEventListener('mouseenter', function () { scramble(a, 500); }); });

  /* ---------------- ticker ---------------- */
  var origins = ['Frankfurt', 'Moscou', 'Pequim', 'Lagos', 'Ashburn', 'Seul', 'Amsterdã', 'Mumbai', 'Kiev', 'Singapura', 'São Petersburgo', 'Hong Kong'];
  var kinds = ['RANSOMWARE', 'PHISHING', 'BRUTE-FORCE', 'C2 BEACON', 'EXPLOIT', 'MALWARE', 'DDoS PROBE', 'CREDENTIAL STUFFING'];
  var tk = $('#ticker'), html = '';
  for (var i = 0; i < 24; i++) {
    html += '<span><b' + (i % 3 ? '' : ' class="c"') + '>' + (i % 3 ? 'BLOQUEADO' : 'ANALISADO') + '</b>' +
      kinds[i % kinds.length] + ' · origem ' + origins[(i * 5) % origins.length] + ' → SP</span>';
  }
  tk.innerHTML = html + html;

  /* ---------------- cursor HUD ---------------- */
  var cursor = $('#cursor'), xy = $('#cursorXY');
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var cx = innerWidth / 2, cy = innerHeight / 2, rx = cx, ry = cy;
    var ring = $('.cursor__ring', cursor), dot = $('.cursor__dot', cursor);
    addEventListener('pointermove', function (e) {
      cx = e.clientX; cy = e.clientY;
      cursor.classList.add('is-on');
      dot.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
      xy.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
      xy.textContent = 'X' + String(cx | 0).padStart(4, '0') + ' Y' + String(cy | 0).padStart(4, '0');
    });
    (function follow() {
      rx += (cx - rx) * 0.18; ry += (cy - ry) * 0.18;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      requestAnimationFrame(follow);
    })();
    $$('a, button, .panel, [data-magnetic]').forEach(function (el) {
      el.addEventListener('mouseenter', function () { cursor.classList.add('is-hover'); });
      el.addEventListener('mouseleave', function () { cursor.classList.remove('is-hover'); });
    });
  }

  /* ---------------- botões magnéticos ---------------- */
  if (!reduce && hasGSAP && matchMedia('(hover: hover)').matches) {
    $$('[data-magnetic]').forEach(function (el) {
      var strength = el.classList.contains('contact__card') ? 0.12 : 0.35;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * strength, y: (e.clientY - r.top - r.height / 2) * strength, duration: .5, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', function () { gsap.to(el, { x: 0, y: 0, duration: .8, ease: 'elastic.out(1, .4)' }); });
    });
  }

  /* ---------------- boot ---------------- */
  var bootLines = [
    '> inicializando <b>bratechs-soc</b> v26.11',
    '> carregando motores de detecção ........ <b>OK</b>',
    '> conectando sensores endpoint/rede/nuvem  <b>OK</b>',
    '> sincronizando inteligência de ameaças .. <b>OK</b>',
    '> status: <b>operação contínua</b>'
  ];
  function runBoot(done) {
    if (reduce || !root.classList.contains('booting')) { root.classList.remove('booting'); done(); return; }
    var log = $('#bootLog'), bar = $('#bootBar'), i = 0;
    (function next() {
      if (i < bootLines.length) {
        log.innerHTML += (i ? '\n' : '') + bootLines[i];
        bar.style.width = ((i + 1) / bootLines.length * 100) + '%';
        bar.style.transition = 'width .35s';
        i++; setTimeout(next, 330);
      } else {
        setTimeout(function () {
          $('#boot').classList.add('is-done');
          root.classList.remove('booting');
          done();
          setTimeout(function () { $('#boot').remove(); }, 1000);
        }, 300);
      }
    })();
  }

  /* ---------------- animações de rolagem ---------------- */
  function intro() {
    if (!hasGSAP || reduce) {
      $$('[data-scramble-in]').forEach(function (el) { el.style.opacity = 1; });
      return;
    }
    gsap.from('.hero [data-split]', { yPercent: 115, duration: 1.4, ease: 'expo.out', stagger: .1 });
    gsap.from('.hero__lead, .hero__ctas, .hero__hud', { opacity: 0, y: 24, duration: 1.2, ease: 'expo.out', delay: .5, stagger: .1 });
    scramble($('.hero [data-scramble-in]'), 800);
  }

  function setupScroll() {
    if (!hasGSAP) return;
    gsap.registerPlugin(ScrollTrigger);

    /* Lenis: rolagem suave sincronizada com o GSAP */
    if (window.Lenis && !reduce) {
      var lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      $$('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var target = a.getAttribute('href');
          if (target.length > 1 || target === '#top') { e.preventDefault(); lenis.scrollTo(target === '#top' ? 0 : target, { offset: 0, duration: 1.6 }); }
        });
      });
    }
    if (reduce) return;

    /* títulos: decodificam ao entrar na tela */
    $$('section:not(.hero) [data-scramble-in]').forEach(function (el) {
      ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: function () { scrambleBlock(el); } });
    });

    /* serviços: rolagem horizontal pinada */
    var track = $('#hsTrack');
    var dist = function () { return Math.max(0, track.scrollWidth - innerWidth); };
    gsap.to(track, {
      x: function () { return -dist(); }, ease: 'none',
      scrollTrigger: {
        trigger: '.hs', pin: '.hs__pin', start: 'top top', end: function () { return '+=' + dist(); },
        scrub: 1, invalidateOnRefresh: true,
        onUpdate: function (s) { $('#hsBar').style.transform = 'scaleX(' + s.progress + ')'; }
      }
    });
    gsap.from('.panel', { opacity: 0, y: 60, duration: 1, ease: 'expo.out', stagger: .08,
      scrollTrigger: { trigger: '.hs', start: 'top 70%' } });

    /* camadas 3D: explodem com a rolagem */
    var tl = gsap.timeline({ scrollTrigger: { trigger: '.layers', pin: '.layers__pin', start: 'top top', end: '+=140%', scrub: 1 } });
    tl.fromTo('#stack', { '--gap': '8px', rotateZ: -6 }, { '--gap': '92px', rotateZ: 0, ease: 'power2.inOut', duration: 1 })
      .to('.layer span', { opacity: 1, duration: .3, stagger: .08 }, .45)
      .from('.layers__copy > *', { opacity: 0, y: 40, stagger: .1, duration: .4 }, 0);

    /* método: linha se desenha */
    gsap.to('#methodPath', { strokeDashoffset: 0, ease: 'none',
      scrollTrigger: { trigger: '.method__body', start: 'top 65%', end: 'bottom 65%', scrub: true } });
    $$('.method__list li').forEach(function (li) {
      gsap.from(li, { opacity: 0, x: 40, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: li, start: 'top 80%' } });
      ScrollTrigger.create({ trigger: li, start: 'top 65%', onEnter: function () {
        var b = $('b', li); b.style.color = '#3FF9A5'; b.style.webkitTextStroke = '0'; b.style.textShadow = '0 0 24px rgba(63,249,165,.6)';
      } });
    });

    /* números: contam e decodificam */
    $$('[data-to]').forEach(function (el) {
      ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: function () {
        var o = { v: 0 }, to = +el.dataset.to, suf = el.dataset.suffix || '';
        gsap.to(o, { v: to, duration: 1.6, ease: 'expo.out', onUpdate: function () { el.textContent = String(Math.round(o.v)).padStart(2, '0') + suf; } });
      } });
    });

    /* contato: título sobe por linhas */
    gsap.from('.contact [data-split]', { yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: .12,
      scrollTrigger: { trigger: '.contact', start: 'top 70%' } });
    gsap.from('.contact__card', { opacity: 0, y: 40, duration: 1, ease: 'expo.out', stagger: .1,
      scrollTrigger: { trigger: '.contact__grid', start: 'top 85%' } });

    addEventListener('load', function () { ScrollTrigger.refresh(); });
  }

  /* sem GSAP/reduzir movimento: números finais direto */
  if (!hasGSAP || reduce) $$('[data-to]').forEach(function (el) { el.textContent = el.dataset.to + (el.dataset.suffix || ''); });

  setupScroll();
  runBoot(intro);

  /* contador do HUD alimentado pelo globo */
  var hud = $('#hudCount'), n = 0;
  addEventListener('bt:intercept', function () { n++; hud.textContent = n.toLocaleString('pt-BR'); });
})();
