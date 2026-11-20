// Fontes varridas pelo Radar Bratechs. weight = peso editorial (autoridade/relevância).
// Só veículos em português (decisão de 2026-11-20): o Radar publica texto 100% em PT-BR.
// general: true = portal de tecnologia geral; só entra notícia que passar no filtro SECURITY.
export const SOURCES = [
  { name: 'CISO Advisor',           url: 'https://www.cisoadvisor.com.br/feed/',          lang: 'pt', weight: 2.8 },
  { name: 'The Hack',               url: 'https://thehack.com.br/feed/',                  lang: 'pt', weight: 2.4 },
  { name: 'Canaltech',              url: 'https://canaltech.com.br/rss/seguranca/',       lang: 'pt', weight: 2.2 },
  { name: 'Olhar Digital',          url: 'https://olhardigital.com.br/seguranca/feed/',   lang: 'pt', weight: 2.0 },
  { name: 'Security Leaders',       url: 'https://securityleaders.com.br/feed/',          lang: 'pt', weight: 2.0 },
  { name: 'Minuto da Segurança',    url: 'https://minutodaseguranca.blog.br/feed/',       lang: 'pt', weight: 1.8 },
  { name: 'ESET WeLiveSecurity',    url: 'https://www.welivesecurity.com/pt/rss/feed/',   lang: 'pt', weight: 1.6 },
  { name: 'Crypto ID',              url: 'https://cryptoid.com.br/feed/',                 lang: 'pt', weight: 1.4 },
  { name: 'Tecnoblog',              url: 'https://tecnoblog.net/feed/',                   lang: 'pt', weight: 2.0, general: true },
  { name: 'Tecmundo',               url: 'https://rss.tecmundo.com.br/feed',              lang: 'pt', weight: 2.0, general: true },
  { name: 'Convergência Digital',   url: 'https://convergenciadigital.com.br/feed/',      lang: 'pt', weight: 1.8, general: true },
  { name: 'IT Forum',               url: 'https://itforum.com.br/feed/',                  lang: 'pt', weight: 1.6, general: true },
  { name: 'Baguete',                url: 'https://www.baguete.com.br/rss/noticias/feed',  lang: 'pt', weight: 1.4, general: true }
];

// Filtro obrigatório para portais gerais (texto normalizado, sem acento, minúsculo).
export const SECURITY = /ciberseg|seguranca (digital|da informacao|cibernetica)|hacker|ransomware|malware|spyware|trojan|backdoor|botnet|ddos|phishing|vazamento|vazad[oa]s?|dados expostos|vulnerabilidade|falha de seguranca|brecha|exploit|cve-\d|zero[- ]?day|dia zero|invasao|invasor|ataque cibernetico|golpe (digital|virtual|no pix|do pix|pelo whatsapp)|fraude (digital|online|bancaria)|senhas?\b|autenticacao|criptografia|lgpd|anpd|ciberataque|cibercrim/;

// Palavras que indicam relevância (texto normalizado, sem acento, minúsculo).
export const KEYWORDS = [
  [/zero[- ]?day|0[- ]?day|dia zero/, 4],
  [/actively exploited|exploited in the wild|explorad[ao] ativamente|sob exploracao/, 4],
  [/ransomware/, 3],
  [/data breach|vazamento|leak(ed)?\b|exposed data|dados expostos/, 3],
  [/critical|critica|cvss (9|10)/, 2.5],
  [/cve-\d{4}-\d+/, 2],
  [/supply[- ]chain|cadeia de suprimentos/, 2.5],
  [/\bcisa\b|kev\b|emergency directive/, 1.5],
  [/fortinet|fortigate|fortios|sophos/, 2.5],                // parceiros da Bratechs
  [/microsoft|windows|exchange|azure|google|chrome|apple|ios|android|cisco|vmware|ivanti|citrix/, 1.2],
  [/brasil|brazil|brasileir|lgpd|anpd|pix\b|gov\.br/, 3],     // impacto local
  [/phishing|golpe|scam|fraude/, 1.5],
  [/apt\d*|nation[- ]state|espionage|espionagem|lazarus|state-sponsored/, 1.8],
  [/botnet|ddos/, 1.4],
  [/patch|update now|atualize|correcao|fix(es)? /, 1],
  [/\bai\b|artificial intelligence|inteligencia artificial|llm|deepfake/, 1],
  [/arrest|sentenced|preso|takedown|operacao policial|seized/, 1.2]
];

// Penaliza conteúdo promocional/evergreen.
export const NOISE = /webinar|podcast|sponsored|patrocinad|how to |como fazer|guia completo|top \d+|review|deal|oferta|promo|black friday|week in review|weekly recap|resumo da semana/;

export const STOPWORDS = new Set(('the and for with from that this have has are was were will into over after about your their what when where which while than then them they these those been being more most less also just only some such very can could would should may might must new news says said report reports update updates attack attacks hackers hacker security cyber data users user company companies million billion using used use via its it\'s our out off how why who all any one two three first last year years week day days time make makes made get gets got '
  + 'para com uma sobre como mais pelo pela pelos pelas seus suas entre apos ainda desde quando onde qual quais ser sao foi esta estao este essa esse isso isto pode podem tambem muito muitos muitas novo nova novos novas diz dizem empresa empresas usuarios usuario ataque ataques hacker hackers dados seguranca ciberseguranca digital contra sem').split(/\s+/));
