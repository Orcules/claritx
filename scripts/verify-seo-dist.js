/**
 * Post-build SEO smoke test — fails the build (exit 1) if dist/ would ship the
 * exact regression that deindexed the site: route files carrying the homepage
 * <title> and a canonical pointing at https://www.claritx.ai/.
 *
 * Run AFTER generate-spa-fallbacks.js + generate-sitemap.js + prerender.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const BASE_URL = 'https://www.claritx.ai';

const failures = [];
const warnings = [];

function check(label, filePath, { expectCanonical, mustNotBeHomepage = true, expectNoindex = false }) {
  if (!existsSync(filePath)) {
    failures.push(`${label}: file missing (${filePath})`);
    return;
  }
  const html = readFileSync(filePath, 'utf-8');
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '(none)';
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? '(none)';

  if (mustNotBeHomepage) {
    if (canonical === `${BASE_URL}/`) {
      failures.push(`${label}: canonical points at the homepage — this deindexes the page (title: "${title}")`);
    }
    if (/ClaritX - AI (Deep Research|Stock Analysis)/.test(title)) {
      failures.push(`${label}: still has the homepage <title> ("${title}")`);
    }
  }
  if (expectCanonical && canonical !== expectCanonical) {
    failures.push(`${label}: canonical is "${canonical}", expected "${expectCanonical}"`);
  }
  if (expectNoindex && !/<meta name="robots" content="noindex/.test(html)) {
    failures.push(`${label}: expected noindex robots meta`);
  }
}

// Homepage must keep its own canonical
const home = join(DIST_DIR, 'index.html');
if (!existsSync(home)) {
  failures.push('dist/index.html missing');
} else {
  const html = readFileSync(home, 'utf-8');
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (canonical !== `${BASE_URL}/`) failures.push(`homepage canonical is "${canonical}", expected "${BASE_URL}/"`);
}

// Static routes
check('/pricing', join(DIST_DIR, 'pricing.html'), { expectCanonical: `${BASE_URL}/pricing` });
check('/about', join(DIST_DIR, 'about.html'), { expectCanonical: `${BASE_URL}/about` });
check('/blog', join(DIST_DIR, 'blog.html'), { expectCanonical: `${BASE_URL}/blog` });
check('/auth (private)', join(DIST_DIR, 'auth.html'), { expectNoindex: true, mustNotBeHomepage: false });

// Sample one blog post and one stock page — from the generated sitemaps when
// available, otherwise straight from the dist/ directory listing. A missing
// sitemap is a warning (API may have been down at build time); a poisoned
// canonical is always a hard failure.
function firstLoc(sitemapFile, pathPrefix) {
  const p = join(DIST_DIR, sitemapFile);
  if (!existsSync(p)) return null;
  const xml = readFileSync(p, 'utf-8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return locs.find((l) => l.startsWith(`${BASE_URL}${pathPrefix}`)) ?? null;
}

function sampleRoute(sitemapFile, dirName, pathPrefix) {
  const fromSitemap = firstLoc(sitemapFile, pathPrefix);
  if (fromSitemap) return fromSitemap.replace(BASE_URL, '');
  warnings.push(`${sitemapFile} missing or empty — sampling ${pathPrefix} from dist/ instead`);
  const dir = join(DIST_DIR, dirName);
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((f) => f.endsWith('.html'));
  return file ? `${pathPrefix}${file.replace(/\.html$/, '')}` : null;
}

const blogRoute = sampleRoute('sitemap-blogs.xml', 'blog', '/blog/');
if (blogRoute) {
  check(blogRoute, join(DIST_DIR, blogRoute.slice(1) + '.html'), { mustNotBeHomepage: false });
  // Redirect stubs are valid blog files; only enforce non-poisoned canonical
  const html = readFileSync(join(DIST_DIR, blogRoute.slice(1) + '.html'), 'utf-8');
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (canonical === `${BASE_URL}/`) failures.push(`${blogRoute}: canonical points at the homepage`);
} else {
  failures.push('no blog post files found under dist/blog/ — fallback generation did not run');
}

const stockRoute = sampleRoute('sitemap-stocks.xml', 'stocks', '/stocks/');
if (stockRoute) {
  check(stockRoute, join(DIST_DIR, stockRoute.slice(1) + '.html'), {
    expectCanonical: `${BASE_URL}${stockRoute}`,
  });
} else {
  failures.push('no stock page files found under dist/stocks/ — fallback generation did not run');
}

// Cross-check: every blog/stock URL in the generated sitemaps must have a
// matching dist file. This is the gate that catches the exact regression where
// the blog API failed at build time and database posts shipped with no file
// (sitemap lists them, but they 301 to the homepage shell in production).
function sitemapVsDist(sitemapFile, label) {
  const p = join(DIST_DIR, sitemapFile);
  if (!existsSync(p)) return; // missing sitemap already handled above
  const xml = readFileSync(p, 'utf-8');
  const routes = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(BASE_URL, ''))
    .filter((r) => r && r !== '/');
  if (!routes.length) return;
  const missing = routes.filter((r) => !existsSync(join(DIST_DIR, r.slice(1) + '.html')));
  const ratio = missing.length / routes.length;
  if (ratio > 0.02) {
    failures.push(
      `${label}: ${missing.length}/${routes.length} sitemap URLs have NO dist file ` +
      `(e.g. ${missing.slice(0, 5).join(', ')}). These would 301 to the homepage shell — ` +
      `the API fetch likely failed during the build. Rebuild instead of shipping.`
    );
  } else if (missing.length) {
    warnings.push(`${label}: ${missing.length} sitemap URLs missing a dist file (within tolerance): ${missing.slice(0, 3).join(', ')}`);
  }
}

sitemapVsDist('sitemap-blogs.xml', 'blog sitemap');
sitemapVsDist('sitemap-stocks.xml', 'stock sitemap');

for (const w of warnings) console.warn(`[verify-seo] WARN: ${w}`);

if (failures.length) {
  console.error('\n[verify-seo] FAILED — refusing to ship SEO-poisoned HTML:\n');
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}
console.log('[verify-seo] OK — per-route titles and canonicals verified.');
