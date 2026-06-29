import React from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ArrowLeft, Share2, User } from "lucide-react";
import { RelatedPosts } from "@/components/blog";
import { useToast } from "@/hooks/use-toast";
import { SEOHead, ArticleSchema, BreadcrumbSchema } from "@/components/SEOHead";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api_adapter";
import { getBlogPost as getLocalBlogPost } from "@/data/blogPosts";
import blogRedirects from "@/data/blogRedirects.json";
import seoOverrides from "@/data/seoTitleOverrides.json";
import NotFound from "@/pages/NotFound";

const BACKEND_URL = import.meta.env.VITE_AWS_API_URL || "http://localhost:8000";

// Import blog images
import aiRiskImage from "@/assets/blog/ai-risk-stock-analysis.jpg";
import multiAngleImage from "@/assets/blog/claritx-multi-angle-analysis.jpg";
import hallucinationImage from "@/assets/blog/ai-hallucination-vs-verified.jpg";
import dividendInvestingImage from "@/assets/blog/dividend-investing-passive-income.jpg";
import beginnerInvestingImage from "@/assets/blog/stock-market-beginners-first-investment.jpg";
import growthVsValueImage from "@/assets/blog/growth-vs-value-investing.jpg";
import financialStatementsImage from "@/assets/blog/reading-financial-statements.jpg";
import etfVsStocksImage from "@/assets/blog/etf-vs-stocks.jpg";
import dcaVsLumpSumImage from "@/assets/blog/dca-vs-lump-sum.jpg";
import marketCrashImage from "@/assets/blog/market-crash-preparation.jpg";
import investing30sImage from "@/assets/blog/investing-in-your-30s.jpg";
import peRatioImage from "@/assets/blog/pe-ratio-explained.jpg";
import emergencyFundImage from "@/assets/blog/emergency-fund-investing.jpg";
import taxLossImage from "@/assets/blog/tax-loss-harvesting.jpg";
import sectorRotationImage from "@/assets/blog/sector-rotation-strategy.jpg";
import reitsImage from "@/assets/blog/reits-for-beginners.jpg";
import stopLossImage from "@/assets/blog/stop-loss-orders.jpg";
import bestDividendRetirementImage from "@/assets/blog/best-dividend-retirement.jpg";
import howToInvest1000Image from "@/assets/blog/how-to-invest-1000.jpg";
import passiveIncomeMonthlyImage from "@/assets/blog/passive-income-monthly.jpg";
import safeBeginnersImage from "@/assets/blog/safe-stocks-beginners.jpg";
import bestEtfsForeverImage from "@/assets/blog/best-etfs-forever.jpg";

const imageMap: Record<string, string> = {
  "ai-risk-stock-analysis": aiRiskImage,
  "claritx-multi-angle-analysis": multiAngleImage,
  "ai-hallucination-vs-verified": hallucinationImage,
  "dividend-investing-passive-income": dividendInvestingImage,
  "stock-market-beginners-first-investment": beginnerInvestingImage,
  "growth-vs-value-investing": growthVsValueImage,
  "reading-financial-statements": financialStatementsImage,
  "etf-vs-stocks": etfVsStocksImage,
  "dca-vs-lump-sum": dcaVsLumpSumImage,
  "market-crash-preparation": marketCrashImage,
  "investing-in-your-30s": investing30sImage,
  "pe-ratio-explained": peRatioImage,
  "emergency-fund-investing": emergencyFundImage,
  "tax-loss-harvesting": taxLossImage,
  "sector-rotation-strategy": sectorRotationImage,
  "reits-for-beginners": reitsImage,
  "stop-loss-orders": stopLossImage,
  "best-dividend-retirement": bestDividendRetirementImage,
  "how-to-invest-1000": howToInvest1000Image,
  "passive-income-monthly": passiveIncomeMonthlyImage,
  "safe-stocks-beginners": safeBeginnersImage,
  "best-etfs-forever": bestEtfsForeverImage,
};

