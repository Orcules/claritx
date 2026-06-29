/**
 * Generates SEO-correct SPA fallback HTML files for all routes.
 *
 * Amplify serves static files — without a rewrite rule, any route like /about
 * or /blog/my-post returns 404 because there's no physical file at that path.
 *
 * For every route this script writes dist/<route>.html based on dist/index.html,
 * with the <head> rewritten per route: unique <title>, meta description,
 * self-referencing canonical, and Open Graph/Twitter tags. Blog posts also get
 * their article content + BlogPosting JSON-LD injected into #root, so crawlers
 * that don't execute JS (Googlebot's first pass, GPTBot, PerplexityBot) see the
 * real content. React's createRoot().render() replaces #root children on mount,
 * so the injected HTML never conflicts with the live app.
 *
 * This guarantees correct SEO signals even when the puppeteer prerender step
 * fails — a plain copy of index.html must NEVER ship, because its canonical
 * points at the homepage and deindexes the page (GSC "Alternative page with
 * proper canonical tag").
 *
 * Run BEFORE prerender.js — prerender overwrites static routes with fully-rendered HTML.
 * Env: SKIP_BLOG_CONTENT=1 skips per-post content fetching (meta-only fallbacks).
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const INDEX_HTML = join(DIST_DIR, 'index.html');
const RAW_API_URL = process.env.VITE_AWS_API_URL || '';
const API_URL = RAW_API_URL.startsWith('http') ? RAW_API_URL : 'https://your-api-id.execute-api.us-east-1.amazonaws.com/prod';
const BASE_URL = 'https://www.claritx.ai';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

// Old blog slug → surviving slug (keyword-cannibalization cleanup). Old URLs
// get a redirect stub with canonical → survivor; sitemaps exclude them.
const BLOG_REDIRECTS = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'data', 'blogRedirects.json'), 'utf-8')
);

// Committed snapshot of every published DB blog post (slug + meta). This is the
// build's safety net: if the Amplify build environment can't reach the API,
// every database post STILL gets a per-route file (meta-only at worst, which is
// enough to fix the canonical/title) instead of silently shipping homepage
// copies. Refreshed by scripts/refresh-blog-snapshot.js (and the daily rebuild).
let BLOG_SNAPSHOT = [];
try {
  BLOG_SNAPSHOT = JSON.parse(
    readFileSync(join(__dirname, '..', 'src', 'data', 'blogSlugs.json'), 'utf-8')
  );
} catch {
  /* snapshot optional — falls back to bundled list */
}

// CTR-optimized title/description overrides for top GSC pages (see the JSON's
// _comment). Applied here AND in src/pages/BlogPost.tsx so static + rendered match.
let SEO_OVERRIDES = {};
try {
  SEO_OVERRIDES = JSON.parse(
    readFileSync(join(__dirname, '..', 'src', 'data', 'seoTitleOverrides.json'), 'utf-8')
  );
} catch {
  /* optional */
}

// Routes that need a fallback file for SPA routing but must not be indexed
const PRIVATE_ROUTES = new Set([
  '/auth',
  '/my-portfolio',
  '/account',
  '/portfolio-analysis',
  '/ranking-dashboard',
  '/activity-logs',
  '/admin/blog-generator',
  '/admin/batch-analysis',
]);

// Titles/descriptions for public static routes — keep in sync with each page's
// <SEOHead> values so the fallback head matches what React renders.
const ROUTE_META = {
  '/blog': {
    title: 'Investment Research Blog - AI Deep Research Insights | ClaritX',
    description: 'Educational articles on AI-powered deep research, investment research best practices, and how to avoid common pitfalls. Learn about AI in finance and multi-angle analysis strategies.',
  },
  '/ai-stock-rank': {
    title: 'AI Stock Screener & Rankings — Top-Rated Picks | ClaritX',
    description: 'Free AI stock screener: the top-ranked stocks, ETFs & funds scored by 9-perspective AI analysis. Compare ratings and find the best assets to research right now.',
  },
  '/ai-stock-analysis': {
    title: 'Free AI Stock Analysis Tool — Analyze Any Stock | ClaritX',
    description: 'Analyze any stock free with AI: 9 perspectives — news sentiment, technicals, financials, analyst ratings & a clear verdict. Instant deep research on any ticker.',
  },
  '/ai-stock-analysis-guide': {
    title: 'What Is AI Deep Research? Ultimate Guide 2026 | ClaritX',
    description: 'Complete guide to AI deep research: how it works, accuracy, limitations, and best practices. Learn to use AI-powered research tools effectively for smarter investing.',
  },
  '/buffett-indicator': {
    title: 'Buffett Indicator 2026: Current Level & What It Means',
    description: 'The Buffett Indicator (market cap to GDP) is near record highs in 2026 — roughly 200–235%. See the current level, how it is calculated, historical context, and what it means for investors.',
  },
  '/market-opportunities': {
    title: 'AI Market Opportunities - News-Driven Stock Catalysts | ClaritX',
    description: 'AI-scanned financial news identifying stocks with potential positive catalysts. Updated every 12 hours. For educational research only.',
  },
  '/portfolio-simulator': {
    title: 'Investment Portfolio Simulator - Free AI Tool | ClaritX',
    description: 'Free AI-powered portfolio simulator. Answer a quick risk questionnaire, get a personalized risk profile, and explore diversified portfolio scenarios for educational purposes.',
  },
  '/pricing': {
    title: 'Pricing — ClaritX AI Deep Research',
    description: 'Choose your plan. Free deep research or upgrade to Pro for deeper AI insights, full rankings, and more credits.',
  },
  '/about': {
    title: 'About ClaritX | AI Deep Research Platform',
    description: 'ClaritX is a free AI-powered deep research platform that evaluates stocks from 9 research perspectives. Built for educational purposes — learn how we work.',
  },
  '/contact': {
    title: 'Contact ClaritX | Get in Touch',
    description: 'Contact the ClaritX team for general questions, feedback, or business inquiries. Reach us at info@claritx.ai or business@claritx.ai.',
  },
  '/stocks': {
    title: 'Stock Deep Research Directory - AI-Powered Research | ClaritX',
    description: 'Browse thousands of stocks with AI-powered deep research. View fundamentals, research summaries, and AI scores for stocks across all sectors including Technology, Healthcare, and Finance.',
  },
  '/disclaimer': {
    title: 'Disclaimer | Investment Risk Disclosures | ClaritX',
    description: 'Important disclaimer and risk disclosures for ClaritX. Our AI-powered stock analysis is for educational purposes only and does not constitute investment advice.',
  },
  '/privacy': {
    title: 'Privacy Policy | Data Protection | ClaritX',
    description: 'ClaritX Privacy Policy. Learn how we collect, use, and protect your personal data in compliance with GDPR, CCPA, and other privacy regulations.',
  },
  '/terms': {
    title: 'Terms of Service | User Agreement | ClaritX',
    description: 'ClaritX Terms of Service. Read our user agreement covering the use of our AI-powered stock analysis and portfolio simulation platform.',
  },
};

