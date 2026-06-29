/**
 * Build-time sitemap generator.
 *
 * Produces a sitemap index with three sub-sitemaps:
 *   sitemap-static.xml  — static pages
 *   sitemap-blogs.xml   — all blog posts (API + bundled fallback)
 *   sitemap-stocks.xml  — all analyzed stock pages with real lastmod dates
 *
 * Runs during Amplify postBuild so each deploy ships up-to-date sitemaps.
 * Falls back to bundled data if the API is unreachable.
 */

import { writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const SITE = 'https://www.claritx.ai';
const RAW_API_URL = process.env.VITE_AWS_API_URL || '';
const API_URL = RAW_API_URL.startsWith('http') ? RAW_API_URL : 'https://your-api-id.execute-api.us-east-1.amazonaws.com/prod';

const today = new Date().toISOString().slice(0, 10);

// Retired duplicate slugs — redirected to a survivor, must not appear in sitemaps
const BLOG_REDIRECTS = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'data', 'blogRedirects.json'), 'utf-8')
);

// Committed snapshot of DB blog posts — fallback when the API is unreachable, so
// the sitemap and the generated files stay in sync (both cover every known post).
let BLOG_SNAPSHOT = [];
try {
  BLOG_SNAPSHOT = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'blogSlugs.json'), 'utf-8'));
} catch { /* optional */ }

// The stocks sitemap is capped: ~1,340 thin /stocks/TICKER pages diluted crawl
// budget and sat unindexed (GSC "Discovered/Crawled – currently not indexed").
// Core mega-cap tickers are always included; the rest of the budget goes to the
// most recently analyzed symbols (freshest content).
const MAX_STOCK_URLS = 250;
const CORE_TICKERS = new Set([
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B', 'UNH',
  'LLY', 'JPM', 'XOM', 'V', 'JNJ', 'WMT', 'MA', 'PG', 'HD', 'AVGO',
  'CVX', 'MRK', 'ORCL', 'ABBV', 'PEP', 'KO', 'COST', 'ADBE', 'CRM', 'AMD',
  'MCD', 'TMO', 'CSCO', 'BAC', 'NFLX', 'ACN', 'ABT', 'LIN', 'DHR', 'TMUS',
  'WFC', 'TXN', 'PM', 'INTC', 'AMGN', 'NEE', 'COP', 'HON', 'IBM', 'NKE',
  'SPY', 'QQQ', 'VOO', 'VTI', 'PLTR', 'COIN', 'SOFI', 'HOOD', 'MSTR', 'SMCI',
]);

const STATIC_PAGES = [
  { loc: '/',                       changefreq: 'daily',   priority: '1.0' },
  { loc: '/ai-stock-rank',          changefreq: 'daily',   priority: '0.9' },
  { loc: '/ai-stock-analysis',      changefreq: 'daily',   priority: '0.9' },
  { loc: '/market-opportunities',   changefreq: 'daily',   priority: '0.8' },
  { loc: '/stocks',                 changefreq: 'weekly',  priority: '0.8' },
  { loc: '/ai-stock-analysis-guide',changefreq: 'monthly', priority: '0.8' },
  { loc: '/buffett-indicator',      changefreq: 'weekly',  priority: '0.8' },
  { loc: '/pricing',                changefreq: 'monthly', priority: '0.8' },
  { loc: '/blog',                   changefreq: 'daily',   priority: '0.8' },
  { loc: '/about',                  changefreq: 'monthly', priority: '0.6' },
  { loc: '/portfolio-simulator',    changefreq: 'monthly', priority: '0.5' },
  { loc: '/disclaimer',             changefreq: 'yearly',  priority: '0.3' },
  { loc: '/privacy',                changefreq: 'yearly',  priority: '0.3' },
  { loc: '/terms',                  changefreq: 'yearly',  priority: '0.3' },
];

const BUNDLED_BLOG_SLUGS = [
  'best-stocks-to-buy-2026',
  'how-to-analyze-stocks-complete-guide',
  'ai-stock-screener-comparison-2026',
  'hidden-dangers-ai-stock-analysis',
  'why-claritx-multi-angle-analysis',
  'ai-hallucinations-financial-data',
  'dividend-investing-passive-income-guide',
  'stock-market-for-beginners-first-investment',
  'growth-vs-value-investing-which-style',
  'how-to-read-financial-statements-plain-english',
  'etf-vs-individual-stocks-which-to-choose',
  'dollar-cost-averaging-vs-lump-sum',
  'stock-market-crashes-how-to-prepare',
  'investing-in-your-30s-building-wealth',
  'understanding-pe-ratio-valuation',
  'building-emergency-fund-before-investing',
  'tax-loss-harvesting-explained',
  'sector-rotation-strategy-explained',
  'reits-for-beginners-real-estate-investing',
  'stop-loss-orders-protect-or-hurt',
  'best-dividend-stocks-for-retirement',
  'how-to-invest-1000-dollars',
  'passive-income-stocks-monthly-dividends',
  'safe-stocks-for-beginners-low-risk',
  'best-etfs-to-buy-and-hold-forever',
];

