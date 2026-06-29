import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

/**
 * Google Analytics 4 tracking component
 * Tracks page views and can be extended for custom events
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const location = useLocation();

  useEffect(() => {
    // Load gtag script only once
    if (!window.gtag) {
      // Create gtag function
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', measurementId, {
        page_path: location.pathname + location.search,
      });

      // Load the script
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      script.async = true;
      document.head.appendChild(script);
    }
  }, [measurementId]);

  // Track page views on route change
  useEffect(() => {
    if (window.gtag) {
      window.gtag('config', measurementId, {
        page_path: location.pathname + location.search,
      });
    }
  }, [location, measurementId]);

  return null;
}

/**
 * Track custom events
 */
export function trackEvent(
  eventName: string,
  eventParams?: Record<string, any>
) {
  if (window.gtag) {
    window.gtag('event', eventName, eventParams);
  }
}

/**
 * Track stock analysis events
 */
export function trackStockAnalysis(symbol: string) {
  trackEvent('stock_analysis', {
    stock_symbol: symbol,
    event_category: 'engagement',
  });
}

/**
 * Track portfolio simulator usage
 */
export function trackPortfolioSimulation(riskBucket: number) {
  trackEvent('portfolio_simulation', {
    risk_bucket: riskBucket,
    event_category: 'engagement',
  });
}

/**
 * Track blog reads
 */
export function trackBlogRead(slug: string, title: string) {
  trackEvent('blog_read', {
    blog_slug: slug,
    blog_title: title,
    event_category: 'content',
  });
}
