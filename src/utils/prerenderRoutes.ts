/**
 * Pre-render routes configuration for SEO optimization.
 * These routes will be statically generated at build time,
 * making them immediately crawlable by search engines without JavaScript rendering.
 */

import { blogPosts } from "@/data/blogPosts";

// Static routes that should always be pre-rendered
const staticRoutes = [
  "/",
  "/blog",
  "/ai-stock-rank",
  "/ai-stock-analysis",
  "/ai-stock-analysis-guide",
  "/market-opportunities",
  "/portfolio-simulator",
  "/pricing",
  "/about",
  "/stocks",
  "/disclaimer",
  "/privacy",
  "/terms",
];

// Top 50 stocks by market cap for prerendering
const topStockRoutes = [
  "/stocks/AAPL", "/stocks/MSFT", "/stocks/GOOGL", "/stocks/GOOG", "/stocks/AMZN",
  "/stocks/NVDA", "/stocks/META", "/stocks/TSLA", "/stocks/BRK-B", "/stocks/UNH",
  "/stocks/LLY", "/stocks/JPM", "/stocks/XOM", "/stocks/V", "/stocks/JNJ",
  "/stocks/WMT", "/stocks/MA", "/stocks/PG", "/stocks/HD", "/stocks/AVGO",
  "/stocks/CVX", "/stocks/MRK", "/stocks/ORCL", "/stocks/ABBV", "/stocks/PEP",
  "/stocks/KO", "/stocks/COST", "/stocks/ADBE", "/stocks/CRM", "/stocks/AMD",
  "/stocks/MCD", "/stocks/TMO", "/stocks/CSCO", "/stocks/BAC", "/stocks/NFLX",
  "/stocks/ACN", "/stocks/ABT", "/stocks/LIN", "/stocks/DHR", "/stocks/TMUS",
  "/stocks/WFC", "/stocks/TXN", "/stocks/PM", "/stocks/INTC", "/stocks/AMGN",
  "/stocks/NEE", "/stocks/COP", "/stocks/HON", "/stocks/IBM", "/stocks/NKE",
];

// Generate blog post routes dynamically from blogPosts data
const getBlogPostRoutes = (): string[] => {
  return blogPosts.map((post) => `/blog/${post.slug}`);
};

// Combine all routes for pre-rendering
export const getPrerenderRoutes = (): string[] => {
  return [...staticRoutes, ...topStockRoutes, ...getBlogPostRoutes()];
};

// Export for use in vite config (needs to be synchronous for config)
// Uses dynamic blogPosts import so new posts are automatically included
export const prerenderRoutes = getPrerenderRoutes();
