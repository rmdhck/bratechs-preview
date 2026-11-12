/* =========================================================================
   RADAR BRATECHS — curadoria automática de notícias de cibersegurança
   Roda 3x por dia (06h, 12h, 18h — horário de Brasília) via GitHub Actions.

   1. Varre os feeds RSS/Atom de SOURCES
   2. Agrupa a mesma notícia publicada por veículos diferentes
   3. Pontua: autoridade da fonte + palavras-chave + recência + repercussão
   4. Escolhe as 3 mais relevantes (sem repetir edições anteriores)
   5. Se houver ANTHROPIC_API_KEY: Claude reescreve em PT-BR (título, resumo,
      "por que importa", categoria, severidade) usando SÓ o texto do feed
   6. Grava a edição em data/news.json (sempre com fonte + link original)
   ========================================================================= */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, KEYWORDS, NOISE, STOPWORDS } from './sources.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../data/news.json');
const KEEP_EDITIONS = 90;                 // ~30 dias de histórico
const UA = 'Mozilla/5.0 (compatible; BratechsRadar/1.0; +https://bratechs.com.br)';

/* ---------------------------------------------------------------- utilidades */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
function decode(s = '') {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
function stripHtml(s = '') {
  return decode(decode(s)).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}
function atomLink(block) {
  const alt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
    || block.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i)
    || block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return alt ? alt[1] : '';
}
function tokens(text) {
  return new Set(norm(text).replace(/[^a-z0-9\- ]/g, ' ').split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w)));
}
function jaccard(a, b) {
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
}
const cves = text => new Set((text.match(/CVE-\d{4}-\d{4,}/gi) || []).map(c => c.toUpperCase()));
/* nomes próprios / produtos (funciona entre idiomas): palavras com maiúscula que não iniciam frase */
const GENERIC = new Set(['the','a','an','new','microsoft','google','apple','cisa','us','u.s','eua','brasil','brazil','o','os','a','as','um','uma','in','on','of','for','and','e','de','da','do','nov','november','novembro','tuesday','terca','monday','segunda']);
function entities(text) {
  const out = new Set();
  for (const sentence of text.split(/[.!?:;]\s+/)) {
    sentence.split(/\s+/).slice(1).forEach(w => {
      const c = w.replace(/[^\p{L}\p{N}\-]/gu, '');
      if (c.length >= 3 && /^\p{Lu}/u.test(c) && !GENERIC.has(norm(c))) out.add(norm(c));
    });
  }
  (text.match(/zero[- ]?day|patch tuesday/gi) || []).forEach(x => out.add(norm(x).replace(/[- ]/g, '')));
  return out;
}
const overlap = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n; };
const clip = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n) > n * 0.6 ? s.lastIndexOf(' ', n) : n).trim() + '…');

