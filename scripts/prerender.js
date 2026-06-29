/**
 * Post-build pre-rendering script for SEO optimization.
 * 
 * This script runs after the Vite build and generates static HTML
 * for all SEO-critical routes. The generated HTML contains the full
 * page content, making it immediately crawlable by search engines
 * without requiring JavaScript execution.
 * 
 * Usage: node scripts/prerender.js
 * 
 * Note: This script requires a local server to be running on the build output.
 * It's designed to be run as part of the CI/CD pipeline.
 */

import puppeteer from 'puppeteer';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RAW_API_URL = process.env.VITE_AWS_API_URL || '';
const API_URL = RAW_API_URL.startsWith('http') ? RAW_API_URL : 'https://your-api-id.execute-api.us-east-1.amazonaws.com/prod';

// Base routes to pre-render (always included)
const STATIC_ROUTES = [
  '/',
  '/blog',
  '/ai-stock-rank',
  '/ai-stock-analysis',
  '/ai-stock-analysis-guide',
  '/buffett-indicator',
  '/market-opportunities',
  '/portfolio-simulator',
  '/pricing',
  '/about',
  '/contact',
  '/stocks',
  '/disclaimer',
  '/privacy',
  '/terms',
];

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

async function buildRouteList() {
  // Prerender only static pages — blog/stock pages are covered by
  // generate-spa-fallbacks.js (flat index.html copies). Rendering
  // 1400+ pages with Puppeteer exceeds Amplify build time limits.
  return [...STATIC_ROUTES];
}

const DIST_DIR = join(__dirname, '..', 'dist');
const BASE_URL = process.env.PRERENDER_URL || 'http://localhost:4173';

async function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function prerenderRoute(browser, route) {
  const page = await browser.newPage();
  const url = `${BASE_URL}${route}`;
  
  console.log(`Pre-rendering: ${route}`);
  
  try {
    // Navigate to the page and wait for network to be idle
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 45000, // Increased for stock pages with data fetching
    });

    // Wait for React to hydrate
    await page.waitForSelector('#root > *', { timeout: 10000 });
    
    // Wait for SEOHead component to update document.title and meta tags
    // This is crucial - the SEOHead component uses useEffect which runs after mount
    await page.waitForFunction(() => {
      const title = document.title;
      const description = document.querySelector('meta[name="description"]');
      const canonical = document.querySelector('link[rel="canonical"]');
      // Check that SEOHead has updated the page (title shouldn't be the default)
      return title && 
             !title.includes('Vite + React') && 
             description?.getAttribute('content') &&
             canonical?.getAttribute('href');
    }, { timeout: 10000 });
    
    // Additional wait for any remaining async content
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get the rendered HTML
    const html = await page.content();

    // All routes write to dist/path.html (flat, no directory index.html).
    // S3 serves /blog/slug from blog/slug.html with a 200 — no redirect.
    // This prevents Cloudflare/S3 from adding a trailing-slash 301.
    let outputPath;
    if (route === '/') {
      outputPath = join(DIST_DIR, 'index.html');
    } else {
      // /blog/slug → dist/blog/slug.html
      // /pricing   → dist/pricing.html
      outputPath = join(DIST_DIR, route.slice(1) + '.html');
    }

    await ensureDir(outputPath);
    await writeFile(outputPath, html, 'utf-8');
    
    console.log(`  ✓ Saved: ${outputPath}`);
    console.log(`    Title: ${await page.title()}`);
  } catch (error) {
    console.error(`  ✗ Failed to pre-render ${route}:`, error.message);
  } finally {
    await page.close();
  }
}

async function main() {
  const routes = await buildRouteList();

  console.log('Starting pre-rendering process...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output directory: ${DIST_DIR}`);
  console.log(`Routes to render: ${routes.length}\n`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  } catch (err) {
    // Surface the real reason (usually Chrome missing on the CI image) instead
    // of dying silently — the SEO fallbacks from generate-spa-fallbacks.js
    // already carry correct heads, so this failure is non-fatal but must be loud.
    console.error('\n✗ Puppeteer failed to launch Chrome:', err.message);
    console.error('  Hint: ensure "npx puppeteer browsers install chrome" ran in preBuild');
    console.error('  (PUPPETEER_CACHE_DIR should point inside a cached path).');
    process.exit(1);
  }

  try {
    for (const route of routes) {
      await prerenderRoute(browser, route);
    }
  } finally {
    await browser.close();
  }

  console.log('\n✓ Pre-rendering complete!');
  console.log(`  Pre-rendered ${routes.length} routes for SEO optimization.`);
}

main().catch((err) => {
  console.error('✗ Prerender failed:', err);
  process.exit(1);
});
