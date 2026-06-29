declare global {
  interface Window {
    rdt?: (...args: unknown[]) => void;
  }
}

/**
 * Reddit Pixel event taxonomy.
 *
 * Historical note (events fired BEFORE the 2026-06-16 deploy):
 *   `Lead` was fired on page-load of PortfolioAnalysis / PortfolioBuilder.
 *   That was NOT a real lead — it just meant "a portfolio page was viewed".
 *   Historical `Lead` data already collected in Reddit stays as-is.
 *
 * Current taxonomy (events fired FROM the 2026-06-16 deploy onward):
 *   - Search          → user actually searched a stock (AIStockAnalysis)
 *   - SignUp          → signup completed successfully (Auth)
 *   - PortfolioCreated (Custom) → portfolio actually created/saved to the DB
 *   - EtoroClick      (Custom) → real click on an eToro affiliate link
 *
 * `Lead` is intentionally NOT used for portfolio/search/etoro right now, so
 * those distinct actions stay separated and measurable. If `Lead` is ever
 * needed for Reddit optimization, reserve it for a single strong business
 * action (e.g. broker redirect), never for a page load.
 */
type RedditStandardEvent =
  | 'PageVisit'
  | 'ViewContent'
  | 'Search'
  | 'Lead'
  | 'SignUp'
  | 'Purchase';

interface RedditEventParams {
  value?: number;
  currency?: string;
  itemCount?: number;
  customEventName?: string;
  content_name?: string;
}

export function rdtTrack(event: RedditStandardEvent | 'Custom', params?: RedditEventParams) {
  if (typeof window !== 'undefined' && typeof window.rdt === 'function') {
    window.rdt('track', event, params);
  }
}

// --- SignUp conversion (email/password + Google OAuth) ---------------------
// Cognito federated sign-in (Google) lands every user back on /auth and fires
// the same `signedIn` flow for a brand-new user and a returning login — the
// client can't tell them apart. So we approximate "new user" by firing the
// Reddit `SignUp` conversion at most once per browser. The only false positive
// is a returning user signing in on a fresh device/browser, which is an
// acceptable trade for ad optimization (and far better than missing every
// Google signup, which is what happened before).
const SIGNUP_TRACKED_KEY = 'rdt_signup_tracked';
const OAUTH_PENDING_KEY = 'rdt_oauth_signup_pending';

/** Fire the Reddit `SignUp` conversion, deduped to once per browser. */
export function trackSignUpOnce() {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(SIGNUP_TRACKED_KEY) === '1') return;
    localStorage.setItem(SIGNUP_TRACKED_KEY, '1');
  } catch {
    // localStorage blocked (private mode) — still track this one time.
  }
  rdtTrack('SignUp');
}

/** Call right before signInWithRedirect('Google') so the /auth return knows an OAuth signup may have completed. */
export function markOAuthSignupPending() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OAUTH_PENDING_KEY, '1');
  } catch {
    // ignore — without the flag the return handler simply won't fire SignUp.
  }
}

/** Call on the OAuth return (/auth) once a session exists: fire SignUp (deduped) if an OAuth flow was pending. */
export function trackOAuthSignupIfPending() {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(OAUTH_PENDING_KEY) !== '1') return;
    localStorage.removeItem(OAUTH_PENDING_KEY);
  } catch {
    return;
  }
  trackSignUpOnce();
}
