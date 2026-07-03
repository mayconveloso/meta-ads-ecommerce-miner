const assert = require('assert');
const { parseCardText, scoreEcommerce, extractDomain, toCsv, buildSummary } = require('../src/lib/parse');

const sample = `
Library ID: 123456789012345
Started running on Jan 2, 2026
3 ads use this creative and text
See summary details
Example Store
Sponsored
Buy 1 get 1 free today only.
Free shipping on all orders.
Shop now
`;

const parsed = parseCardText(sample, {
  query: 'buy 1 get 1 free',
  market: 'US',
  links: ['https://www.examplestore.com/products/widget?utm_source=meta'],
  images: ['https://example.com/image.jpg'],
  captured_at: '2026-01-03T00:00:00.000Z'
});

assert.strictEqual(parsed.library_id, '123456789012345');
assert.strictEqual(parsed.advertiser, 'Example Store');
assert.strictEqual(parsed.started_running, 'Jan 2, 2026');
assert.strictEqual(parsed.creative_count, 3);
assert.ok(parsed.ad_text.includes('Buy 1 get 1 free'));
assert.ok(parsed.ecommerce_score >= 8, `score was ${parsed.ecommerce_score}`);
assert.ok(parsed.ecommerce_signals.includes('shop_cta'));
assert.ok(parsed.ecommerce_signals.includes('shipping'));
assert.deepStrictEqual(parsed.link_domains, ['examplestore.com']);
assert.strictEqual(extractDomain('https://www.shop.example/path'), 'shop.example');

const scored = scoreEcommerce('Últimas unidades com frete grátis. Comprar agora.', []);
assert.ok(scored.score >= 7, `BR score was ${scored.score}`);

const csv = toCsv([parsed]);
assert.ok(csv.includes('library_id,query,advertiser'));
assert.ok(csv.includes('123456789012345'));

const summary = buildSummary([parsed], [{ query: 'buy 1 get 1 free', found_cards: 1, saved_unique: 1, url: 'https://example.com' }]);
assert.ok(summary.includes('Unique ads: 1'));
assert.ok(summary.includes('Example Store'));

console.log('parse.test.js passed');
