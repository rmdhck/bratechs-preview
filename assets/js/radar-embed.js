/* RADAR BRATECHS — bloco "matéria do dia" para as páginas do site.
   Uso: <div data-radar-embed data-base="../"></div>  +  <script src="../assets/js/radar-embed.js" defer></script>
   Mostra a matéria principal da edição mais recente, com fonte e "Leia mais notícias".
   O visual vem de assets/css/radar-embed.css, ajustável por variáveis CSS em cada página. */
(function () {
  'use strict';
  var SEV = { critica: 'Crítica', alta: 'Alta', media: 'Média' };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) { try { var x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : '#'; } catch (e) { return '#'; } }
  function ago(iso) {
    var rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
    var s = (new Date(iso) - Date.now()) / 1000, a = Math.abs(s);
    return a < 3600 ? rtf.format(Math.round(s / 60), 'minute') : a < 86400 ? rtf.format(Math.round(s / 3600), 'hour') : rtf.format(Math.round(s / 86400), 'day');
  }

  [].forEach.call(document.querySelectorAll('[data-radar-embed]'), function (box) {
    var base = box.getAttribute('data-base') || '../';
    box.classList.add('re', 're--loading');
    box.innerHTML = '<div class="re__skeleton"></div>';

    fetch(base + 'data/news.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (db) {
        var ed = db.editions && db.editions[0];
        if (!ed || !ed.items.length) throw new Error('vazio');
        var it = ed.items[0], others = ed.items.slice(1);
        var nl = base + 'newsletter/';
        box.innerHTML =
          '<div class="re__head">' +
            '<span class="re__live"></span><span>Radar Bratechs</span><span class="re__sep">·</span>' +
            '<span>Edição das ' + esc(ed.slot) + '</span><span class="re__sep">·</span><span>' + esc(ago(ed.publishedAt)) + '</span>' +
          '</div>' +
          '<article class="re__card">' +
            '<div class="re__meta">' +
              '<span class="re__sev re__sev--' + esc(it.severity) + '">' + esc(SEV[it.severity] || it.severity) + '</span>' +
              '<span class="re__cat">' + esc(it.category) + '</span>' +
            '</div>' +
            '<h3 class="re__title"><a href="' + nl + '?n=' + encodeURIComponent(it.id) + '#n-' + esc(it.id) + '">' + esc(it.title) + '</a></h3>' +
            '<p class="re__summary">' + esc(it.summary) + '</p>' +
            '<div class="re__foot">' +
              '<a class="re__source" href="' + esc(safeUrl(it.link)) + '" target="_blank" rel="noopener nofollow">Fonte: <b>' + esc(it.source.name) + '</b> ↗</a>' +
              '<a class="re__more" href="' + nl + '">Leia mais notícias <span aria-hidden="true">→</span></a>' +
            '</div>' +
          '</article>' +
          (others.length ? '<ul class="re__list">' + others.map(function (o) {
            return '<li><a href="' + nl + '?n=' + encodeURIComponent(o.id) + '#n-' + esc(o.id) + '"><i class="re__dot re__dot--' + esc(o.severity) + '"></i>' +
              '<span>' + esc(o.title) + '<small>' + esc(o.source.name) + '</small></span></a></li>';
          }).join('') + '</ul>' : '');
        box.classList.remove('re--loading');
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      })
      .catch(function () {
        box.innerHTML = '<a class="re__more re__more--solo" href="' + base + 'newsletter/">Ver as notícias de cibersegurança do dia <span aria-hidden="true">→</span></a>';
        box.classList.remove('re--loading');
      });
  });
})();