const STATIC_ROUTES = [
  // Core pages
  '/blog',
  '/ai-stock-rank',
  '/ai-stock-analysis',
  '/ai-stock-analysis-guide',
  '/buffett-indicator',
  '/market-opportunities',
  '/portfolio-simulator',
  '/portfolio-analysis',
  '/pricing',
  '/about',
  '/contact',
  '/stocks',
  '/disclaimer',
  '/privacy',
  '/terms',
  '/auth',
  '/my-portfolio',
  '/account',
  '/ranking-dashboard',
  '/activity-logs',
  '/admin/blog-generator',
  '/admin/batch-analysis',
];

// Hardcoded bundled blog slugs (fallback if API is down)
const BUNDLED_BLOG_SLUGS = [
  'meta-q1-2026-earnings-ai-capex-analysis',
  'safe-dividend-stocks-under-50-for-beginners',
  'consumer-staples-stocks-safest-bets-new-investors',
  'april-29-market-volatility-fed-decision-tech-earnings',
  'are-blue-chip-stocks-safe-beginner-guide',
  'best-low-risk-stocks-beginners',
  'big-tech-ai-earnings-what-retail-investors-must-watch',
  'safe-stock-portfolio-with-1000-beginner-guide',
  '10-best-stocks-for-beginners-with-small-budgets',
  'big-tech-earnings-week-aapl-msft-googl-metrics',
  'how-to-build-safe-stock-portfolio-1000-dollars',
  'consumer-staples-stocks-safest-bet-for-new-investors',
  'warren-buffetts-safest-stocks-beginners',
  'intel-ai-rally-semiconductor-surge-2026',
  '10-safe-dividend-stocks-under-50-for-beginners',
  'intel-q1-2026-earnings-ai-surge',
  'how-to-pick-safe-stocks-for-beginners',
  'defensive-stocks-explained-low-volatility-picks',
  'multi-angle-deep-research-explained',
  'utility-stocks-explained-beginners-guide',
  'q1-2026-earnings-big-tech-ai-capex-geopolitical-risks',
  'sp-500-vs-individual-stocks-safer-beginners',
  'investing-during-100-oil-risk-reward',
  'best-healthcare-stocks-for-beginners',
  'best-low-risk-stocks-beginners-guide',
  'utility-stocks-explained-safe-investments-guide',
  'safe-dividend-stocks-under-50-beginner-investors',
  'market-volatility-geopolitical-shocks-oil-inflation',
  'future-of-ai-robotics-2030-timelines',
  'latest-financial-trends-2026-market-ai-guide',
  'latest-financial-trends-navigating-2026-market-data',
  'latest-financial-trends-2026-market-analysis',
  'q1-2026-earnings-season-ai-boom-geopolitical-risks',
  'warren-buffett-safest-stocks-beginner-guide',
  'tina-trade-returns-us-equities-surging-2026',
  'best-etfs-for-beginners-low-risk-steady-growth-2026',
  '10-best-safe-stocks-for-beginners-2026',
  'q1-2026-earnings-season-ai-boom-inflation-impact',
  'consumer-staples-stocks-safe-bet-new-investors',
  'best-low-risk-technology-stocks-beginners-2026',
  'q1-2026-earnings-season-forward-guidance',
  'safe-stocks-for-beginners-1000-portfolio',
  'best-low-risk-shares-for-new-investors',
  'how-to-pick-safe-stocks-beginners',
  'build-safe-1000-stock-portfolio-beginner-guide',
  'sp-500-crosses-7000-ai-bank-earnings-defy-fears',
  'q1-2026-bank-earnings-geopolitical-volatility',
  'warren-buffett-safe-stocks-beginners',
  'best-safe-stocks-for-retirement-dividend-picks',
  'how-to-build-safe-stock-portfolio-1000-beginner',
  'q1-2026-big-bank-earnings-retail-investor-guide',
  'best-safe-stocks-for-beginners-2026',
  'great-2026-rotation-value-energy-defensive-etfs',
  'south-korea-ai-proxy-beyond-tech-trade',
  '2026-energy-shock-us-iran-conflict-macro-fallout',
  'financial-trends-2026-ai-rates-market-growth',
  'paypal-current-situation-lawsuits-2026',
  'trump-vs-radical-islam-market-impact-2026',
  'flight-to-safety-low-volatility-precious-metals-etfs-2026',
  'energy-shock-2026-navigating-strait-of-hormuz-etfs',
  'paypal-current-situation-lawsuits-smoke-or-fire-2026',
  'the-great-decoupling-crypto-defies-nasdaq',
  'amplification-2026-silver-gold-bust-leveraged-etfs',
  'beyond-big-tech-utilities-energy-ai-infrastructure-winners',
  'etf-wrapper-revolution-active-private-markets-2026',
  'iran-post-irgc-economic-trajectories-frontier-market',
  'iran-post-operation-epic-fury',
  'trump-vs-khamenei-market-shockwaves-sanctions-evasion-2026',
  'value-vs-growth-investing-2026',
  'investing-in-gold-and-safe-haven-assets-during-geopolitical-turmoil',
  'protect-portfolio-geopolitical-risk-us-israel-iran',
  'south-china-sea-tensions-semiconductor-investments',
  'best-dividend-stocks-for-consistent-income-generation-in-a-volatile-2026-market',
  'protect-against-stagflation-market-correction-iran-conflict',
  'protect-portfolio-iran-war-turmoil-oil-prices',
  'how-investors-mitigate-portfolio-risk-us-israel-iran-conflict',
  'protect-portfolios-middle-east-conflict-oil-prices',
  'us-employment-report-february-2026',
  'magnificent-seven-dominance-emerging-tech-leaders',
  'walmart-healthcare-initiative-long-term-investment',
  'portfolio-protection-guide-geopolitical-crisis',
  'investing-in-geopolitical-risk-middle-east-2026',
  'portfolio-protection-geopolitical-shocks-iran-strikes-february-2026',
  'us-israel-iran-strikes-market-impact',
  'housing-market-correction-or-resurgence-mid-2026',
  'february-2026-jobs-report-fed-interest-rate-implications',
  'higher-for-longer-regional-banks-2026',
  'geopolitical-tensions-oil-prices-energy-investing',
  'how-small-investors-can-beat-hedge-funds-2026',
  'investment-implications-renewable-energy-2026',
  'supply-chain-inflation-2026-portfolio-protection',
  'how-to-use-vix-fear-index-2026',
  'nvidia-ai-revenue-growth-long-term-investors-2026',
  'is-nvidias-ai-driven-revenue-growth-sustainable-for-long-term-investors-in-2026',
  'semiconductor-stocks-beyond-nvidia-2026',
  'nvidia-ai-revenue-grows-long-term-investors-2026',
  'inflations-last-stand-q2-2026-fed-policy-shifts',
  'nvidia-ai-dominance-momentum-after-dip',
  'powells-hawkish-tone-will-the-feds-inflation-fight-crush-your-hopes-for-rate-cuts',
  'powells-hawkish-turn-how-a-higher-for-longer-fed-impacts-your-growth-stocks',
  'ai-supercycle-beyond-nvidia',
  'geopolitical-chessbord-investing-emerging-markets',
  'ai-portfolio-beyond-nvidia',
  'beyond-the-magnificent-7-unearthing-the-next-generation-of-ai-winners-in-the-mid-cap-space',
  'interest-rate-rollercoaster-january-inflation-spike-fed-cuts',
  'return-of-value-investing-2026',
  'ai-earnings-vs-valuations-2026',
  'ai-energy-conundrum-renewable-energy',
  'ai-supercycle-not-over-3-new-ai-chip-startups-surging',
  'the-next-nvidia-qualcomms-ai-chip-breakthrough-and-what-it-means-for-your-portfolio',
  'uncovering-hidden-ai-winners-2026',
  'inflation-surprise-january-2026-cpi-portfolio-adjustment',
  'feds-hawkish-rhetoric-dividend-portfolio',
  'software-bear-market-ai-impact',
  'dissecting-ai-q4-earnings',
  'embodied-ai-stocks-2026',
  'nvidia-ai-crown-under-threat',
  'gamestops-roaring-kitty-comeback-is-history-repeating-or-just-a-squeeze-play',
  'market-update-february-2026-investment-trends',
  'market-update-february-2026-ai-insights',
  'navigating-todays-financial-landscape',
  'the-2026-investors-dilemma-tuning-out-the-noise',
  'ai-spending-concerns-tech-stock-volatility',
  'the-fed-pivot-or-pause-decoding-interest-rate-expectations-for-2026-and-your-portfolio',
  'gold-and-silver-2026-good-investment',
  'navigating-the-bitcoin-crush-of-2026',
  'multi-angle-stock-analysis-explained',
  'ai-vs-human-stock-analysis-2026',
  'thematic-investing-101-guide-to-building-a-future-focused-portfolio',
  'navigating-the-next-wave-strategic-guide-to-investing-in-2026',
  'why-value-investing-is-making-a-comeback-in-2026',
  'etf-vs-individual-stocks-which-to-choose',
  'dollar-cost-averaging-vs-lump-sum',
  'dividend-investing-passive-income-guide',
  'stock-market-for-beginners-first-investment',
  'stock-market-crashes-how-to-prepare',
  'investing-in-your-30s-building-wealth',
  'growth-vs-value-investing-which-style',
  'best-stocks-to-buy-2026',
  'understanding-pe-ratio-valuation',
  'how-to-read-financial-statements-plain-english',
  'building-emergency-fund-before-investing',
  'tax-loss-harvesting-explained',
  'how-to-analyze-stocks-complete-guide',
  'sector-rotation-strategy-explained',
  'reits-for-beginners-real-estate-investing',
  'ai-stock-screener-comparison-2026',
  'stop-loss-orders-protect-or-hurt',
  'best-dividend-stocks-for-retirement',
  'how-to-invest-1000-dollars',
  'passive-income-stocks-monthly-dividends',
  'safe-stocks-for-beginners-low-risk',
  'best-etfs-to-buy-and-hold-forever',
  'hidden-dangers-ai-stock-analysis',
  'why-claritx-multi-angle-analysis',
  'ai-hallucinations-financial-data',
];

