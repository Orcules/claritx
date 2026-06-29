import { useEtoroCompliance } from '@/hooks/useEtoroCompliance';
import { ExternalLink } from 'lucide-react';
import { SubtleGalaxyButton } from '@/components/etoro/SubtleGalaxyButton';
import { rdtTrack } from "@/lib/reddit-pixel";

// Context-aware campaign tracking links
const CAMPAIGN_LINKS: Record<string, string> = {
  stock: 'https://med.etoro.com/B22260_A128601_TClick_Sstocks_discovery.aspx',
  portfolio: 'https://med.etoro.com/B22214_A128601_TClick_SAlphaAiPortfolios_EN.aspx',
  dashboard: 'https://med.etoro.com/B22123_A128601_TClick_SAward_winning_EN.aspx',
  general: 'https://med.etoro.com/B22123_A128601_TClick_SAward_winning_EN.aspx',
};

function getEtoroLink(context: string): string {
  return CAMPAIGN_LINKS[context] || CAMPAIGN_LINKS.general;
}

interface EtoroAffiliateCTAProps {
  variant: 'card' | 'inline' | 'minimal' | 'subtle';
  context?: 'stock' | 'portfolio' | 'dashboard' | 'general';
  symbol?: string;
}

// Generate stars with random properties for the galaxy effect
const generateStars = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    size: 2 + Math.random() * 3,
    distance: 40 + Math.random() * 80,
    duration: 6 + Math.random() * 10,
    delay: Math.random() * 10,
    alpha: 0.5 + Math.random() * 0.5,
  }));
};

// Static stars for the background
const generateStaticStars = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    size: 1 + Math.random() * 3,
    duration: 8 + Math.random() * 12,
    delay: Math.random() * 10,
  }));
};

const orbitingStars = generateStars(20);
const staticStars = generateStaticStars(4);

/**
 * Returns the effective CTA variant based on the user's tier.
 * Tier 1 → always show the requested variant (full experience)
 * Tier 2 → downgrade 'card' to 'inline', keep others
 * Tier 3 → always 'minimal'
 */
function getEffectiveVariant(
  requested: EtoroAffiliateCTAProps['variant'],
  tier: string
): EtoroAffiliateCTAProps['variant'] {
  if (tier === 'tier_1') return requested;
  if (tier === 'tier_2') return requested === 'card' ? 'inline' : requested;
  // tier_3
  return 'minimal';
}

/** Tier-specific CTA button text */
function getCtaText(tier: string, symbol?: string): { heading: string; subtext: string; buttonText: string } {
  if (tier === 'tier_1') {
    return {
      heading: symbol ? `Ready to Invest in ${symbol}?` : 'Ready to Execute Your Portfolio?',
      subtext: "Trade stocks, ETFs, crypto and more on eToro's award-winning platform",
      buttonText: 'Trade on eToro',
    };
  }
  if (tier === 'tier_2') {
    return {
      heading: symbol ? `Trade ${symbol} Now` : 'Start Trading Today',
      subtext: 'Join millions of traders on eToro',
      buttonText: 'Open eToro',
    };
  }
  // tier_3
  return {
    heading: symbol ? `Explore ${symbol}` : 'Explore Trading',
    subtext: 'Discover investment opportunities on eToro',
    buttonText: 'Visit eToro',
  };
}