function urlBlock(loc, lastmod, changefreq, priority) {
  return [
    '  <url>',
    `    <loc>${SITE}${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}

function wrapUrlset(urls) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

async function fetchJSON(path, timeoutMs = 30000, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(`${API_URL}${path}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr;
}

async function main() {
  console.log('[sitemap] Generating sitemap index + sub-sitemaps …');

  let apiBlogs = [];
  let apiStocks = [];

  try {
    const data = await fetchJSON('/sitemap-entries');
    if (data.blogs) apiBlogs = data.blogs;
    if (data.stocks) apiStocks = data.stocks;
    console.log(`[sitemap] Fetched ${apiBlogs.length} blogs, ${apiStocks.length} stocks from API`);
  } catch (err) {
    console.log(`[sitemap] API unreachable (${err.message}), using committed snapshot + bundled data`);
  }
  // Fall back to the committed snapshot so the sitemap matches the files that
  // generate-spa-fallbacks.js produces from the same snapshot (no orphan URLs).
  if (!apiBlogs.length && BLOG_SNAPSHOT.length) {
    apiBlogs = BLOG_SNAPSHOT.map((p) => ({ slug: p.slug, published_at: p.published_at }));
    console.log(`[sitemap] Using ${apiBlogs.length} blogs from committed snapshot`);
  }

  // ── sitemap-static.xml ──
  const staticUrls = STATIC_PAGES.map(p => urlBlock(p.loc, today, p.changefreq, p.priority));
  await writeFile(join(DIST_DIR, 'sitemap-static.xml'), wrapUrlset(staticUrls));
  console.log(`[sitemap] sitemap-static.xml: ${staticUrls.length} URLs`);

  // ── sitemap-blogs.xml ──
  const blogSlugs = new Map();
  for (const b of apiBlogs) {
    blogSlugs.set(b.slug, b.published_at || today);
  }
  for (const slug of BUNDLED_BLOG_SLUGS) {
    if (!blogSlugs.has(slug)) blogSlugs.set(slug, today);
  }
  let droppedBlogs = 0;
  for (const oldSlug of Object.keys(BLOG_REDIRECTS)) {
    if (blogSlugs.delete(oldSlug)) droppedBlogs++;
  }
  const blogUrls = [...blogSlugs].map(([slug, lastmod]) =>
    urlBlock(`/blog/${slug}`, lastmod, 'monthly', '0.7')
  );
  await writeFile(join(DIST_DIR, 'sitemap-blogs.xml'), wrapUrlset(blogUrls));
  console.log(`[sitemap] sitemap-blogs.xml: ${blogUrls.length} URLs (${droppedBlogs} redirected duplicates excluded)`);

  // ── sitemap-stocks.xml ──
  const normalized = apiStocks.map(s => ({
    sym: typeof s === 'string' ? s : s.symbol,
    lastmod: (typeof s === 'object' && s.completed_at) ? s.completed_at : today,
  }));
  // Core tickers first, then most recently analyzed, capped at MAX_STOCK_URLS
  normalized.sort((a, b) => b.lastmod.localeCompare(a.lastmod));
  const chosen = [];
  const seen = new Set();
  for (const s of normalized) {
    if (CORE_TICKERS.has(s.sym) && !seen.has(s.sym)) { chosen.push(s); seen.add(s.sym); }
  }
  for (const s of normalized) {
    if (chosen.length >= MAX_STOCK_URLS) break;
    if (!seen.has(s.sym)) { chosen.push(s); seen.add(s.sym); }
  }
  const stockUrls = chosen.map(s => urlBlock(`/stocks/${s.sym}`, s.lastmod, 'weekly', '0.8'));
  await writeFile(join(DIST_DIR, 'sitemap-stocks.xml'), wrapUrlset(stockUrls));
  console.log(`[sitemap] sitemap-stocks.xml: ${stockUrls.length} URLs (capped from ${normalized.length} analyzed symbols — pages stay live, just out of the sitemap)`);

  // ── sitemap.xml (index) ──
  const indexXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <sitemap>`,
    `    <loc>${SITE}/sitemap-static.xml</loc>`,
    `    <lastmod>${today}</lastmod>`,
    `  </sitemap>`,
    `  <sitemap>`,
    `    <loc>${SITE}/sitemap-blogs.xml</loc>`,
    `    <lastmod>${today}</lastmod>`,
    `  </sitemap>`,
    `  <sitemap>`,
    `    <loc>${SITE}/sitemap-stocks.xml</loc>`,
    `    <lastmod>${today}</lastmod>`,
    `  </sitemap>`,
    '</sitemapindex>',
    '',
  ].join('\n');
  await writeFile(join(DIST_DIR, 'sitemap.xml'), indexXml);

  const totalUrls = staticUrls.length + blogUrls.length + stockUrls.length;
  console.log(`[sitemap] sitemap.xml (index) written — total ${totalUrls} URLs across 3 sub-sitemaps`);
}

main().catch((err) => {
  console.error('[sitemap] Failed:', err.message);
  console.log('[sitemap] Falling back to static sitemap.xml from public/');
  process.exit(0);
});