const TOP_STOCKS = [
  'A', 'AA', 'AAPL', 'ABBV', 'ABEV', 'ABNB', 'ABT', 'ACGL', 'ACHV', 'ACN',
  'ACP', 'ACWI', 'ACWX', 'ADBE', 'ADI', 'ADM', 'ADP', 'ADSK', 'ADX', 'AEE',
  'AEIS', 'AEM', 'AEP', 'AER', 'AFL', 'AFRM', 'AG', 'AGG', 'AGI', 'AIG',
  'AIO', 'AIRR', 'AJG', 'AKAM', 'AKRE', 'ALAB', 'ALB', 'ALC', 'ALGN', 'ALL',
  'ALLY', 'ALM', 'ALNY', 'AMAT', 'AMC', 'AMCR', 'AMD', 'AME', 'AMGN', 'AMKR',
  'AMLP', 'AMP', 'AMRZ', 'AMT', 'AMX', 'AMZN', 'ANET', 'AOD', 'AON', 'APA',
  'APD', 'APG', 'APH', 'APO', 'APOS', 'APP', 'APTV', 'AQNB', 'AR', 'ARCC',
  'ARES', 'ARGX', 'ARM', 'AS', 'ASGI', 'ASML', 'ASND', 'ASTS', 'ASX', 'ATCL',
  'ATI', 'ATO', 'AU', 'AVB', 'AVDE', 'AVDV', 'AVEM', 'AVGO', 'AVLV', 'AVUS',
  'AVUV', 'AVY', 'AWF', 'AWK', 'AXIA', 'AXON', 'AXP', 'AZN', 'AZO', 'B',
  'BA', 'BABA', 'BAC', 'BALL', 'BAM', 'BAP', 'BBD', 'BBDO', 'BBIO', 'BBN',
  'BBVA', 'BBY', 'BCAT', 'BCE', 'BCH', 'BCS', 'BCTK', 'BCX', 'BDJ', 'BDX',
  'BE', 'BEKE', 'BEN', 'BF', 'BG', 'BGB', 'BGY', 'BHK', 'BHP', 'BIDU',
  'BIIB', 'BIL', 'BINC', 'BIP', 'BIT', 'BITW', 'BIV', 'BJ', 'BK', 'BKLN',
  'BKMS', 'BKNG', 'BKR', 'BLD', 'BLK', 'BLV', 'BLW', 'BME', 'BMEZ', 'BMO',
  'BMOP', 'BMY', 'BN', 'BND', 'BNDX', 'BNS', 'BNT', 'BNTX', 'BOE', 'BOND',
  'BP', 'BPOPM', 'BR', 'BRK', 'BRO', 'BSAC', 'BSBR', 'BST', 'BSTZ', 'BSV',
  'BSX', 'BTI', 'BTO', 'BTT', 'BTX', 'BTZ', 'BUD', 'BUI', 'BURL', 'BWXT',
  'BX', 'BXMX', 'BXSL', 'C', 'CACI', 'CAH', 'CAR', 'CARR', 'CASY', 'CAT',
  'CB', 'CBC', 'CBRE', 'CCD', 'CCEP', 'CCI', 'CCJ', 'CCL', 'CDE', 'CDNS',
  'CDW', 'CEF', 'CEG', 'CF', 'CFG', 'CG', 'CGDV', 'CGGO', 'CGGR', 'CGUS',
  'CHD', 'CHI', 'CHKP', 'CHRW', 'CHT', 'CHTR', 'CHW', 'CHY', 'CI', 'CIB',
  'CIBR', 'CIEN', 'CII', 'CINF', 'CL', 'CLH', 'CLM', 'CLS', 'CLX', 'CM',
  'CMCSA', 'CME', 'CMG', 'CMI', 'CMS', 'CNC', 'CNH', 'CNI', 'CNP', 'CNQ',
  'COF', 'COHR', 'COIN', 'COKE', 'COO', 'COP', 'COR', 'COST', 'CP', 'CPAY',
  'CPNG', 'CPRT', 'CQP', 'CRBG', 'CRCL', 'CRDO', 'CRF', 'CRH', 'CRM', 'CRS',
  'CRWD', 'CRWV', 'CSCO', 'CSGP', 'CSL', 'CSQ', 'CSX', 'CTAS', 'CTRA', 'CTSH',
  'CTVA', 'CUK', 'CVE', 'CVNA', 'CVS', 'CVX', 'CW', 'CX', 'CYAB', 'D',
  'DAL', 'DASH', 'DB', 'DBEF', 'DD', 'DDOG', 'DE', 'DECK', 'DELL', 'DEO',
  'DFAC', 'DFAE', 'DFAI', 'DFAS', 'DFAT', 'DFAU', 'DFAX', 'DFCF', 'DFEM', 'DFIV',
  'DFRYF', 'DFUS', 'DFUV', 'DG', 'DGRO', 'DGRW', 'DGX', 'DHI', 'DHR', 'DIA',
  'DIAX', 'DIS', 'DKS', 'DLR', 'DLTR', 'DLY', 'DNP', 'DOV', 'DOW', 'DOX',
  'DPG', 'DPZ', 'DRI', 'DSL', 'DSU', 'DTE', 'DTM', 'DUHP', 'DUK', 'DUKB',
  'DUKH', 'DVN', 'DVY', 'DXCM', 'DYNF', 'E', 'EA', 'EBAY', 'EC', 'ECAT',
  'ECL', 'ED', 'EEM', 'EFA', 'EFX', 'EG', 'EIM', 'EIX', 'EL', 'ELV',
  'EMA', 'EMB', 'EMD', 'EME', 'EMO', 'EMR', 'EMXC', 'ENB', 'ENTG', 'EOG',
  'EOI', 'EOS', 'EP', 'EPD', 'EQIX', 'EQNR', 'EQR', 'EQT', 'EQX', 'ERIC',
  'ES', 'ESGD', 'ESGU', 'ESLT', 'ESS', 'ET', 'ETG', 'ETHA', 'ETJ', 'ETN',
  'ETO', 'ETR', 'ETV', 'ETW', 'ETY', 'EVR', 'EVRG', 'EVT', 'EVV', 'EW',
  'EWA', 'EWBC', 'EWJ', 'EWY', 'EWZ', 'EXAS', 'EXC', 'EXE', 'EXG', 'EXPD',
  'EXPE', 'EXR', 'F', 'FANG', 'FAST', 'FAX', 'FBND', 'FCNCA', 'FCNCN', 'FCX',
  'FDDMF', 'FDVV', 'FDX', 'FE', 'FER', 'FERG', 'FFC', 'FFIV', 'FICO', 'FIG',
  'FIS', 'FISV', 'FITB', 'FITBM', 'FIX', 'FLEX', 'FLUT', 'FMS', 'FMX', 'FN',
  'FNDA', 'FNDE', 'FNDF', 'FNDX', 'FNF', 'FNV', 'FOX', 'FOXA', 'FPF', 'FSLR',
  'FTAI', 'FTCS', 'FTEC', 'FTHY', 'FTI', 'FTNT', 'FTS', 'FTV', 'FUTU', 'FVD',
  'FWONA', 'FWONK', 'GAB', 'GBTC', 'GD', 'GDV', 'GDX', 'GDXJ', 'GE', 'GEHC',
  'GEN', 'GEV', 'GFI', 'GFL', 'GFS', 'GGG', 'GGN', 'GHY', 'GIB', 'GILD',
  'GIS', 'GLD', 'GLDM', 'GLPI', 'GLW', 'GM', 'GMAB', 'GME', 'GNRC', 'GOF',
  'GOOG', 'GOOGL', 'GPC', 'GPN', 'GRAB', 'GRAG', 'GRMN', 'GS', 'GSK', 'GSLC',
  'GTOP', 'GUG', 'GUT', 'GWRE', 'GWW', 'H', 'HAL', 'HAS', 'HBAN', 'HCA',
  'HD', 'HDB', 'HDV', 'HEI', 'HIG', 'HII', 'HL', 'HLN', 'HLT', 'HMC',
  'HOLX', 'HON', 'HOOD', 'HPE', 'HPQ', 'HRL', 'HSBC', 'HST', 'HSY', 'HTD',
  'HTHT', 'HUBB', 'HUBS', 'HUM', 'HWM', 'HYG', 'HYT', 'IAG', 'IAU', 'IBB',
  'IBIT', 'IBKR', 'IBM', 'IBN', 'ICE', 'IDEV', 'IDXX', 'IEF', 'IEI', 'IEMG',
  'IEUR', 'IEX', 'IFF', 'IFN', 'IGF', 'IGIB', 'IGM', 'IGR', 'IGSB', 'IHG',
  'IIM', 'IJH', 'IJJ', 'IJK', 'IJR', 'IJS', 'ILMN', 'IMO', 'INCY', 'INFY',
  'ING', 'INSM', 'INTC', 'INTU', 'INVH', 'IONQ', 'IOO', 'IOT', 'IP', 'IQI',
  'IQLT', 'IQV', 'IR', 'IREN', 'IRM', 'ISRG', 'ITOT', 'ITT', 'ITUB', 'ITW',
  'IUSB', 'IUSG', 'IUSV', 'IVE', 'IVV', 'IVW', 'IWB', 'IWD', 'IWF', 'IWM',
  'IWN', 'IWO', 'IWP', 'IWR', 'IWS', 'IWV', 'IWY', 'IX', 'IXN', 'IXUS',
  'IYW', 'J', 'JAAA', 'JBHT', 'JBL', 'JBS', 'JCI', 'JD', 'JEPI', 'JEPQ',
  'JFR', 'JGRO', 'JHX', 'JIRE', 'JLL', 'JNJ', 'JNK', 'JPC', 'JPM', 'JPST',
  'JQC', 'KB', 'KDP', 'KEP', 'KEY', 'KEYS', 'KGC', 'KHC', 'KIM', 'KKR',
  'KKRS', 'KLAC', 'KMB', 'KMI', 'KO', 'KOF', 'KR', 'KRMN', 'KSPI', 'KTOS',
  'KVUE', 'KYN', 'L', 'LACG', 'LAMR', 'LCID', 'LDOS', 'LDP', 'LECO', 'LEN',
  'LH', 'LHX', 'LI', 'LII', 'LIN', 'LITE', 'LLY', 'LMRI', 'LMT', 'LNG',
  'LNT', 'LOGI', 'LOW', 'LPLA', 'LQD', 'LRCX', 'LSCC', 'LTM', 'LULU', 'LUV',
  'LVS', 'LYB', 'LYG', 'LYV', 'MA', 'MAA', 'MAR', 'MAS', 'MBB', 'MCD',
  'MCHI', 'MCHP', 'MCK', 'MCO', 'MDB', 'MDLN', 'MDLZ', 'MDT', 'MDY', 'MEDP',
  'MEGI', 'MELI', 'MER', 'MET', 'META', 'MFC', 'MFG', 'MGA', 'MGC', 'MGK',
  'MGV', 'MHD', 'MINT', 'MKC', 'MKL', 'MKSI', 'MLI', 'MLM', 'MMED', 'MMM',
  'MMU', 'MNST', 'MO', 'MPC', 'MPLX', 'MPT', 'MPWR', 'MQY', 'MRK', 'MRNA',
  'MRSH', 'MRVL', 'MS', 'MSCI', 'MSFT', 'MSI', 'MSTR', 'MT', 'MTB', 'MTD',
  'MTSI', 'MTZ', 'MU', 'MUB', 'MUC', 'MUFG', 'MUJ', 'MYI', 'NAC', 'NAD',
  'NBIS', 'NBIX', 'NBXG', 'NDAQ', 'NDMO', 'NDSN', 'NEA', 'NEE', 'NEM', 'NET',
  'NFJ', 'NFLX', 'NGG', 'NI', 'NIE', 'NIO', 'NKE', 'NKX', 'NLR', 'NLY',
  'NMCO', 'NML', 'NMR', 'NMZ', 'NOC', 'NOK', 'NOW', 'NRG', 'NRK', 'NSC',
  'NTAP', 'NTES', 'NTR', 'NTRA', 'NTRS', 'NU', 'NUE', 'NUV', 'NVDA', 'NVG',
  'NVMI', 'NVO', 'NVS', 'NVT', 'NWG', 'NWS', 'NWSA', 'NXJ', 'NXPI', 'NXT',
  'NYT', 'NZF', 'O', 'OAKI', 'ODFL', 'OEF', 'OHI', 'OKE', 'OKTA', 'OMC',
  'ON', 'ONC', 'ONEQ', 'ONON', 'ONTO', 'ORCL', 'ORLY', 'OTIS', 'OVV', 'OWL',
  'OXY', 'P', 'PAA', 'PAAA', 'PAAS', 'PAC', 'PANW', 'PAXS', 'PAYP', 'PAYX',
  'PBA', 'PBR', 'PBT', 'PCAR', 'PCG', 'PCN', 'PCQ', 'PDD', 'PDI', 'PDO',
  'PDT', 'PDX', 'PEG', 'PEN', 'PEO', 'PEP', 'PFE', 'PFF', 'PFG', 'PFGC',
  'PFH', 'PFN', 'PG', 'PGR', 'PH', 'PHG', 'PHK', 'PHM', 'PHYS', 'PKG',
  'PKX', 'PLD', 'PLTR', 'PM', 'PMI', 'PML', 'PNC', 'PNR', 'PODD', 'PPA',
  'PPG', 'PPL', 'PPLC', 'PR', 'PRF', 'PRU', 'PSA', 'PSKY', 'PSLV', 'PSTG',
  'PSX', 'PTA', 'PTC', 'PTY', 'PUK', 'PULS', 'PWR', 'PYLD', 'PYPL', 'Q',
  'QCOM', 'QLD', 'QQQ', 'QQQM', 'QQQX', 'QSR', 'QXO', 'QYLD', 'RA', 'RACE',
  'RBA', 'RBC', 'RBLX', 'RCI', 'RCL', 'RDDT', 'RDVY', 'REG', 'REGN', 'RELX',
  'RF', 'RGA', 'RGC', 'RGLD', 'RIO', 'RIVN', 'RJF', 'RKLB', 'RKT', 'RL',
  'RMBS', 'RMD', 'RMT', 'RNP', 'ROIV', 'ROK', 'ROKU', 'ROL', 'ROP', 'ROST',
  'RPM', 'RPRX', 'RQI', 'RRX', 'RS', 'RSG', 'RSP', 'RTO', 'RTX', 'RVMD',
  'RVT', 'RWL', 'RY', 'RYAAY', 'SAN', 'SAP', 'SATA', 'SATS', 'SBAC', 'SBR',
  'SBS', 'SBUX', 'SCCO', 'SCD', 'SCHA', 'SCHB', 'SCHD', 'SCHE', 'SCHF', 'SCHG',
  'SCHH', 'SCHI', 'SCHM', 'SCHO', 'SCHP', 'SCHR', 'SCHV', 'SCHW', 'SCHX', 'SCHZ',
  'SCZ', 'SDVY', 'SDY', 'SE', 'SGI', 'SGOL', 'SGOV', 'SHEL', 'SHG', 'SHOP',
  'SHV', 'SHW', 'SHY', 'SHYG', 'SITM', 'SKM', 'SLB', 'SLF', 'SLV', 'SMCI',
  'SMFG', 'SMH', 'SMMT', 'SN', 'SNA', 'SNDK', 'SNN', 'SNOW', 'SNPS', 'SNX',
  'SNY', 'SO', 'SOFI', 'SOJD', 'SOJE', 'SOMN', 'SONY', 'SOXL', 'SOXX', 'SPAB',
  'SPDW', 'SPEM', 'SPFIX', 'SPG', 'SPGI', 'SPHQ', 'SPHY', 'SPIB', 'SPLG', 'SPLV',
  'SPMD', 'SPMO', 'SPOT', 'SPPP', 'SPSB', 'SPSM', 'SPTI', 'SPTL', 'SPTM', 'SPY',
  'SPYG', 'SPYV', 'SQM', 'SRE', 'SREA', 'SSNC', 'SSO', 'STE', 'STEW', 'STIP',
  'STK', 'STLA', 'STLD', 'STM', 'STRC', 'STRD', 'STRF', 'STRK', 'STRL', 'STT',
  'STX', 'STZ', 'SU', 'SUB', 'SUI', 'SUNB', 'SUZ', 'SW', 'SWK', 'SYF',
  'SYK', 'SYM', 'SYY', 'T', 'TAK', 'TBB', 'TBLD', 'TCOM', 'TCPA', 'TD',
  'TDG', 'TDY', 'TEAM', 'TECK', 'TEL', 'TER', 'TEVA', 'TFC', 'TFJL', 'TGT',
  'THC', 'THQ', 'THW', 'TIGO', 'TIP', 'TJX', 'TKO', 'TLH', 'TLK', 'TLN',
  'TLT', 'TM', 'TME', 'TMO', 'TMUS', 'TOL', 'TOST', 'TPG', 'TPL', 'TPR',
  'TPTA', 'TQQQ', 'TRGP', 'TRI', 'TRMB', 'TROW', 'TRP', 'TRU', 'TRV', 'TS',
  'TSCO', 'TSEM', 'TSLA', 'TSM', 'TSN', 'TT', 'TTD', 'TTE', 'TTMI', 'TTWO',
  'TU', 'TVTX', 'TW', 'TWLO', 'TWN', 'TXN', 'TXT', 'TYL', 'UAL', 'UBER',
  'UBS', 'UHS', 'UI', 'UL', 'ULS', 'ULTA', 'UMC', 'UNH', 'UNP', 'UPS',
  'URI', 'URTH', 'USA', 'USAR', 'USB', 'USFD', 'USFR', 'USIG', 'USO', 'UTF',
  'UTG', 'UTHR', 'V', 'VALE', 'VB', 'VBK', 'VBR', 'VCIT', 'VCLT', 'VCSH',
  'VCV', 'VDC', 'VDE', 'VEA', 'VEEV', 'VEU', 'VFH', 'VG', 'VGIT', 'VGK',
  'VGLT', 'VGM', 'VGSH', 'VGT', 'VHT', 'VICI', 'VIG', 'VIGI', 'VIK', 'VIS',
  'VIV', 'VKQ', 'VLN', 'VLO', 'VLTO', 'VMBS', 'VMC', 'VMO', 'VNOM', 'VNQ',
  'VO', 'VOD', 'VOE', 'VONE', 'VONG', 'VONV', 'VOO', 'VOOG', 'VOT', 'VPL',
  'VPU', 'VRSK', 'VRSN', 'VRT', 'VRTX', 'VSS', 'VST', 'VT', 'VTEB', 'VTI',
  'VTIP', 'VTR', 'VTRS', 'VTV', 'VTWO', 'VUG', 'VV', 'VVR', 'VWO', 'VXF',
  'VXUS', 'VYM', 'VYMI', 'VZ', 'WAB', 'WASH', 'WAT', 'WBD', 'WCC', 'WCN',
  'WDAY', 'WDC', 'WDI', 'WDS', 'WEC', 'WELL', 'WES', 'WF', 'WFC', 'WIT',
  'WIW', 'WLK', 'WM', 'WMB', 'WMG', 'WMT', 'WPC', 'WPM', 'WRB', 'WSM',
  'WSO', 'WST', 'WTW', 'WWD', 'WY', 'XEL', 'XELLL', 'XLC', 'XLE', 'XLF',
  'XLG', 'XLI', 'XLK', 'XLP', 'XLRE', 'XLU', 'XLV', 'XLY', 'XNDU', 'XOM',
  'XPEV', 'XPO', 'XYL', 'XYZ', 'YPF', 'YUM', 'YUMC', 'ZBH', 'ZM', 'ZS',
  'ZTO', 'ZTS',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Safe embedding inside <script type="application/ld+json">
const ldJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

const titleCase = (slug) =>
  slug.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

const absUrl = (u) => {
  if (!u) return DEFAULT_OG_IMAGE;
  if (u.startsWith('http')) return u;
  return `${BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
};

function mdInline(s) {
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

// Minimal markdown → HTML for build-time content injection. Only needs to be
// crawler-readable — React replaces #root on mount.
function mdToHtml(md) {
  const out = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${mdInline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  for (const raw of String(md).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)/);
    if (h) {
      flushPara();
      flushList();
      // Never emit a second h1 — the post title is the page's only h1
      const level = Math.min(Math.max(h[1].length, 2), 4);
      out.push(`<h${level}>${mdInline(h[2])}</h${level}>`);
      continue;
    }
    const li = line.match(/^([-*]|\d+\.)\s+(.*)/);
    if (li) {
      flushPara();
      const type = /^\d/.test(li[1]) ? 'ol' : 'ul';
      if (list !== type) {
        flushList();
        out.push(`<${type}>`);
        list = type;
      }
      out.push(`<li>${mdInline(li[2])}</li>`);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return out.join('\n');
}

const breadcrumbLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name,
    item: `${BASE_URL}${path}`,
  })),
});

/**
 * Rewrites the template head for one route: title, description, OG/Twitter,
 * self-canonical, optional noindex, JSON-LD blocks, and #root body content.
 */
function applyHead(template, { path, title, description, ogType = 'website', ogImage = DEFAULT_OG_IMAGE, noindex = false, jsonLd = [], bodyHtml = '' }) {
  const url = `${BASE_URL}${path}`;
  const t = esc(title);
  const d = esc(description);
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta property="og:type" content=")[^"]*(")/, `$1${ogType}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(ogImage)}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta name="twitter:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${esc(ogImage)}$2`)
    // \/? — browser-serialized HTML (prerendered template) drops the XHTML slash
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`);
  if (path !== '/' && html.includes(`<link rel="canonical" href="${BASE_URL}/"`)) {
    throw new Error(`canonical rewrite failed for ${path} — template markup changed?`);
  }
  if (noindex) {
    html = html
      .replace(/(<meta name="robots" content=")[^"]*(")/, '$1noindex, nofollow$2')
      .replace(/(<meta name="googlebot" content=")[^"]*(")/, '$1noindex, nofollow$2')
      .replace(/(<meta name="bingbot" content=")[^"]*(")/, '$1noindex, nofollow$2');
  }
  if (jsonLd.length) {
    const blocks = jsonLd
      .map((o) => `<script type="application/ld+json">${ldJson(o)}</script>`)
      .join('\n    ');
    html = html.replace('</head>', `    ${blocks}\n  </head>`);
  }
  if (bodyHtml) {
    html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
  }
  return html;
}

function blogJsonLd(post, path) {
  const url = `${BASE_URL}${path}`;
  const posting = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.meta_description || post.excerpt || '',
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Organization', name: post.author || 'ClaritX Research Team', url: BASE_URL },
    publisher: { '@id': `${BASE_URL}/#organization` },
    image: absUrl(post.image_url),
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    isFamilyFriendly: true,
  };
  if (post.published_at) {
    posting.datePublished = post.published_at;
    posting.dateModified = post.published_at;
  }
  if (Array.isArray(post.tags) && post.tags.length) posting.keywords = post.tags.join(', ');
  return [posting, breadcrumbLd([['Home', '/'], ['Blog', '/blog'], [post.title, path]])];
}