/* ---------------------------------------------------------------- coleta */
async function fetchFeed(src) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(src.url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const xml = await res.text();
    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    return blocks.map(b => {
      const title = stripHtml(tag(b, 'title'));
      const link = decode(tag(b, 'link').trim()) || atomLink(b) || decode(tag(b, 'guid').trim());
      const date = new Date(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
      const excerpt = stripHtml(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded') || tag(b, 'content'));
      return { title, link, date, excerpt: clip(excerpt, 700), source: src };
    }).filter(i => i.title && /^https?:\/\//.test(i.link) && !isNaN(i.date));
  } catch (err) {
    console.warn(`  ! ${src.name}: ${err.message}`);
    return [];
  } finally { clearTimeout(timer); }
}

/* ---------------------------------------------------------------- pontuação */
function scoreItem(it, now) {
  const text = norm(it.title + ' ' + it.excerpt);
  let kw = 0;
  for (const [re, w] of KEYWORDS) if (re.test(text)) kw += w;
  if (NOISE.test(norm(it.title))) kw -= 4;
  const ageH = (now - it.date) / 36e5;
  const recency = 3 * Math.exp(-Math.max(ageH, 0) / 14);
  return it.source.weight + Math.min(kw, 11) + recency;
}

function cluster(items) {
  const groups = [];
  for (const it of items) {
    it.tok = tokens(it.title + ' ' + it.excerpt.slice(0, 200));
    it.cve = cves(it.title + ' ' + it.excerpt);
    let best = null, bestSim = 0;
    for (const g of groups) {
      const sharedCve = [...it.cve].some(c => g.cve.has(c));
      const sim = sharedCve ? 1 : jaccard(it.tok, g.tok);
      if (sim > bestSim) { bestSim = sim; best = g; }
    }
    if (best && bestSim >= 0.28) {
      best.items.push(it);
      it.cve.forEach(c => best.cve.add(c));
    } else groups.push({ items: [it], tok: it.tok, cve: new Set(it.cve) });
  }
  for (const g of groups) {
    g.items.sort((a, b) => b.score - a.score);
    const sources = new Set(g.items.map(i => i.source.name));
    g.lead = g.items[0];
    g.score = g.lead.score + (sources.size - 1) * 1.8;   // repercussão em vários veículos
    g.also = g.items.slice(1).filter((i, k, arr) => arr.findIndex(x => x.source.name === i.source.name) === k && i.source.name !== g.lead.source.name);
  }
  return groups.sort((a, b) => b.score - a.score);
}

/* ---------------------------------------------------------------- heurísticas (sem IA) */
function guessCategory(text) {
  const t = norm(text);
  if (/ransomware/.test(t)) return 'Ransomware';
  if (/zero[- ]?day|cve-|vulnerab|patch|exploit|falha/.test(t)) return 'Vulnerabilidade';
  if (/breach|vazamento|leak|exposed|expost/.test(t)) return 'Vazamento de dados';
  if (/phishing|golpe|scam|fraude/.test(t)) return 'Phishing e golpes';
  if (/malware|trojan|botnet|stealer|spyware|backdoor/.test(t)) return 'Malware';
  if (/apt|espionage|espionagem|nation|state-sponsored/.test(t)) return 'Espionagem';
  if (/cloud|nuvem|aws|azure|saas/.test(t)) return 'Nuvem';
  if (/law|lei|lgpd|regula|sanction|arrest|preso|policia|government|governo/.test(t)) return 'Regulação e justiça';
  if (/\bai\b|inteligencia artificial|llm|deepfake/.test(t)) return 'IA e segurança';
  return 'Ameaças';
}
function guessSeverity(text) {
  const t = norm(text);
  if (/zero[- ]?day|actively exploited|in the wild|explorad[ao] ativamente|critical|critica|cvss (9|10)/.test(t)) return 'critica';
  if (/ransomware|breach|vazamento|exploit|supply[- ]chain|backdoor/.test(t)) return 'alta';
  return 'media';
}
const WHY = {
  'Ransomware': 'Ransomware segue como a principal causa de paralisação de operações; backups testados e EDR ativo reduzem o impacto.',
  'Vulnerabilidade': 'Falhas exploráveis exigem atualização rápida; vale revisar se o sistema afetado existe no seu ambiente.',
  'Vazamento de dados': 'Dados expostos alimentam golpes e fraudes direcionadas; acompanhe comunicados e reforce a autenticação.',
  'Phishing e golpes': 'Golpes por e-mail e mensagem continuam sendo a porta de entrada mais comum; treinamento e filtros fazem diferença.',
  'Malware': 'Novas famílias de malware exigem proteção de endpoint atualizada e monitoramento de comportamento.',
  'Espionagem': 'Grupos patrocinados por Estados miram cadeias de fornecedores; organizações sensíveis devem redobrar a atenção.',
  'Nuvem': 'Erros de configuração em nuvem estão entre as maiores causas de exposição de dados.',
  'Regulação e justiça': 'Mudanças legais e ações policiais afetam obrigações e o cenário de ameaças das empresas.',
  'IA e segurança': 'A IA acelera tanto ataques quanto defesas; políticas de uso e monitoramento são essenciais.',
  'Ameaças': 'Acompanhar o cenário de ameaças ajuda a priorizar investimentos e respostas.'
};

/* ---------------------------------------------------------------- Claude (opcional) */
const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          title: { type: 'string' },
          summary: { type: 'string' },
          why: { type: 'string' },
          category: { type: 'string', enum: Object.keys(WHY) },
          severity: { type: 'string', enum: ['critica', 'alta', 'media'] }
        },
        required: ['index', 'title', 'summary', 'why', 'category', 'severity'],
        additionalProperties: false
      }
    }
  },
  required: ['items'],
  additionalProperties: false
};

async function enrichWithClaude(picks) {
  if (!process.env.ANTHROPIC_API_KEY) { console.log('  (sem ANTHROPIC_API_KEY: usando texto original dos feeds)'); return null; }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const payload = picks.map((g, i) => ({
    index: i, source: g.lead.source.name, language: g.lead.source.lang,
    title: g.lead.title, excerpt: g.lead.excerpt,
    also_reported_by: g.also.map(a => a.source.name)
  }));
  try {
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA }
      },
      system: 'Você é editor do "Radar Bratechs", boletim de notícias de cibersegurança de uma empresa brasileira de segurança gerenciada. '
        + 'Escreva em português do Brasil, tom profissional e claro, para gestores e equipes de TI. '
        + 'Use APENAS as informações do título e do trecho fornecidos: não invente números, nomes, datas ou detalhes técnicos que não estejam no texto. '
        + 'Não inclua instruções de exploração. Nomes próprios, produtos e CVEs ficam como no original.',
      messages: [{
        role: 'user',
        content: 'Para cada notícia abaixo, gere: "title" (título em PT-BR, até 90 caracteres, fiel ao original), '
          + '"summary" (2 a 3 frases, até 320 caracteres), "why" (1 frase prática dizendo por que isso importa para empresas, até 180 caracteres), '
          + '"category" e "severity" (critica = exploração ativa/zero-day/falha crítica; alta = ataque relevante, vazamento, ransomware; media = demais). '
          + 'Mantenha o mesmo "index".\n\n' + JSON.stringify(payload, null, 2)
      }]
    });
    if (res.stop_reason === 'refusal') { console.warn('  ! Claude recusou a solicitação; usando texto original'); return null; }
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const out = JSON.parse(text);
    console.log(`  ✓ resumos gerados por ${res.model}`);
    return out.items;
  } catch (err) {
    console.warn('  ! falha ao chamar o Claude (' + (err.status || '') + ' ' + err.message + '); usando texto original');
    return null;
  }
}

