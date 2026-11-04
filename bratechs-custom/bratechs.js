/* BRATECHS — animação ao rolar + linha do tempo do "Como funciona"
   No WordPress: widget "HTML" no fim da página (ou rodapé) com <script> ... </script> */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce) return;
  root.classList.add('bt-js');

  /* 7) revelar ao rolar: widgets e cards fora do hero */
  var page = document.querySelector('.elementor-64');
  if (!page) return;
  var targets = [].slice.call(page.querySelectorAll(
    '.elementor-widget, ' +
    '.elementor-element-96853f6, ' +                                  /* órbita inteira */
    '.elementor-element-8238396 .elementor-icon-list-item, ' +       /* cards da lista */
    '.elementor-element-dd80c5d, .elementor-element-c56c23f, .elementor-element-77eb68a'
  )).filter(function (el) {
    return !el.closest('#inicio') &&                                  /* hero aparece direto */
           !el.closest('.elementor-element-96853f6') &&               /* nada dentro da órbita */
           !el.classList.contains('elementor-widget-icon-list') &&
           !el.closest('.elementor-element-dd80c5d, .elementor-element-c56c23f, .elementor-element-77eb68a') &&
           !el.closest('.elementor-element-8238396 .elementor-icon-list-item');
  });

  /* atraso em cascata entre irmãos */
  targets.forEach(function (el) {
    var sibs = targets.filter(function (o) { return o.parentNode === el.parentNode; });
    var i = sibs.indexOf(el);
    el.style.setProperty('--bt-delay', Math.min(i, 6) * 0.08 + 's');
    el.classList.add('bt-reveal');
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  targets.forEach(function (el) { io.observe(el); });

  /* 3) linha do tempo: posiciona entre o 1º e o último círculo e preenche com a rolagem */
  var box = document.querySelector('.elementor-element-1528f4b > .e-con-inner');
  var nums = [].slice.call(document.querySelectorAll(
    '.elementor-element-271b632, .elementor-element-21bee54, .elementor-element-d8eb48f, ' +
    '.elementor-element-676beb0, .elementor-element-ffaed78'
  )).map(function (w) { return w.querySelector('.elementor-heading-title'); }).filter(Boolean);
  if (!box || nums.length < 2) return;

  var ticking = false;
  function layout() {
    var b = box.getBoundingClientRect();
    var first = nums[0].getBoundingClientRect();
    var last = nums[nums.length - 1].getBoundingClientRect();
    var top = first.top + first.height / 2 - b.top;
    var h = last.top + last.height / 2 - b.top - top;
    box.style.setProperty('--bt-line-left', (first.left + first.width / 2 - b.left - 1) + 'px');
    box.style.setProperty('--bt-line-top', top + 'px');
    box.style.setProperty('--bt-line-h', Math.max(h, 0) + 'px');
    /* progresso: quanto do trecho já passou do meio da tela */
    var mid = window.innerHeight * 0.6;
    var p = (mid - (b.top + top)) / (h || 1);
    box.style.setProperty('--bt-progress', Math.max(0, Math.min(1, p)).toFixed(3));
    ticking = false;
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(layout); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', layout);
  layout();
})();
