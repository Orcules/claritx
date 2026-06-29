/**
 * SEO Schema components for blog listing page
 * Adds ItemList structured data for better search visibility
 * Uses live API data passed as props to stay in sync with the database
 */

const BASE_URL = 'https://www.claritx.ai';

interface LiveBlogPost {
  slug: string;
  title: string;
  metaDescription?: string;
  excerpt?: string;
  author?: string;
  publishedAt?: string;
  image?: string;
}

interface BlogListingSchemaProps {
  posts: LiveBlogPost[];
  imageMap?: Record<string, string>;
}

export function BlogListingSchema({ posts, imageMap = {} }: BlogListingSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: posts.map((post, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'BlogPosting',
        '@id': `${BASE_URL}/blog/${post.slug}`,
        headline: post.title,
        description: post.metaDescription || post.excerpt || '',
        author: {
          '@type': 'Organization',
          name: post.author || 'ClaritX Research Team',
          url: BASE_URL,
          sameAs: ['https://x.com/Clarit_X', 'https://twitter.com/Clarit_X'],
        },
        ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
        image: post.image ? (imageMap[post.image] || `${BASE_URL}/og-image.png`) : `${BASE_URL}/og-image.png`,
        url: `${BASE_URL}/blog/${post.slug}`,
      },
    })),
    numberOfItems: posts.length,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface CollectionPageSchemaProps {
  posts: LiveBlogPost[];
}

export function CollectionPageSchema({ posts }: CollectionPageSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'ClaritX Investment Research Blog',
    description: 'Expert insights on AI-powered stock analysis, investment research best practices, and how to avoid common pitfalls.',
    url: `${BASE_URL}/blog`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: posts.length,
      itemListElement: posts.slice(0, 10).map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${BASE_URL}/blog/${post.slug}`,
      })),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
