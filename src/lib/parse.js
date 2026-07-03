const ECOMMERCE_PATTERNS = [
  { name: 'shop_cta', re: /(shop now|buy now|compre agora|comprar agora|comprar|shop today)/i, weight: 3 },
  { name: 'discount', re: /(\d{1,2}%\s*off|off today|desconto|promo[cç][aã]o|sale|oferta|liquida[cç][aã]o)/i, weight: 3 },
  { name: 'shipping', re: /(free shipping|frete gr[aá]tis|envio gr[aá]tis)/i, weight: 2 },
  { name: 'urgency', re: /(ends tonight|last chance|limited offer|s[oó] hoje|[uú]ltimas unidades|acaba hoje)/i, weight: 2 },
  { name: 'bundle', re: /(buy 1 get 1|bogo|bundle|kit|leve \d|pague \d)/i, weight: 2 },
  { name: 'store', re: /(official store|loja oficial|checkout|cart|carrinho)/i, weight: 2 },
  { name: 'product', re: /(skincare|fashion|moda|pet|shoes|t[eê]nis|dress|vestido|watch|rel[oó]gio|hair|cabelo|makeup|maquiagem|gadget|home|kitchen|cozinha)/i, weight: 1 }
];

const PLATFORM_DOMAINS = [
  'shopify.com',
  'myshopify.com',
  'yampi.com.br',
  'cartpanda.com',
  'cartpanda.com.br',
  'woocommerce.com',
  'nuvemshop.com.br',
  'lojaintegrada.com.br',
  'mercadoshops.com.br',
  'perfectpay.com.br',
  'kiwify.com.br',
  'hotmart.com',
  'eduzz.com',
  'monetizze.com.br',
  'appmax.com.br',
  'pagar.me',
  'mercadopago.com.br',
  'stripe.com'
];

function cleanLine(line) {
  return String(line || '').replace(/\s+/g, ' ').trim();
}

function extractDomain(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\./, '');
  } catch (_) {
    return null;
  }
}

function uniq(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function parseStartedRunning(text) {
  const patterns = [
    /Started running on\s+([^\n]+)/i,
    /Come[cç]ou a veicular em\s+([^\n]+)/i,
    /Veicula[cç][aã]o iniciada em\s+([^\n]+)/i,
    /Iniciou em\s+([^\n]+)/i
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match) return cleanLine(match[1]);
  }
  return null;
}

function parseCreativeCount(text) {
  const patterns = [
    /(\d+)\s+ads? use this creative/i,
    /(\d+)\s+an[uú]ncios? usam este criativo/i,
    /(\d+)\s+an[uú]ncios? usam esse criativo/i,
    /(\d+)\s+an[uú]ncios? usam este criativo e este texto/i,
    /(\d+)\s+an[uú]ncios? usam esse criativo e esse texto/i
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match) return Number(match[1]);
  }
  return null;
}

function parseAdvertiser(text) {
  const lines = text.split(/\n+/).map(cleanLine).filter(Boolean);
  const sponsoredWords = new Set(['Sponsored', 'Patrocinado']);
  for (let i = 0; i < lines.length; i += 1) {
    if (sponsoredWords.has(lines[i]) && i > 0) {
      const prev = lines[i - 1];
      if (!/^see |^ver |^open |^abrir /i.test(prev)) return prev;
    }
  }
  const detailMarkers = [/see summary details/i, /see ad details/i, /ver detalhes/i];
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (detailMarkers.some((re) => re.test(lines[i]))) {
      const candidate = lines[i + 1];
      if (candidate && !sponsoredWords.has(candidate)) return candidate;
    }
  }
  return null;
}

function extractAdText(text) {
  const drop = [
    /^Library ID:/i,
    /^Started running on/i,
    /^Come[cç]ou a veicular/i,
    /^Iniciou em/i,
    /^See summary details$/i,
    /^See ad details$/i,
    /^Open Dropdown$/i,
    /^Ver detalhes/i,
    /^Abrir menu/i,
    /^Sponsored$/i,
    /^Patrocinado$/i,
    /^Active$/i,
    /^Ativo$/i,
    /^Inactive$/i,
    /^Inativo$/i,
    /^This ad has multiple versions/i,
    /^Este an[uú]ncio tem v[aá]rias vers[oõ]es/i,
    /^Sorry, we're having trouble playing this video/i,
    /^Estamos com problemas para reproduzir este v[ií]deo/i,
    /^Learn more$/i,
    /^Saiba mais$/i,
    /^Shop now$/i,
    /^Comprar agora$/i
  ];
  const lines = text.split(/\n+/).map(cleanLine).filter(Boolean);
  const filtered = [];
  for (const line of lines) {
    if (drop.some((re) => re.test(line))) continue;
    if (/^\d+\s+(ads?|an[uú]ncios?)\s+/i.test(line)) continue;
    if (/^ID da biblioteca:/i.test(line)) continue;
    filtered.push(line);
  }
  return filtered.slice(0, 40).join('\n').slice(0, 2000).trim();
}

