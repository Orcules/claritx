# SEO Pre-rendering Guide for ClaritX

## The Problem

ClaritX is a client-side rendered (CSR) React Single Page Application. When search engine crawlers visit the site, they initially see:

```html
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

The actual content only appears after JavaScript executes. While Google **can** render JavaScript, it:

1. Has a **limited rendering budget** per domain
2. Prioritizes **high-authority domains** for rendering resources
3. May take **days or weeks** to get JavaScript rendered
4. Might never fully render pages on new/low-authority domains

## The Solution: Static Pre-rendering

We use **build-time pre-rendering** to generate static HTML files for SEO-critical routes. After pre-rendering:

```html
<body>
  <div id="root">
    <header>ClaritX Navigation...</header>
    <main>
      <h1>Best Stocks to Buy in 2026</h1>
      <article>Full content visible to crawlers...</article>
    </main>
    <footer>...</footer>
  </div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

Googlebot sees the full content immediately. React then "hydrates" the page for interactivity.

## Pre-rendered Routes

The following routes are pre-rendered at build time:

### Static Pages
- `/` (Homepage)
- `/blog` (Blog listing)
- `/ai-stock-rank` (AI Stock Rankings)
- `/portfolio-builder` (Portfolio Builder)
- `/portfolio-analysis` (Portfolio Analysis)
- `/disclaimer`
- `/privacy-policy`
- `/terms-of-service`
- `/auth` (Login/Signup)

### Blog Posts
- `/blog/best-stocks-to-buy-2026`
- `/blog/how-to-analyze-stocks-complete-guide`
- `/blog/ai-stock-screener-comparison-2026`
- `/blog/hidden-dangers-ai-stock-analysis`
- `/blog/why-claritx-multi-angle-analysis`
- `/blog/ai-hallucinations-financial-data`

## Routes NOT Pre-rendered

Dynamic pages that require authentication or user input remain CSR:

- `/ranking-dashboard` (requires auth)
- `/user-dashboard` (requires auth)
- `/activity-logs` (requires auth)
- `/risk-assessment/:token` (dynamic tokens)
- Stock analysis results (generated on-demand)

## How It Works

### Build Process

1. **Vite builds the React app** → Creates `dist/` folder
2. **Preview server starts** → Serves the built app locally
3. **Puppeteer renders each route** → Captures the fully rendered HTML
4. **HTML files are saved** → Each route gets its own `index.html`

### File Structure After Pre-rendering

```
dist/
├── index.html                          # Pre-rendered homepage
├── blog/
│   ├── index.html                      # Pre-rendered blog listing
│   ├── best-stocks-to-buy-2026/
│   │   └── index.html                  # Pre-rendered blog post
│   └── ...
├── ai-stock-rank/
│   └── index.html                      # Pre-rendered AI rankings
└── ...
```

## Adding New Pre-rendered Routes

### Adding a New Blog Post

1. Add the blog post to `src/data/blogPosts.ts`
2. Add the route to:
   - `vite.config.ts` → `prerenderRoutes` array
   - `scripts/prerender.js` → `routes` array
   - `public/sitemap.xml`
3. Rebuild the project

### Adding a New Static Page

1. Create the page component in `src/pages/`
2. Add the route to `src/App.tsx`
3. Add to pre-render configuration (same files as above)
4. Add to `public/sitemap.xml`

## Running Pre-rendering Locally

```bash
# Build the project
npm run build

# Start preview server
npm run preview &

# Run pre-rendering script
node scripts/prerender.js

# Stop preview server
kill %1
```

## CI/CD Integration

Add to your deployment pipeline:

```yaml
build:
  - npm run build
  - npm run preview &
  - sleep 5
  - node scripts/prerender.js
  - # Deploy dist/ folder
```

## Verification

After pre-rendering, verify the output:

1. **Check file exists**: `ls dist/blog/best-stocks-to-buy-2026/index.html`
2. **Check content**: `grep -o "<h1>.*</h1>" dist/blog/best-stocks-to-buy-2026/index.html`
3. **Test with curl**: `curl -s https://claritx.ai/blog/best-stocks-to-buy-2026 | head -100`

## SEO Benefits

1. **Immediate Indexability**: Content visible on first crawl
2. **Faster Indexing**: No waiting for JavaScript rendering queue
3. **Better Crawl Budget**: Google can crawl more pages in less time
4. **Rich Snippets**: Structured data visible without rendering
5. **Core Web Vitals**: Faster First Contentful Paint (FCP)

## Troubleshooting

### Pre-render fails with timeout
- Increase timeout in `scripts/prerender.js`
- Check if the page has infinite loading states

### Content missing after pre-render
- Ensure `waitUntil: 'networkidle0'` is set
- Add explicit waits for async content

### Routes not found
- Verify the route exists in `src/App.tsx`
- Check the preview server is running

## Resources

- [Google's JavaScript SEO Basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Vite Documentation](https://vitejs.dev/)
- [Puppeteer Documentation](https://pptr.dev/)