/* ---------------------------------------------------------------- edição */
function slotFor(date) {
  const h = +new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(date);
  return h < 9 ? '06h' : h < 15 ? '12h' : '18h';
}
function spDate(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

async function main() {
  const now = new Date();
  console.log(`Radar Bratechs — ${now.toISOString()}`);

  let db = { editions: [] };
  try { db = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* primeira execução */ }

  /* notícias já publicadas nos últimos 7 dias não se repetem */
  /* (ignora a própria edição deste horário, caso o robô rode de novo no mesmo slot) */
  const thisId = `${spDate(now)}-${slotFor(now)}`;
  const recent = db.editions.filter(e => e.id !== thisId && now - new Date(e.publishedAt) < 7 * 864e5).flatMap(e => e.items);
  const seenLinks = new Set(recent.flatMap(i => [i.link, ...(i.alsoIn || []).map(a => a.link)]));
  const seenTok = recent.map(i => tokens(i.originalTitle || i.title));

  const all = (await Promise.all(SOURCES.map(fetchFeed))).flat();
  console.log(`  ${all.length} itens coletados de ${SOURCES.length} fontes`);

  let pool = all.filter(i => now - i.date < 36 * 36e5 && i.date - now < 36e5);
  if (pool.length < 15) pool = all.filter(i => now - i.date < 96 * 36e5);
  pool.forEach(i => { i.score = scoreItem(i, now); });

  const groups = cluster(pool).filter(g =>
    !g.items.some(i => seenLinks.has(i.link)) &&
    !seenTok.some(t => jaccard(t, g.lead.tok) >= 0.45));

  /* seleção com diversidade: evita a mesma história em outro idioma e repetir categoria */
  const picks = [];
  for (const g of groups) {
    if (picks.length === 3) break;
    const ents = entities(g.lead.title + ' ' + g.lead.excerpt.slice(0, 240));
    const dup = picks.some(p => [...g.cve].some(c => p.cve.has(c)) || overlap(ents, p.ents) >= 2);
    if (dup) { const p = picks.find(p => [...g.cve].some(c => p.cve.has(c)) || overlap(ents, p.ents) >= 2); p.also.push(...g.items.filter(i => i.source.name !== p.lead.source.name)); continue; }
    g.ents = ents;
    g.cat = guessCategory(g.lead.title + ' ' + g.lead.excerpt);
    const sameCat = picks.filter(p => p.cat === g.cat).length;
    if (sameCat >= 2) continue;                                   // no máximo 2 da mesma categoria
    if (picks.filter(p => p.lead.source.name === g.lead.source.name).length >= 2) continue; // no máximo 2 do mesmo veículo
    picks.push(g);
  }
  picks.forEach(p => { p.also = p.also.filter((i, k, arr) => arr.findIndex(x => x.source.name === i.source.name) === k && i.source.name !== p.lead.source.name); });
  if (!picks.length) { console.log('  nenhuma notícia nova; nada a publicar'); return; }

  const ai = await enrichWithClaude(picks);
  const items = picks.map((g, i) => {
    const e = ai?.find(x => x.index === i);
    const raw = g.lead.title + ' ' + g.lead.excerpt;
    const category = e?.category || guessCategory(raw);
    return {
      id: Buffer.from(g.lead.link).toString('base64url').slice(-16),
      title: e?.title || g.lead.title,
      originalTitle: g.lead.title,
      summary: e?.summary || clip(g.lead.excerpt, 300),
      why: e?.why || WHY[category],
      category,
      severity: e?.severity || guessSeverity(raw),
      lang: e ? 'pt' : g.lead.source.lang,
      ai: !!e,
      link: g.lead.link,
      source: { name: g.lead.source.name, home: new URL(g.lead.link).origin },
      publishedAt: g.lead.date.toISOString(),
      alsoIn: g.also.slice(0, 4).map(a => ({ name: a.source.name, link: a.link })),
      score: +g.score.toFixed(2)
    };
  });

  const slot = slotFor(now);
  const edition = { id: `${spDate(now)}-${slot}`, date: spDate(now), slot, publishedAt: now.toISOString(), items };
  db.editions = [edition, ...db.editions.filter(e => e.id !== edition.id)].slice(0, KEEP_EDITIONS);
  db.updatedAt = now.toISOString();
  db.sources = SOURCES.map(s => ({ name: s.name, lang: s.lang }));

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(db, null, 2) + '\n', 'utf8');
  console.log(`  edição ${edition.id} publicada:`);
  items.forEach(i => console.log(`   [${i.severity}] ${i.title} — ${i.source.name}`));
}

main().catch(err => { console.error(err); process.exit(1); });