function scoreEcommerce(text, links) {
  const haystack = `${text || ''}\n${(links || []).join('\n')}`;
  const signals = [];
  let score = 0;
  for (const pattern of ECOMMERCE_PATTERNS) {
    if (pattern.re.test(haystack)) {
      signals.push(pattern.name);
      score += pattern.weight;
    }
  }
  const domains = uniq((links || []).map(extractDomain));
  const platformHits = domains.filter((domain) => PLATFORM_DOMAINS.some((p) => domain === p || domain.endsWith(`.${p}`)));
  if (platformHits.length) {
    signals.push('commerce_platform');
    score += 3;
  }
  if (domains.length) {
    signals.push('has_destination_domain');
    score += 1;
  }
  return { score, signals: uniq(signals), domains };
}

function parseCardText(text, meta = {}) {
  const normalized = String(text || '').replace(/\r/g, '').trim();
  const ids = uniq(Array.from(normalized.matchAll(/(?:Library ID|Identificação da biblioteca):\s*(\d+)/gi)).map((m) => m[1]));
  const links = uniq(meta.links || []);
  const images = uniq(meta.images || []);
  const score = scoreEcommerce(normalized, links);
  return {
    library_id: ids[0] || null,
    all_library_ids: ids,
    query: meta.query || null,
    market: meta.market || null,
    tags: meta.tags || [],
    advertiser: parseAdvertiser(normalized),
    started_running: parseStartedRunning(normalized),
    creative_count: parseCreativeCount(normalized),
    ad_text: extractAdText(normalized),
    links,
    link_domains: score.domains,
    images,
    ecommerce_score: score.score,
    ecommerce_signals: score.signals,
    raw_text_excerpt: normalized.slice(0, 1500),
    captured_at: meta.captured_at || new Date().toISOString()
  };
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = Array.isArray(value) ? value.join(' | ') : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(records) {
  const cols = [
    'library_id', 'query', 'advertiser', 'started_running', 'creative_count',
    'ecommerce_score', 'ecommerce_signals', 'link_domains', 'links', 'ad_text', 'captured_at'
  ];
  const lines = [cols.join(',')];
  for (const record of records) {
    lines.push(cols.map((col) => csvEscape(record[col])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function buildSummary(records, queryStats = []) {
  const byAdvertiser = new Map();
  for (const record of records) {
    const key = record.advertiser || 'Unknown advertiser';
    byAdvertiser.set(key, (byAdvertiser.get(key) || 0) + 1);
  }
  const topAdvertisers = Array.from(byAdvertiser.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);
  const topAds = [...records]
    .sort((a, b) => (b.ecommerce_score || 0) - (a.ecommerce_score || 0))
    .slice(0, 20);

  const lines = [];
  lines.push('# Meta Ads Ecommerce Miner — Summary');
  lines.push('');
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push(`Unique ads: ${records.length}`);
  lines.push('');
  if (queryStats.length) {
    lines.push('## Queries');
    lines.push('');
    lines.push('| Query | Found cards | Saved unique | URL |');
    lines.push('|---|---:|---:|---|');
    for (const stat of queryStats) {
      lines.push(`| ${stat.query.replace(/\|/g, '\\|')} | ${stat.found_cards} | ${stat.saved_unique} | [open](${stat.url}) |`);
    }
    lines.push('');
  }
  lines.push('## Top advertisers');
  lines.push('');
  lines.push('| Advertiser | Ads |');
  lines.push('|---|---:|');
  for (const [advertiser, count] of topAdvertisers) {
    lines.push(`| ${advertiser.replace(/\|/g, '\\|')} | ${count} |`);
  }
  lines.push('');
  lines.push('## Top ads by ecommerce score');
  lines.push('');
  for (const ad of topAds) {
    lines.push(`### ${ad.advertiser || 'Unknown'} — ${ad.library_id || 'no id'} — score ${ad.ecommerce_score}`);
    lines.push('');
    lines.push(`- Query: ${ad.query || '-'}`);
    lines.push(`- Signals: ${(ad.ecommerce_signals || []).join(', ') || '-'}`);
    lines.push(`- Domains: ${(ad.link_domains || []).join(', ') || '-'}`);
    if (ad.ad_text) {
      lines.push('');
      lines.push('```text');
      lines.push(ad.ad_text.slice(0, 800));
      lines.push('```');
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

module.exports = {
  parseCardText,
  scoreEcommerce,
  extractDomain,
  toCsv,
  buildSummary
};