const BASE_URL = 'https://www.claritx.ai';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  // Retired duplicate slug → canonical survivor (keyword-cannibalization cleanup)
  const redirectTarget = slug
    ? (blogRedirects as Record<string, string>)[slug.replace(/\/$/, "")]
    : undefined;

  // Try local bundled data first (instant, SEO-friendly), fall back to API for DB-only posts
  const { data: post, isLoading } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      if (!slug) return null;
      const cleanSlug = slug.replace(/\/$/, "");

      const localPost = getLocalBlogPost(cleanSlug);
      if (localPost) {
        return {
          slug: localPost.slug,
          title: localPost.title,
          excerpt: localPost.excerpt,
          content: localPost.content,
          author: localPost.author,
          publishedAt: localPost.publishedAt,
          readTime: localPost.readTime,
          tags: localPost.tags,
          metaDescription: localPost.metaDescription,
          image: localPost.image,
          isFromDB: false,
        };
      }

      try {
        const dbPost = await api.get<any>(`/blogs/${cleanSlug}`);
        if (!dbPost) return null;

        return {
          slug: dbPost.slug,
          title: dbPost.title,
          excerpt: dbPost.excerpt || "",
          content: dbPost.content,
          author: dbPost.author || "ClaritX Research Team",
          publishedAt: dbPost.published_at,
          readTime: dbPost.read_time || 8,
          tags: dbPost.tags || [],
          metaDescription: dbPost.meta_description || dbPost.excerpt || "",
          image: dbPost.image_url || "",
          isFromDB: true,
        };
      } catch (err) {
        console.error(`[BlogPost] Failed to fetch blog ${cleanSlug}:`, err);
        return null;
      }
    },
    enabled: !!slug && !redirectTarget,
  });

  if (redirectTarget) {
    return <Navigate to={`/blog/${redirectTarget}`} replace />;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="pt-24 pb-16 flex-1">
          <div className="container mx-auto px-4 max-w-4xl">
            <Skeleton className="h-8 w-48 mb-6" />
            <Skeleton className="h-12 w-full mb-4" />
            <Skeleton className="h-6 w-64 mb-8" />
            <Skeleton className="h-64 w-full mb-8" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  // Unknown slug → render the 404 page (noindex) instead of redirecting to
  // /blog, which Google reads as a soft 404 / duplicate of the blog index.
  if (!post) {
    return <NotFound />;
  }


  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt,
          url,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: "Article link copied to clipboard",
      });
    }
  };


  // Helper for image URLs
  const getImgSrc = (src: string) => {
    if (imageMap[src]) return imageMap[src];
    if (src.startsWith("/blogs/images/")) return `${BACKEND_URL}${src}`;
    return src;
  };

  const articleImage = getImgSrc(post.image) || `${BASE_URL}/og-image.png`;

  // Parse a markdown table row into cell strings
  const parseTableCells = (row: string): string[] =>
    row.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

  // A separator row looks like |---|---|  or  |:--|:--:|--:|
  const isTableSeparator = (line: string) => /^\|[\s|:\-]+\|$/.test(line.trim());

  // Render inline markdown: bold, italic, and [link](url)
  const renderInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    // Match **bold**, *italic*, or [text](url) — order matters
    const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      if (m[0].startsWith('**')) {
        parts.push(<strong key={m.index} className="text-foreground font-semibold">{m[2]}</strong>);
      } else if (m[0].startsWith('*')) {
        parts.push(<em key={m.index}>{m[3]}</em>);
      } else {
        // Inline link [text](url)
        const linkText = m[4];
        const url = m[5];
        const isInternal = url.startsWith('/');
        parts.push(
          isInternal
            ? <Link key={m.index} to={url} className="text-primary underline hover:no-underline">{linkText}</Link>
            : <a key={m.index} href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">{linkText}</a>
        );
      }
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  // Convert markdown-style content to React elements
  const renderContent = (content: string) => {
    // Detect HTML content — either starts with a tag, or contains block-level HTML tags
    const isHtml = /^\s*<[a-zA-Z]/.test(content) || /<(h[1-6]|p|ul|ol|li|div|section|article|blockquote|table|br)\b/i.test(content);
    if (isHtml) {
      // Fix relative image paths to point at backend
      const fixedHtml = content.replace(/src="\/blogs\/images\//g, `src="${BACKEND_URL}/blogs/images/`);
      return (
        <div className="blog-html-content" dangerouslySetInnerHTML={{ __html: fixedHtml }} />
      );
    }

    const lines = content.trim().split('\n');
    const elements: JSX.Element[] = [];
    let key = 0;
    let i = 0;

    while (i < lines.length) {
      const trimmedLine = lines[i].trim();

      // ── Markdown table ─────────────────────────────────────────────────
      if (
        trimmedLine.startsWith('|') &&
        i + 1 < lines.length &&
        isTableSeparator(lines[i + 1])
      ) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        const headers = parseTableCells(tableLines[0]);
        // tableLines[1] is the separator — skip it
        const rows = tableLines.slice(2).map(parseTableCells);

        elements.push(
          <div key={key++} className="my-8 overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  {headers.map((h, idx) => (
                    <th key={idx} className="px-4 py-3 text-left font-semibold text-foreground whitespace-nowrap">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className={`border-b border-border/40 ${rIdx % 2 === 1 ? 'bg-muted/20' : ''}`}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-3 text-muted-foreground">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // ── Headings ───────────────────────────────────────────────────────
      if (trimmedLine.startsWith('## ')) {
        elements.push(
          <h2 key={key++} className="text-2xl md:text-3xl font-bold mt-10 mb-4 text-foreground">
            {trimmedLine.slice(3)}
          </h2>
        );
      } else if (trimmedLine.startsWith('### ')) {
        elements.push(
          <h3 key={key++} className="text-xl md:text-2xl font-semibold mt-8 mb-3 text-foreground">
            {trimmedLine.slice(4)}
          </h3>
        );
      } else if (trimmedLine.startsWith('#### ')) {
        elements.push(
          <h4 key={key++} className="text-lg font-semibold mt-6 mb-2 text-primary">
            {trimmedLine.slice(5)}
          </h4>
        );

      // ── CTA link: **[→ Text](/path)** ─────────────────────────────────
      } else if (trimmedLine.startsWith('**[') && trimmedLine.includes('](')) {
        const linkMatch = trimmedLine.match(/^\*\*\[([^\]]+)\]\(([^)]+)\)\*\*(.*)$/);
        if (linkMatch) {
          const [, rawText, url, afterText] = linkMatch;
          const linkText = rawText.replace(/^→\s*/, '');
          const isArrow = rawText.startsWith('→');
          const isInternal = url.startsWith('/');
          elements.push(
            <p key={key++} className="my-3">
              {isInternal ? (
                <Link to={url} className="inline-flex items-center gap-2 text-primary font-semibold hover:underline">
                  {isArrow && '→ '}{linkText}
                </Link>
              ) : (
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary font-semibold hover:underline">
                  {isArrow && '→ '}{linkText}
                </a>
              )}
              {afterText && <span className="text-muted-foreground">{afterText}</span>}
            </p>
          );
        }

      // ── Bold-only paragraph ────────────────────────────────────────────
      } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        elements.push(
          <p key={key++} className="font-semibold my-4 text-foreground">
            {trimmedLine.replace(/\*\*/g, '')}
          </p>
        );

      // ── List item ─────────────────────────────────────────────────────
      } else if (trimmedLine.startsWith('- ')) {
        elements.push(
          <li key={key++} className="ml-6 my-1 text-muted-foreground list-disc">
            {renderInline(trimmedLine.slice(2))}
          </li>
        );

      // ── Horizontal rule ───────────────────────────────────────────────
      } else if (trimmedLine.startsWith('---')) {
        elements.push(<hr key={key++} className="my-8 border-border/50" />);

      // ── Italic callout *text* ─────────────────────────────────────────
      } else if (trimmedLine.startsWith('*') && trimmedLine.endsWith('*') && !trimmedLine.startsWith('**')) {
        elements.push(
          <p key={key++} className="italic text-sm text-muted-foreground my-4 p-4 bg-muted/30 rounded-lg border-l-4 border-primary/50">
            {trimmedLine.replace(/^\*|\*$/g, '')}
          </p>
        );

      // ── Emoji list items ──────────────────────────────────────────────
      } else if (trimmedLine.startsWith('✅') || trimmedLine.startsWith('❌')) {
        elements.push(
          <p key={key++} className="ml-4 my-1 text-muted-foreground">{trimmedLine}</p>
        );

      // ── Inline image ![alt](url) ──────────────────────────────────────
      } else if (trimmedLine.startsWith('![') && trimmedLine.includes('](')) {
        const match = trimmedLine.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        if (match) {
          elements.push(
            <figure key={key++} className="my-8">
              <img
                src={getImgSrc(match[2])}
                alt={match[1] || 'Blog illustration'}
                className="w-full rounded-lg shadow-md border border-border/50"
                loading="lazy"
                decoding="async"
                width="800"
                height="450"
              />
              {match[1] && <figcaption className="text-center text-xs text-muted-foreground mt-2 italic">{match[1]}</figcaption>}
            </figure>
          );
        }

      // ── Regular paragraph ─────────────────────────────────────────────
      } else if (trimmedLine.length > 0) {
        elements.push(
          <p key={key++} className="my-4 text-muted-foreground leading-relaxed">
            {renderInline(trimmedLine)}
          </p>
        );
      }

      i++;
    }

    return elements;
  };

  // CTR-optimized title/description overrides for top GSC pages (same JSON the
  // build uses, so the static snippet and the rendered page stay identical).
  const seoOverride = (seoOverrides as Record<string, { title?: string; description?: string }>)[post.slug] || {};
  const seoTitle = seoOverride.title || post.title;
  const seoDescription = seoOverride.description || post.metaDescription;

  return (
    <>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        noBrandSuffix={!!seoOverride.title}
        keywords={post.tags.join(', ')}
        canonicalUrl={`/blog/${post.slug}`}
        ogImage={articleImage}
        ogType="article"
        article={{
          publishedTime: post.publishedAt,
          author: post.author,
          section: "Investment Research",
          tags: post.tags,
        }}
      />
      <ArticleSchema
        title={seoTitle}
        description={seoDescription}
        author={post.author}
        publishedTime={post.publishedAt}
        image={articleImage}
        url={`/blog/${post.slug}`}
        tags={post.tags}
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: post.title, url: `/blog/${post.slug}` },
        ]}
      />
      
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        
        <main className="pt-24 pb-16 flex-1">
          <article className="container mx-auto px-4 max-w-4xl">
            {/* Visual Breadcrumbs */}
            <Breadcrumbs 
              items={[
                { label: "Blog", href: "/blog" },
                { label: post.title }
              ]} 
              className="mb-6"
            />
            
            {/* Back Link */}
            <Link 
              to="/blog" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Blog
            </Link>
            
            {/* Header */}
            <header className="mb-8">
              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              
              {/* Title */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6 text-foreground leading-tight">
                {post.title}
              </h1>
              
              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {post.author}
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {post.readTime} min read
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="ml-auto"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
              
              {/* Excerpt */}
              <p className="text-lg text-muted-foreground border-l-4 border-primary pl-4 italic">
                {post.excerpt}
              </p>
            </header>
            
            <figure className="mb-10">
              <img
                src={articleImage}
                alt={post.title}
                className="w-full rounded-xl shadow-lg"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                width="800"
                height="450"
              />
            </figure>
            
            {/* Content */}
            <div className="prose-custom">
              {renderContent(post.content)}
            </div>
            
            {/* Author Box — E-E-A-T signal for YMYL financial content */}
            <aside className="mt-12 p-6 bg-card/50 border border-border/50 rounded-xl">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-lg">CX</span>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{post.author}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The ClaritX Research Team combines AI-driven data analysis with financial market expertise to produce educational investment content. All articles are reviewed for accuracy and sourced from institutional market data providers, public regulatory filings, and major financial news outlets.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    This content is for educational purposes only and does not constitute investment advice. <Link to="/disclaimer" className="text-primary hover:underline">Read full disclaimer</Link>.
                  </p>
                </div>
              </div>
            </aside>
            
            {/* Related Posts */}
            <RelatedPosts 
              currentSlug={post.slug}
              currentTags={post.tags}
              imageMap={imageMap}
              maxPosts={3}
            />
          </article>
        </main>
        
        <Footer />
      </div>
    </>
  );
}