function blogBodyHtml(post) {
  const date = String(post.published_at || '').slice(0, 10);
  const img = post.image_url
    ? `<img src="${esc(absUrl(post.image_url))}" alt="${esc(post.title)}" loading="lazy" />`
    : '';
  const contentHtml = post.content
    ? mdToHtml(post.content)
    : `<p>${esc(post.excerpt || post.meta_description || '')}</p>`;
  return [
    '<article>',
    '<nav><a href="/">Home</a> › <a href="/blog">Blog</a></nav>',
    `<h1>${esc(post.title)}</h1>`,
    `<p>By ${esc(post.author || 'ClaritX Research Team')}${date ? ` · <time datetime="${date}">${date}</time>` : ''}</p>`,
    img,
    contentHtml,
    // Crawler-visible internal links on EVERY post (incl. older ones whose body
    // lacks a "Related Tools" block) — concentrates crawl equity on the money
    // pages and gives non-JS crawlers a path through the site (no dead ends).
    '<aside><h2>Put this into action — free</h2>'
      + '<p><strong>Before you buy any stock mentioned here, check it yourself:</strong> '
      + '<a href="/ai-stock-analysis">run a free 9-perspective AI analysis on any ticker</a> '
      + '— news sentiment, technicals, financials, analyst ratings and a clear verdict in seconds.</p>'
      + '<ul>'
      + '<li><a href="/ai-stock-rank">AI Stock Screener &amp; Rankings — find the top-rated stocks, ETFs &amp; funds</a></li>'
      + '<li><a href="/portfolio-simulator">Build a portfolio with the free AI simulator</a></li>'
      + '<li><a href="/blog">More investing guides on the ClaritX blog</a></li>'
      + '</ul></aside>',
    '</article>',
  ].join('\n');
}