export function EtoroAffiliateCTA({ variant, context = 'general', symbol }: EtoroAffiliateCTAProps) {
  const { isRestricted, riskWarning, extraDisclaimer, tier, isLoading } = useEtoroCompliance();

  if (isLoading || isRestricted || !riskWarning) return null;

  const effectiveVariant = getEffectiveVariant(variant, tier);
  const etoroLink = getEtoroLink(context);
  const copy = getCtaText(tier, symbol);

  const handleEtoroClick = () => rdtTrack('Custom', { customEventName: 'EtoroClick', content_name: 'etoro_affiliate_click' });

  // Minimal variant - simple text link with subtle animation
  if (effectiveVariant === 'minimal') {
    return (
      <div className="text-center py-4 border-t border-border/30 animate-fade-in">
        <p className="text-xs text-muted-foreground">
          Want to trade these assets?{' '}
          <SubtleGalaxyButton
            href={etoroLink}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={handleEtoroClick}
            className="px-3 py-1 rounded-full text-[11px] leading-none align-middle"
            style={{
              '--etoro-bg-alpha': 0.12,
              '--etoro-inner-alpha': 0.08,
              '--etoro-inner-hover-alpha': 0.14,
            } as React.CSSProperties}
          >
            <span className="text-primary transition-colors duration-200 group-hover/btn:text-primary/90">
              Open an account on eToro
            </span>
            <ExternalLink className="w-3 h-3 text-primary transition-transform duration-200 group-hover/btn:translate-x-0.5" />
          </SubtleGalaxyButton>
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1 opacity-0 animate-[fade-in_0.3s_ease-out_0.2s_forwards]">
          {riskWarning}
        </p>
      </div>
    );
  }

  // Subtle variant - clean card with gentle glow effect
  if (effectiveVariant === 'subtle') {
    return (
      <div className="animate-fade-in rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_20px_hsl(var(--primary)/0.1)]">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 transition-colors duration-300 group-hover:bg-primary/15">
              <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {copy.heading}
              </p>
              <p className="text-xs text-muted-foreground">
                {copy.subtext}
              </p>
            </div>
          </div>
          
          <SubtleGalaxyButton
            href={etoroLink}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={handleEtoroClick}
            className="px-5 py-2.5 text-sm font-medium"
          >
            <span className="text-primary-foreground">{copy.buttonText}</span>
            <ExternalLink className="w-4 h-4 text-primary-foreground transition-transform duration-200 group-hover/btn:translate-x-0.5" />
          </SubtleGalaxyButton>
        </div>
        
        <p className="text-[10px] text-muted-foreground/60 mt-4 text-center">
          {riskWarning}
        </p>
      </div>
    );
  }

  return (
    <div className="etoro-galaxy-section group rounded-2xl">
      {/* Spark - rotating gradient border */}
      <span className="etoro-spark" />
      
      {/* Backdrop */}
      <span className="etoro-backdrop" />
      
      {/* Static stars container */}
      <span className="etoro-galaxy__container">
        {staticStars.map((star) => (
          <span
            key={`static-${star.id}`}
            className="etoro-star etoro-star--static"
            style={{
              '--size': star.size,
              '--duration': star.duration,
              '--delay': star.delay,
            } as React.CSSProperties}
          />
        ))}
      </span>
      
      {/* Galaxy with orbiting ring */}
      <span className="etoro-galaxy">
        <span className="etoro-galaxy__ring">
          {orbitingStars.map((star) => (
            <span
              key={`orbit-${star.id}`}
              className="etoro-star"
              style={{
                '--size': star.size,
                '--distance': star.distance,
                '--duration': star.duration,
                '--delay': star.delay,
                '--alpha': star.alpha,
              } as React.CSSProperties}
            />
          ))}
        </span>
      </span>
      
      {/* Content */}
      <div className="etoro-content p-4 md:p-5">
        {effectiveVariant === 'inline' ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="etoro-icon-glow flex items-center justify-center w-10 h-10 rounded-lg bg-[hsl(145_80%_20%/0.5)] border border-[hsl(145_70%_50%/0.3)]">
                <svg className="w-5 h-5 text-[hsl(145_80%_65%)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v18h18" />
                  <path d="M18 17V9" />
                  <path d="M13 17V5" />
                  <path d="M8 17v-3" />
                </svg>
              </div>
              <div>
                <h3 className="etoro-text-highlight text-base font-bold tracking-tight">
                  {copy.heading}
                </h3>
                <p className="etoro-text text-xs mt-0.5">
                  {copy.subtext}
                </p>
              </div>
            </div>
            
            <a
              href={etoroLink}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={handleEtoroClick}
              className="etoro-cta-button group/btn inline-flex items-center gap-2 font-bold text-sm"
            >
              <span className="etoro-text-highlight flex items-center gap-2">
                {copy.buttonText}
                <ExternalLink className="w-4 h-4" />
              </span>
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-6">
            <div className="etoro-icon-glow flex items-center justify-center w-20 h-20 rounded-2xl bg-[hsl(145_80%_20%/0.5)] border border-[hsl(145_70%_50%/0.3)]">
              <svg className="w-10 h-10 text-[hsl(145_80%_65%)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
            </div>
            
            <div>
              <h3 className="etoro-text-highlight text-2xl md:text-3xl font-bold tracking-tight">
                {copy.heading}
              </h3>
              <p className="etoro-text text-base mt-2 max-w-md mx-auto">
                {copy.subtext}
              </p>
            </div>
            
            <a
              href={etoroLink}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={handleEtoroClick}
              className="etoro-cta-button group/btn inline-flex items-center gap-3 px-10 py-5 font-bold text-xl"
            >
              <span className="etoro-text-highlight flex items-center gap-3">
                {copy.buttonText}
                <ExternalLink className="w-6 h-6" />
              </span>
            </a>
          </div>
        )}
        
        {/* Risk Warning */}
        <div className="mt-6 pt-5 border-t border-[hsl(145_50%_30%/0.3)]">
          <p className="etoro-text text-[11px] leading-relaxed text-center max-w-2xl mx-auto opacity-70">
            {riskWarning}
          </p>
          {extraDisclaimer && (
            <p className="etoro-text text-[11px] leading-relaxed text-center mt-2 max-w-2xl mx-auto opacity-60">
              {extraDisclaimer}
            </p>
          )}
          <p className="etoro-text text-[10px] italic text-center mt-2 opacity-50">
            Sponsored content. ClaritX may be compensated if you access eToro products or services.
          </p>
        </div>
      </div>
    </div>
  );
}
