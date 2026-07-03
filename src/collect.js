#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { parseCardText, toCsv, buildSummary } = require('./lib/parse');

function parseArgs(argv) {
  const args = {
    country: 'BR',
    days: 90,
    activeStatus: 'active',
    mediaType: 'all',
    maxScrolls: 12,
    initialWaitMs: 8000,
    minWaitMs: 1400,
    plateauLimit: 5,
    minScrollsBeforePlateau: 5,
    scrollPixels: 3600,
    minScore: 1,
    limitPerQuery: 0,
    out: null,
    headful: false,
    slow: 0,
    locale: 'pt-BR',
    timezone: 'America/Sao_Paulo',
    acceptLanguage: 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = () => argv[++i];
    if (token === '--queries') args.queriesFile = next();
    else if (token === '--query') args.query = next();
    else if (token === '--country') args.country = next();
    else if (token === '--days') args.days = Number(next());
    else if (token === '--date-min') args.dateMin = next();
    else if (token === '--date-max') args.dateMax = next();
    else if (token === '--active-status') args.activeStatus = next();
    else if (token === '--media-type') args.mediaType = next();
    else if (token === '--max-scrolls') args.maxScrolls = Number(next());
    else if (token === '--initial-wait-ms') args.initialWaitMs = Number(next());
    else if (token === '--min-wait-ms') args.minWaitMs = Number(next());
    else if (token === '--plateau-limit') args.plateauLimit = Number(next());
    else if (token === '--min-scrolls-before-plateau') args.minScrollsBeforePlateau = Number(next());
    else if (token === '--scroll-pixels') args.scrollPixels = Number(next());
    else if (token === '--min-score') args.minScore = Number(next());
    else if (token === '--limit-per-query') args.limitPerQuery = Number(next());
    else if (token === '--out') args.out = next();
    else if (token === '--headful') args.headful = true;
    else if (token === '--slow') args.slow = Number(next());
    else if (token === '--locale') args.locale = next();
    else if (token === '--timezone') args.timezone = next();
    else if (token === '--accept-language') args.acceptLanguage = next();
    else if (token === '--user-agent') args.userAgent = next();
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function printHelp() {
  console.log(`Meta Ads Ecommerce Miner

Usage:
  npm run mine -- --queries examples/ecommerce-queries.br.json --out output/br-90d
  npm run mine -- --query "buy 1 get 1 free" --country US --days 14 --out output/bogo-us

Options:
  --queries <file>          JSON file with query objects or strings
  --query <text>            Single query
  --country <code>          Ads Library country code, default BR
  --days <number>           Lookback window, default 90
  --date-min <YYYY-MM-DD>   Fixed minimum date; overrides --days minimum
  --date-max <YYYY-MM-DD>   Fixed maximum date; default today
  --active-status <value>   all, active, inactive; default active
  --media-type <value>      all, image, video, etc.; default all
  --max-scrolls <number>    Max page scrolls per query, default 12
  --initial-wait-ms <ms>    Wait after first load, default 8000
  --min-wait-ms <ms>        Base wait after each scroll, default 1400
  --plateau-limit <number>  Stop after N card-count plateaus, default 5
  --scroll-pixels <number>  Mouse wheel distance per scroll, default 3600
  --min-score <number>      Minimum ecommerce score to save, default 1
  --limit-per-query <n>     Local saved-card cap per query, default 0
  --out <dir>               Output directory
  --headful                 Show browser window
  --slow <ms>               Playwright slow motion delay
  --user-agent <ua>         Browser user agent override
  --help                    Show this help
`);
}

function todayYmd(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function timestampForPath() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function loadQueries(args) {
  const items = [];
  if (args.query) {
    items.push({ query: args.query, market: args.country, tags: ['manual'] });
  }
  if (args.queriesFile) {
    const raw = JSON.parse(fs.readFileSync(args.queriesFile, 'utf8'));
    if (!Array.isArray(raw)) throw new Error('Queries file must be a JSON array');
    for (const item of raw) {
      if (typeof item === 'string') items.push({ query: item, market: args.country, tags: [] });
      else if (item && typeof item.query === 'string') items.push({ ...item, market: item.market || args.country, tags: item.tags || [] });
      else throw new Error('Each query item must be a string or an object with a query field');
    }
  }
  const seen = new Set();
  return items.filter((item) => {
    const key = item.query.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildAdsLibraryUrl(query, args) {
  const max = args.dateMax || todayYmd(0);
  const min = args.dateMin || todayYmd(-Math.max(1, Number(args.days || 90)));
  const params = new URLSearchParams();
  params.set('active_status', args.activeStatus);
  params.set('ad_type', 'all');
  params.set('country', args.country);
  params.set('is_targeted_country', 'false');
  params.set('media_type', args.mediaType);
  params.set('q', query);
  params.set('search_type', 'keyword_unordered');
  params.set('sort_data[mode]', 'total_impressions');
  params.set('sort_data[direction]', 'desc');
  params.set('start_date[min]', min);
  params.set('start_date[max]', max);
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

async function humanWait(page, min = 900, max = 1600) {
  const ms = min + Math.floor(Math.random() * (max - min));
  await page.waitForTimeout(ms);
}

async function expandVisibleDetails(page) {
  await page.evaluate(() => {
    const patterns = [/See summary details/i, /See ad details/i, /Ver detalhes/i, /Open Dropdown/i, /Abrir menu/i];
    const nodes = Array.from(document.querySelectorAll('div[role="button"], span, button, a'));
    for (const node of nodes) {
      const text = (node.innerText || node.textContent || '').trim();
      if (patterns.some((re) => re.test(text))) {
        try { node.click(); } catch (_) {}
      }
    }
  });
}

async function extractRenderedCards(page, queryMeta) {
  const cards = await page.evaluate(() => {
    function uniq(items) { return Array.from(new Set(items.filter(Boolean))); }
    function decodeDestination(href) {
      try {
        const url = new URL(href);
        if (url.hostname === 'l.facebook.com' || url.hostname.endsWith('.facebook.com')) {
          return url.searchParams.get('u') || href;
        }
        return href;
      } catch (_) {
        return href;
      }
    }

    const cards = [];
    for (const div of Array.from(document.querySelectorAll('div'))) {
      const text = (div.innerText || '').trim();
      const hasId = text.includes('Library ID:') || text.includes('Identificação da biblioteca:');
      const hasSponsor = text.includes('Sponsored') || text.includes('Patrocinado');
      if (!hasId || !hasSponsor) continue;
      const idCount = (text.match(/Library ID:|Identificação da biblioteca:/g) || []).length;
      if (idCount !== 1) continue;
      if (text.length > 12000) continue;

      const links = uniq(Array.from(div.querySelectorAll('a[href]'))
        .map((a) => decodeDestination(a.href))
        .filter((href) => href && !href.startsWith('javascript:')));
      const images = uniq(Array.from(div.querySelectorAll('img[src]'))
        .map((img) => img.src)
        .filter((src) => src && !src.startsWith('data:')));
      cards.push({ text, links, images });
    }

    const seen = new Set();
    return cards.filter((card) => {
      const idMatch = card.text.match(/(?:Library ID|Identificação da biblioteca):\s*(\d+)/i);
      const key = idMatch ? idMatch[1] : card.text.replace(/\s+/g, ' ').slice(0, 320);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  const byId = new Map();
  for (const card of cards) {
    const parsed = parseCardText(card.text, { ...queryMeta, links: card.links, images: card.images });
    if (!parsed.library_id) continue;
    if (!byId.has(parsed.library_id) || card.text.length > (byId.get(parsed.library_id).raw_text_excerpt || '').length) {
      byId.set(parsed.library_id, parsed);
    }
  }
  return Array.from(byId.values());
}

async function collectQuery(page, item, args) {
  const url = buildAdsLibraryUrl(item.query, args);
  console.log(`\n[query] ${item.query}`);
  console.log(`[url] ${url}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(args.initialWaitMs);

  let bestCards = [];
  let lastCount = 0;
  let plateaus = 0;
  for (let i = 0; i < args.maxScrolls; i += 1) {
    await expandVisibleDetails(page);
    await humanWait(page, 700, 1200);
    const cards = await extractRenderedCards(page, {
      query: item.query,
      market: item.market,
      tags: item.tags,
      captured_at: new Date().toISOString()
    });
    if (cards.length > bestCards.length) bestCards = cards;
    console.log(`[scroll ${i}/${args.maxScrolls}] rendered cards: ${cards.length}`);

    if (cards.length <= lastCount) plateaus += 1;
    else plateaus = 0;
    lastCount = cards.length;
    if (i >= args.minScrollsBeforePlateau && plateaus >= args.plateauLimit) break;
    await page.mouse.wheel(0, args.scrollPixels);
    await page.waitForTimeout(args.minWaitMs + Math.floor(Math.random() * 600));
  }

  const filtered = bestCards
    .filter((card) => Number(card.ecommerce_score || 0) >= args.minScore)
    .sort((a, b) => (b.ecommerce_score || 0) - (a.ecommerce_score || 0));
  const limited = args.limitPerQuery > 0 ? filtered.slice(0, args.limitPerQuery) : filtered;
  return { url, foundCards: bestCards.length, records: limited };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const queries = loadQueries(args);
  if (!queries.length) {
    throw new Error('Provide --query or --queries');
  }

  const outDir = path.resolve(args.out || `output/run-${timestampForPath()}`);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonlPath = path.join(outDir, 'ads.jsonl');
  const csvPath = path.join(outDir, 'ads.csv');
  const summaryPath = path.join(outDir, 'summary.md');
  fs.writeFileSync(jsonlPath, '');

  const browser = await chromium.launch({
    headless: !args.headful,
    slowMo: Number(args.slow || 0),
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 950 },
    locale: args.locale,
    timezoneId: args.timezone,
    userAgent: args.userAgent,
    extraHTTPHeaders: { 'Accept-Language': args.acceptLanguage },
    javaScriptEnabled: true
  });
  const page = await context.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });

  const seen = new Map();
  const queryStats = [];
  try {
    for (const item of queries) {
      const result = await collectQuery(page, item, args);
      let savedForQuery = 0;
      for (const record of result.records) {
        if (!seen.has(record.library_id)) {
          seen.set(record.library_id, record);
          fs.appendFileSync(jsonlPath, `${JSON.stringify(record)}\n`);
          savedForQuery += 1;
        }
      }
      queryStats.push({
        query: item.query,
        url: result.url,
        found_cards: result.foundCards,
        saved_unique: savedForQuery
      });
      const all = Array.from(seen.values());
      fs.writeFileSync(csvPath, toCsv(all));
      fs.writeFileSync(summaryPath, buildSummary(all, queryStats));
      console.log(`[saved] query unique: ${savedForQuery} | total unique: ${all.length}`);
    }
  } finally {
    await browser.close();
  }

  console.log('\nDone.');
  console.log(`JSONL: ${jsonlPath}`);
  console.log(`CSV:   ${csvPath}`);
  console.log(`MD:    ${summaryPath}`);
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