// Redirect stub for retired duplicate slugs — canonical + meta refresh until a
// real 301 rule is added in the Amplify/Cloudflare console.
function redirectStub(targetPath) {
  const target = `${BASE_URL}${targetPath}`;
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<title>Redirecting…</title>',
    `<link rel="canonical" href="${target}">`,
    '<meta name="robots" content="noindex">',
    `<meta http-equiv="refresh" content="0;url=${targetPath}">`,
    '</head>',
    `<body><p>This article has moved: <a href="${target}">${target}</a></p></body>`,
    '</html>',
    '',
  ].join('\n');
}

// Best-effort extraction of {slug → title/metaDescription} from the bundled
// blogPosts.ts, so local-only posts get real titles in their fallback heads.
function parseLocalBlogMeta() {
  const map = new Map();
  try {
    const src = readFileSync(join(__dirname, '..', 'src', 'data', 'blogPosts.ts'), 'utf-8');
    const slugRe = /slug:\s*"([^"]+)"/g;
    const positions = [];
    let m;
    while ((m = slugRe.exec(src))) positions.push({ slug: m[1], start: m.index });
    for (let i = 0; i < positions.length; i++) {
      const { slug, start } = positions[i];
      const end = i + 1 < positions.length ? positions[i + 1].start : src.length;
      const chunk = src.slice(start, end);
      const title = chunk.match(/title:\s*"([^"]+)"/)?.[1];
      const desc = chunk.match(/metaDescription:\s*"([^"]+)"/)?.[1];
      if (title) map.set(slug, { title, description: desc || '' });
    }
  } catch {
    /* fall back to slug-derived titles */
  }
  return map;
}

