import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
  };
  noindex?: boolean;
  /** Use the title verbatim (no "| ClaritX" suffix) — for CTR-tuned overrides. */
  noBrandSuffix?: boolean;
}

const BASE_URL = 'https://www.claritx.ai';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

export function SEOHead({
  title,
  description,
  keywords,
  canonicalUrl,
  ogImage = DEFAULT_IMAGE,
  ogType = 'website',
  article,
  noindex = false,
  noBrandSuffix = false,
}: SEOHeadProps) {
  const fullTitle = (noBrandSuffix || title.includes('ClaritX')) ? title : `${title} | ClaritX`;
  const fullCanonical = canonicalUrl ? `${BASE_URL}${canonicalUrl}` : BASE_URL;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Helper to set or update meta tag
    const setMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, name);
        document.head.appendChild(element);
      }
      element.content = content;
    };

    // Helper to set or update link tag
    const setLink = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
      if (!element) {
        element = document.createElement('link');
        element.rel = rel;
        document.head.appendChild(element);
      }
      element.href = href;
    };

    // Basic meta tags
    setMeta('description', description);
    if (keywords) setMeta('keywords', keywords);
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('author', 'ClaritX');

    // Open Graph
    setMeta('og:title', fullTitle, true);
    setMeta('og:description', description, true);
    setMeta('og:type', ogType, true);
    setMeta('og:url', fullCanonical, true);
    setMeta('og:image', ogImage, true);
    setMeta('og:image:width', '1200', true);
    setMeta('og:image:height', '630', true);
    setMeta('og:site_name', 'ClaritX', true);
    setMeta('og:locale', 'en_US', true);

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:site', '@Clarit_X');
    setMeta('twitter:creator', '@Clarit_X');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', description);
    setMeta('twitter:image', ogImage);

    // Article specific meta
    if (ogType === 'article' && article) {
      if (article.publishedTime) setMeta('article:published_time', article.publishedTime, true);
      if (article.modifiedTime) setMeta('article:modified_time', article.modifiedTime, true);
      if (article.author) setMeta('article:author', article.author, true);
      if (article.section) setMeta('article:section', article.section, true);
      article.tags?.forEach((tag, i) => setMeta(`article:tag:${i}`, tag, true));
    }

    // Canonical URL
    setLink('canonical', fullCanonical);
  }, [fullTitle, description, keywords, fullCanonical, ogImage, ogType, article, noindex]);

  return null;
}

// JSON-LD structured data components
export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'FinancialService'],
    '@id': `${BASE_URL}/#organization`,
    name: 'ClaritX',
    url: BASE_URL,
    foundingDate: '2024',
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/logo-black.png`,
    },
    description: 'AI-powered stock market research and portfolio simulation platform for educational purposes.',
    sameAs: [
      'https://x.com/Clarit_X',
      'https://twitter.com/Clarit_X',
      'https://www.linkedin.com/company/claritx-ai',
      'https://www.youtube.com/@ClaritX-ai',
    ],
    areaServed: 'Worldwide',
    serviceType: 'Stock Market Research',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: 'English',
      url: 'https://www.claritx.ai/about',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function WebsiteSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: 'ClaritX',
    url: BASE_URL,
    description: 'AI-powered stock market research and portfolio simulation platform.',
    publisher: { '@id': `${BASE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/ai-stock-analysis?symbol={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function SoftwareApplicationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${BASE_URL}/#software`,
    name: 'ClaritX',
    url: BASE_URL,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web Browser',
    offers: [
      {
        '@type': 'Offer',
        name: 'Free Plan',
        price: '0',
        priceCurrency: 'USD',
      },
      {
        '@type': 'Offer',
        name: 'Pro Plan',
        price: '20',
        priceCurrency: 'USD',
        description: 'Full access to AI-powered insights, 50 analyses/month, Deep Search, and more.',
      },
    ],
    description: 'AI-powered stock market research tool providing 9-perspective analysis for educational purposes.',
    featureList: [
      'News Sentiment Analysis',
      'Technical Indicators',
      'Social Media Buzz Tracking',
      'Financial Statement Analysis',
      'Analyst Ratings Aggregation',
      'Market Comparison',
      'Insider Activity Monitoring',
      'Dividend Analysis',
      'AI-Powered Summary',
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface ArticleSchemaProps {
  title: string;
  description: string;
  author: string;
  publishedTime: string;
  modifiedTime?: string;
  image: string;
  url: string;
  tags?: string[];
}

export function ArticleSchema({
  title,
  description,
  author,
  publishedTime,
  modifiedTime,
  image,
  url,
  tags = [],
}: ArticleSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url: `${BASE_URL}${url}`,
    author: {
      '@type': 'Organization',
      name: author || 'ClaritX Research Team',
      url: BASE_URL,
      sameAs: ['https://x.com/Clarit_X', 'https://twitter.com/Clarit_X'],
      knowsAbout: [
        'Stock Market Analysis',
        'Technical Analysis',
        'Fundamental Analysis',
        'Financial Research',
        'AI Investment Tools',
      ],
    },
    publisher: {
      '@id': `${BASE_URL}/#organization`,
    },
    datePublished: publishedTime,
    dateModified: modifiedTime || publishedTime,
    image: image.startsWith('http') ? image : `${BASE_URL}${image}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BASE_URL}${url}`,
    },
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    isFamilyFriendly: true,
    keywords: tags.join(', '),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface FAQSchemaProps {
  faqs: Array<{ question: string; answer: string }>;
}

export function FAQSchema({ faqs }: FAQSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface BreadcrumbSchemaProps {
  items: Array<{ name: string; url: string }>;
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

