/**
 * AI Stock Analysis Content Cluster
 * 
 * This file defines the content cluster structure for the "AI Stock Analysis" topic.
 * All articles in this cluster are interlinked and connect to the pillar page.
 */

export interface ClusterArticle {
  slug: string;
  title: string;
  excerpt: string;
  category: 'pillar' | 'depth' | 'supporting';
  relatedSlugs: string[];
  stockLinks: string[];
  toolLinks: string[];
}

export const AI_STOCK_ANALYSIS_CLUSTER: ClusterArticle[] = [
  {
    slug: "ai-stock-analysis-guide",
    title: "What Is AI Stock Analysis? Ultimate Guide 2026",
    excerpt: "Complete guide to AI stock analysis: how it works, accuracy, limitations, and best practices.",
    category: "pillar",
    relatedSlugs: [
      "ai-vs-human-stock-analysis",
      "multi-angle-stock-analysis",
      "ai-hallucinations-financial-data",
      "how-to-trust-ai-stock-scores",
      "ai-stock-screener-comparison-2026",
      "hidden-dangers-ai-stock-analysis",
      "why-claritx-multi-angle-analysis",
      "how-to-analyze-stocks-complete-guide"
    ],
    stockLinks: ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA"],
    toolLinks: ["/ai-stock-rank", "/portfolio-simulator", "/stocks"]
  },
  {
    slug: "ai-vs-human-stock-analysis",
    title: "AI vs Human Stock Analysis: Which Is Better?",
    excerpt: "Comparing artificial intelligence and traditional analyst approaches to stock research.",
    category: "depth",
    relatedSlugs: [
      "ai-stock-analysis-guide",
      "multi-angle-stock-analysis",
      "how-to-trust-ai-stock-scores",
      "ai-stock-screener-comparison-2026"
    ],
    stockLinks: ["AAPL", "TSLA", "NVDA"],
    toolLinks: ["/ai-stock-rank"]
  },
  {
    slug: "multi-angle-stock-analysis",
    title: "Multi-Angle Stock Analysis: The 9-Perspective Framework",
    excerpt: "Why analyzing stocks from multiple perspectives beats single-source research.",
    category: "depth",
    relatedSlugs: [
      "ai-stock-analysis-guide",
      "why-claritx-multi-angle-analysis",
      "how-to-analyze-stocks-complete-guide",
      "ai-vs-human-stock-analysis"
    ],
    stockLinks: ["GOOGL", "META", "AMZN"],
    toolLinks: ["/ai-stock-rank", "/portfolio-simulator"]
  },
  {
    slug: "ai-hallucinations-financial-data",
    title: "AI Hallucinations in Financial Data: How to Verify",
    excerpt: "How AI can fabricate stock data and practical steps to verify accuracy.",
    category: "depth",
    relatedSlugs: [
      "ai-stock-analysis-guide",
      "how-to-trust-ai-stock-scores",
      "hidden-dangers-ai-stock-analysis"
    ],
    stockLinks: ["AAPL", "MSFT"],
    toolLinks: ["/ai-stock-rank"]
  },
  {
    slug: "how-to-trust-ai-stock-scores",
    title: "How to Trust AI Stock Scores: Validation Guide",
    excerpt: "Practical guide to validating AI-generated investment research and scores.",
    category: "depth",
    relatedSlugs: [
      "ai-stock-analysis-guide",
      "ai-hallucinations-financial-data",
      "ai-stock-screener-comparison-2026",
      "hidden-dangers-ai-stock-analysis"
    ],
    stockLinks: ["NVDA", "TSLA", "AMD"],
    toolLinks: ["/ai-stock-rank", "/stocks"]
  },
  {
    slug: "ai-stock-screener-comparison-2026",
    title: "Best AI Stock Analysis Tools 2026: Complete Comparison",
    excerpt: "Comprehensive comparison of leading AI stock research platforms.",
    category: "depth",
    relatedSlugs: [
      "ai-stock-analysis-guide",
      "ai-vs-human-stock-analysis",
      "how-to-trust-ai-stock-scores"
    ],
    stockLinks: ["AAPL", "GOOGL", "MSFT"],
    toolLinks: ["/ai-stock-rank", "/portfolio-simulator"]
  },
  {
    slug: "hidden-dangers-ai-stock-analysis",
    title: "Hidden Dangers of AI Stock Analysis",
    excerpt: "Critical pitfalls when using AI for investment decisions and how to avoid them.",
    category: "depth",
    relatedSlugs: [
      "ai-stock-analysis-guide",
      "ai-hallucinations-financial-data",
      "how-to-trust-ai-stock-scores"
    ],
    stockLinks: ["TSLA", "GME", "AMC"],
    toolLinks: ["/ai-stock-rank"]
  },
  {
    slug: "why-claritx-multi-angle-analysis",
    title: "Why Multi-Angle Analysis Works: The Research",
    excerpt: "The research behind ClaritX's 9-perspective analysis framework.",
    category: "depth",
    relatedSlugs: [
      "ai-stock-analysis-guide",
      "multi-angle-stock-analysis",
      "how-to-analyze-stocks-complete-guide"
    ],
    stockLinks: ["AAPL", "NVDA", "AMZN"],
    toolLinks: ["/ai-stock-rank", "/portfolio-simulator"]
  },
  {
    slug: "how-to-analyze-stocks-complete-guide",
    title: "How to Analyze Stocks: Complete Guide",
    excerpt: "Master fundamental and technical analysis techniques for stock research.",
    category: "supporting",
    relatedSlugs: [
      "ai-stock-analysis-guide",
      "multi-angle-stock-analysis",
      "best-stocks-to-buy-2026"
    ],
    stockLinks: ["AAPL", "MSFT", "JPM", "V"],
    toolLinks: ["/ai-stock-rank", "/portfolio-simulator", "/stocks"]
  }
];

/**
 * Get related articles for a given slug
 */
export function getClusterRelatedArticles(slug: string): ClusterArticle[] {
  const article = AI_STOCK_ANALYSIS_CLUSTER.find(a => a.slug === slug);
  if (!article) return [];
  
  return article.relatedSlugs
    .map(s => AI_STOCK_ANALYSIS_CLUSTER.find(a => a.slug === s))
    .filter((a): a is ClusterArticle => a !== undefined);
}

/**
 * Get the pillar article
 */
export function getClusterPillar(): ClusterArticle | undefined {
  return AI_STOCK_ANALYSIS_CLUSTER.find(a => a.category === 'pillar');
}
