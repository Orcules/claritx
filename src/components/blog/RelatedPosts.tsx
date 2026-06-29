import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock } from "lucide-react";
import { BlogPost, blogPosts } from "@/data/blogPosts";

interface RelatedPostsProps {
  currentSlug: string;
  currentTags: string[];
  imageMap: Record<string, string>;
  maxPosts?: number;
}

/**
 * Finds related posts based on tag overlap and recency.
 * Prioritizes posts with more matching tags.
 */
function findRelatedPosts(
  currentSlug: string,
  currentTags: string[],
  maxPosts: number
): BlogPost[] {
  const otherPosts = blogPosts.filter(p => p.slug !== currentSlug);
  
  // Score each post by tag overlap
  const scoredPosts = otherPosts.map(post => {
    const matchingTags = post.tags.filter(tag => 
      currentTags.some(ct => ct.toLowerCase() === tag.toLowerCase())
    );
    return {
      post,
      score: matchingTags.length,
      matchingTags,
    };
  });
  
  // Sort by score (descending), then by date (newest first)
  scoredPosts.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.post.publishedAt).getTime() - new Date(a.post.publishedAt).getTime();
  });
  
  return scoredPosts.slice(0, maxPosts).map(sp => sp.post);
}

export function RelatedPosts({ 
  currentSlug, 
  currentTags, 
  imageMap, 
  maxPosts = 3 
}: RelatedPostsProps) {
  const relatedPosts = findRelatedPosts(currentSlug, currentTags, maxPosts);
  
  if (relatedPosts.length === 0) return null;
  
  return (
    <section className="mt-16 pt-12 border-t border-border/50" aria-label="Related articles">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          Related <span className="text-primary">Reading</span>
        </h2>
        <Link 
          to="/blog" 
          className="hidden sm:inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          View all articles
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3">
        {relatedPosts.map((post) => (
          <article key={post.slug} className="group">
            <Link to={`/blog/${post.slug}`}>
              <Card className="h-full overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                {/* Image */}
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={imageMap[post.image]}
                    alt={post.title}
                    width={400}
                    height={225}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                </div>
                
                <CardContent className="p-4">
                  {/* Tags - show first 2 */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {post.tags.slice(0, 2).map((tag) => (
                      <Badge 
                        key={tag} 
                        variant="secondary" 
                        className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  {/* Title */}
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2 text-sm md:text-base">
                    {post.title}
                  </h3>
                  
                  {/* Meta */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{post.readTime} min read</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </article>
        ))}
      </div>
      
      {/* Mobile view all link */}
      <Link 
        to="/blog" 
        className="mt-6 sm:hidden inline-flex items-center gap-2 text-sm text-primary hover:underline"
      >
        View all articles
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