async function fetchJSON(path, timeoutMs = 15000) {
  const resp = await fetch(`${API_URL}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// Retry wrapper for the critical list fetches. A single slow/cold Lambda
// response previously caused the build to silently fall back to the ~190
// hardcoded slugs, so every database blog post shipped without a file (served
// the homepage shell). Retry with backoff + a generous timeout instead.
async function fetchJSONRetry(path, { timeoutMs = 30000, attempts = 4 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJSON(path, timeoutMs);
    } catch (err) {
      lastErr = err;
      console.log(`[fallbacks] fetch ${path} attempt ${i + 1}/${attempts} failed: ${err.message}`);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr;
}

async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(INDEX_HTML)) {
    console.error('dist/index.html not found — run npm run build first');
    process.exit(1);
  }

  const template = await readFile(INDEX_HTML, 'utf-8');
  for (const anchor of ['<title>', 'rel="canonical"', 'name="description"', 'property="og:url"']) {
    if (!template.includes(anchor)) {
      console.error(`[fallbacks] FATAL: index.html is missing head anchor: ${anchor} — head rewriting would silently fail`);
      process.exit(1);
    }
  }
  // Body content injection needs the empty root div. After prerender has
  // overwritten index.html (rerun scenario) it's gone — heads still get fixed,
  // only the article-content injection is skipped.
  const canInjectBody = template.includes('<div id="root"></div>');
  if (!canInjectBody) {
    console.warn('[fallbacks] WARN: #root is not empty (prerendered index.html?) — skipping article content injection, heads only');
  }

  const localMeta = parseLocalBlogMeta();

  // 1. Blog post metadata: live API if reachable, else the committed snapshot.
  // Either way every known DB post gets a file — the build no longer depends on
  // reaching the API (that dependency is what shipped homepage copies before).
  let apiPosts = [];
  try {
    apiPosts = await fetchJSONRetry('/blogs?limit=500');
    console.log(`[fallbacks] Fetched ${apiPosts.length} blog posts (metadata) from API`);
  } catch (err) {
    console.error(`[fallbacks] /blogs unreachable after retries (${err.message}) — `
      + `falling back to committed snapshot (${BLOG_SNAPSHOT.length} posts)`);
  }
  // Seed from the snapshot first, then overlay fresher live data on top.
  const postsBySlug = new Map(BLOG_SNAPSHOT.map((p) => [p.slug, { ...p }]));
  for (const p of apiPosts) postsBySlug.set(p.slug, { ...postsBySlug.get(p.slug), ...p });
  if (!postsBySlug.size) {
    console.error('[fallbacks] FATAL: no blog posts from API or snapshot — refusing to ship.');
    process.exit(1);
  }
  for (const slug of BUNDLED_BLOG_SLUGS) {
    if (!postsBySlug.has(slug)) {
      const lm = localMeta.get(slug);
      postsBySlug.set(slug, {
        slug,
        title: lm?.title || titleCase(slug),
        meta_description: lm?.description || '',
        excerpt: lm?.description || '',
      });
    }
  }
  for (const oldSlug of Object.keys(BLOG_REDIRECTS)) postsBySlug.delete(oldSlug);

  // 2. Full article content per post (skippable via SKIP_BLOG_CONTENT=1).
  // Iterate postsBySlug so snapshot-sourced posts also get content when the API
  // is reachable per-post; a failed fetch just leaves that post meta-only.
  if (process.env.SKIP_BLOG_CONTENT !== '1') {
    const slugs = [...postsBySlug.keys()].filter((s) => !BLOG_REDIRECTS[s]);
    let ok = 0;
    await mapLimit(slugs, 6, async (slug) => {
      try {
        const full = await fetchJSON(`/blogs/${encodeURIComponent(slug)}`);
        if (full?.content) {
          Object.assign(postsBySlug.get(slug), full);
          ok++;
        }
      } catch {
        /* this post ships meta-only — still has correct head tags */
      }
    });
    console.log(`[fallbacks] Injected full article content for ${ok}/${slugs.length} posts`);
  }

  // 3. Stock symbols: bundled + live API list
  const stockSet = new Set(TOP_STOCKS);
  try {
    const data = await fetchJSONRetry('/sitemap-entries');
    for (const s of data.stocks || []) stockSet.add(typeof s === 'string' ? s : s.symbol);
    console.log(`[fallbacks] Stock symbols: ${stockSet.size} (bundled + API)`);
  } catch (err) {
    console.log(`[fallbacks] /sitemap-entries unreachable (${err.message}) — using bundled stock list`);
  }

  let written = 0;
  // All routes are written as dist/path.html (flat file, no directory index.html).
  // A physical file at /blog/slug.html serves /blog/slug with a 200 — no
  // trailing-slash 301 from S3/Cloudflare.
  const writeRoute = async (route, html) => {
    const target = join(DIST_DIR, route.slice(1) + '.html');
    const dir = dirname(target);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    await writeFile(target, html, 'utf-8');
    written++;
  };

  // Static routes (private ones get noindex)
  for (const route of STATIC_ROUTES) {
    const isPrivate = PRIVATE_ROUTES.has(route);
    const meta = ROUTE_META[route];
    const title = meta?.title || `${titleCase(route.split('/').pop())} | ClaritX`;
    const description = meta?.description || 'AI-powered stock market research and portfolio tools — free for educational purposes.';
    await writeRoute(route, applyHead(template, { path: route, title, description, noindex: isPrivate }));
  }

  // Blog posts — full head + JSON-LD + article content
  for (const [slug, post] of postsBySlug) {
    const path = `/blog/${slug}`;
    const ov = SEO_OVERRIDES[slug] || {};
    // An override title is final/verbatim (kept <=60 chars, leads with the won
    // query); otherwise fall back to the post title + brand suffix.
    const title = ov.title
      ? ov.title
      : (post.title.includes('ClaritX') ? post.title : `${post.title} | ClaritX`);
    const description = ov.description
      || post.meta_description || post.excerpt
      || `${post.title} — AI-assisted market research from ClaritX.`;
    await writeRoute(path, applyHead(template, {
      path,
      title,
      description,
      ogType: 'article',
      ogImage: absUrl(post.image_url),
      jsonLd: blogJsonLd(post, path),
      bodyHtml: canInjectBody ? blogBodyHtml(post) : '',
    }));
  }

  // Redirect stubs for retired duplicate slugs
  for (const [oldSlug, newSlug] of Object.entries(BLOG_REDIRECTS)) {
    await writeRoute(`/blog/${oldSlug}`, redirectStub(`/blog/${newSlug}`));
  }

  // Stock pages — correct head + breadcrumb schema
  for (const sym of stockSet) {
    const path = `/stocks/${sym}`;
    await writeRoute(path, applyHead(template, {
      path,
      title: `${sym} Deep Research - Multi-Angle AI Overview | ClaritX`,
      description: `AI-powered deep research for ${sym}: news sentiment, technical signals, financials, analyst ratings, peer comparison and more — 9 perspectives, free on ClaritX.`,
      jsonLd: [breadcrumbLd([['Home', '/'], ['Stocks', '/stocks'], [sym, path]])],
    }));
  }

  console.log(`[fallbacks] Done — wrote ${written} SEO fallback files (${postsBySlug.size} blog posts, ${Object.keys(BLOG_REDIRECTS).length} redirect stubs, ${stockSet.size} stocks).`);
}

main().catch((err) => {
  console.error('[fallbacks] FATAL:', err);
  process.exit(1);
});
