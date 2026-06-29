import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { SEOHead, BreadcrumbSchema, FAQSchema } from "@/components/SEOHead";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BlogListingSchema, CollectionPageSchema } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api_adapter";
import { blogPosts as localBlogPosts } from "@/data/blogPosts";
import { Button } from "@/components/ui/button";

const BACKEND_URL = import.meta.env.VITE_AWS_API_URL || "http://localhost:8000";

// Eager-load all bundled blog images at module init — instant, no lazy-import delay
const imageModules = import.meta.glob<{ default: string }>(
  "@/assets/blog/*.jpg",
  { eager: true }
);

// Build a slug→url map once, synchronously
const bundledImageMap: Record<string, string> = {};
for (const [path, mod] of Object.entries(imageModules)) {
  const slug = path.replace(/.*\//, "").replace(/\.jpg$/, "");
  bundledImageMap[slug] = mod.default;
}

// Unified blog post type for display
interface DisplayBlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readTime: number;
  tags: string[];
  image: string;
  isFromDB?: boolean;
}

// FAQ data for rich snippets
const blogFAQs = [
  {
    question: "What topics does the ClaritX blog cover?",
    answer: "The ClaritX blog covers AI-powered stock analysis, investment strategies, fundamental and technical analysis techniques, portfolio building, risk management, and educational content about the stock market for beginners and experienced investors alike."
  },
  {
    question: "How often is the blog updated?",
    answer: "We publish new educational content regularly, typically 2-4 articles per week covering the latest in AI stock analysis, investment strategies, and market insights."
  },
  {
    question: "Is the blog content investment advice?",
    answer: "No. All blog content is for educational and informational purposes only. ClaritX is not a registered investment advisor. Always consult a licensed financial professional before making investment decisions."
  },
];

const POSTS_PER_PAGE = 12;

// Pre-build local posts array once (outside component), sorted newest-first
const localPostsList: DisplayBlogPost[] = localBlogPosts
  .map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    publishedAt: p.publishedAt,
    readTime: p.readTime,
    tags: p.tags,
    image: p.image,
  }))
  .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

export default function Blog() {
  const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE);

  const { data: allBlogs, isLoading } = useQuery<DisplayBlogPost[]>({
    queryKey: ["published-blogs"],
    queryFn: async () => {
      try {
        const dbBlogs = await api.get<any[]>("/blogs");
        const localSlugs = new Set(localPostsList.map((p) => p.slug));
        const dbOnlyPosts: DisplayBlogPost[] = dbBlogs
          .filter((p) => !localSlugs.has(p.slug))
          .map((post) => ({
            slug: post.slug,
            title: post.title,
            excerpt: post.excerpt,
            publishedAt: post.published_at,
            readTime: post.read_time,
            tags: post.tags || [],
            image: post.image_url || "",
            isFromDB: true,
          }));
        return [...dbOnlyPosts, ...localPostsList].sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
      } catch {
        return localPostsList;
      }
    },
    staleTime: 60_000,
  });

  const posts = allBlogs ?? [];

  const visiblePosts = posts.slice(0, visibleCount);
  const hasMore = visibleCount < posts.length;

  return (
    <>
      <SEOHead
        title="Investment Research Blog - AI Deep Research Insights"
        description="Educational articles on AI-powered deep research, investment research best practices, and how to avoid common pitfalls. Learn about AI in finance and multi-angle analysis strategies."
        keywords="AI deep research blog, investment research, stock market insights, AI hallucinations finance, financial analysis tips, ClaritX blog, stock analysis education"
        canonicalUrl="/blog"
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
        ]}
      />
      <FAQSchema faqs={blogFAQs} />
      <BlogListingSchema posts={posts} />
      <CollectionPageSchema posts={posts} />

      <div className="min-h-screen bg-background flex flex-col">
        <Header />

        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4">
            {/* Visual Breadcrumbs */}
            <Breadcrumbs
              items={[{ label: "Blog" }]}
              className="mb-8"
            />

            {/* Hero Section */}
            <header className="text-center mb-16">
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
                ClaritX Insights
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6">
                <span className="text-foreground">Investment</span>{" "}
                <span className="text-primary">Insights</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Educational research on AI in finance, stock analysis methodologies, and independent investment decision-making.
              </p>
            </header>

            {/* Blog Grid */}
            <section aria-label="Blog posts" className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 min-h-[600px]">
              {isLoading
                ? Array.from({ length: POSTS_PER_PAGE }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-3">
                      <Skeleton className="aspect-video w-full rounded-lg" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))
                : visiblePosts.map((post, postIndex) => (
                    <BlogCard key={post.slug} post={post} index={postIndex} />
                  ))}
            </section>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center mt-12">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setVisibleCount((c) => c + POSTS_PER_PAGE)}
                  className="gap-2"
                >
                  Load More Articles
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* CTA Section */}
            <section className="mt-20 text-center">
              <div className="glass-card rounded-2xl p-8 md:p-12 max-w-3xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold mb-4">
                  Ready for <span className="text-primary">Smarter</span> Deep Research?
                </h2>
                <p className="text-muted-foreground mb-6">
                  Experience multi-angle AI-powered analysis with verified real-time data.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    Try ClaritX Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/ai-stock-rank"
                    className="inline-flex items-center gap-2 px-6 py-3 border border-primary/30 text-primary rounded-lg font-medium hover:bg-primary/10 transition-colors"
                  >
                    View AI Stock Rankings
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

function BlogCard({ post, index }: { post: DisplayBlogPost; index: number }) {
  // Resolve image synchronously — no hooks, no async, no re-render
  const src: string | undefined =
    bundledImageMap[post.image] ||           // bundled local JPG by slug key
    (post.image.startsWith("/blogs/images/") ? `${BACKEND_URL}${post.image}` : undefined) ||
    (post.image.startsWith("http") ? post.image : undefined);

  return (
    <article className="group">
      <Link to={`/blog/${post.slug}`}>
        <Card className="h-full overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
          {/* Image */}
          <div className="relative aspect-video overflow-hidden bg-muted">
            {src && (
              <img
                src={src}
                alt={post.title}
                width={640}
                height={360}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
                decoding="async"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>

          <CardContent className="p-6">
            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {post.tags.slice(0, 2).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs bg-primary/10 text-primary hover:bg-primary/20"
                >
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Title */}
            <h2 className="text-xl font-semibold mb-3 text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {post.title}
            </h2>

            {/* Excerpt */}
            <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
              {post.excerpt}
            </p>

            {/* Meta */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {post.readTime} min read
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </article>
  );
}
