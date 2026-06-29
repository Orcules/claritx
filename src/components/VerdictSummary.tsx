import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ThumbsUp, ThumbsDown, Target, DollarSign, Info, ChevronDown, ChevronUp } from "lucide-react";
import { FormattedAnalysis } from "./FormattedAnalysis";
import { ScoreRing } from "./ScoreRing";

interface QualityFlags {
  positives?: string[];
  concerns?: string[];
}

interface VerdictSummaryProps {
  content: string;
  score: number;
  qualityFlags?: QualityFlags | null;
  tabColor?: string;
}

type SectionColor = "green" | "red" | "amber" | "blue" | "neutral";

interface ParsedSection {
  title: string;
  body: string;
  color: SectionColor;
}

const ABBREV = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|Corp|Inc|Ltd|LLC|Co|etc|No|Vol|Fig|pp|cf|al|U\.S|e\.g|i\.e)\.?$/i;

function firstSentence(text: string): string {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    const after = text.slice(i + 1);
    if (!/^\s+[A-Z"'(]/.test(after)) continue;
    const before = text.slice(Math.max(0, i - 12), i + 1);
    if (ABBREV.test(before)) continue;
    if (i > 0 && /\d/.test(text[i - 1]) && /\s*\d/.test(after)) continue;
    return text.slice(0, i + 1).trim();
  }
  return text.trim();
}

function splitAllSentences(text: string): string[] {
  const out: string[] = [];
  let cursor = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    const after = text.slice(i + 1);
    if (!/^\s+[A-Z"'(]/.test(after) && i !== text.length - 1) continue;
    const before = text.slice(Math.max(0, i - 12), i + 1);
    if (ABBREV.test(before)) continue;
    if (i > 0 && /\d/.test(text[i - 1]) && /^\d/.test(after)) continue;
    out.push(text.slice(cursor, i + 1).trim());
    cursor = i + 1;
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
  }
  const tail = text.slice(cursor).trim();
  if (tail) out.push(tail);
  return out.filter(Boolean);
}

function chunkSentences(sentences: string[], perChunk: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += perChunk) {
    chunks.push(sentences.slice(i, i + perChunk).join(" "));
  }
  return chunks;
}

function extractTldr(content: string): string {
  if (!content) return "";
  const cleaned = content
    .replace(/\r\n/g, "\n")
    .replace(/Rating\s+\d+(?:\.\d+)?\s*\/\s*100\.?/gi, "")
    .trim();

  const lines = cleaned.split("\n").map(l => l.trim()).filter(Boolean);
  const firstParaLines: string[] = [];
  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) continue;
    if (/^[-*•]\s+/.test(line)) break;
    if (/^\*\*[^*]{2,60}\*\*:?\s*$/.test(line)) continue;
    firstParaLines.push(line);
    if (firstParaLines.join(" ").length > 400) break;
  }
  const para = firstParaLines.join(" ");
  const first = firstSentence(para);
  return first.replace(/\*\*/g, "").replace(/\*/g, "").trim();
}

function getVerdictLabel(score: number) {
  if (score >= 70) return { label: "Bullish", icon: TrendingUp, gradient: "from-emerald-500 to-green-600" };
  if (score >= 40) return { label: "Neutral", icon: Minus, gradient: "from-amber-500 to-yellow-600" };
  return { label: "Bearish", icon: TrendingDown, gradient: "from-rose-500 to-red-600" };
}

function categorizeSection(title: string): { color: SectionColor; icon: typeof TrendingUp } {
  const t = title.toLowerCase();
  if (/action[:\s]*buy|action[:\s]*accumulat/.test(t)) return { color: "green", icon: Target };
  if (/action[:\s]*sell|action[:\s]*avoid/.test(t)) return { color: "red", icon: Target };
  if (/action|recommend|verdict|outlook|bottom\s*line|conclusion|thesis/.test(t)) return { color: "amber", icon: Target };
  if (/bull|strength|positive|driver|opportunit|catalyst|tailwind|growth/.test(t)) return { color: "green", icon: TrendingUp };
  if (/bear|risk|concern|weakness|threat|downside|headwind|caution|challenge/.test(t)) return { color: "red", icon: TrendingDown };
  if (/valuat|financ|metric|fundament|earning|revenue|margin/.test(t)) return { color: "blue", icon: DollarSign };
  return { color: "neutral", icon: Info };
}

const BULL_KW = /\b(growth|growing|expansion|expand|outperform|strong|robust|healthy|compelling|attractive|undervalued|moat|fortress|generational|aggressive|accumulat|tailwind|momentum|catalyst|leadership|advantage|invincible|pristine|backlog|conviction|beat|exceeded|positive|opportunit|bullish|leader|dominance|durable|impregnable|monopoly|apex)\b/gi;
const RISK_KW = /\b(risk|concern|downside|weakness|headwind|caution|pressure|compression|decline|miss|threat|volatil|geopolitic|regulator|antitrust|inquiry|overhang|expensive|overvalued|elevated|stretched|dependency|exposure|softening|slowdown|debt|bankruptcy|bearish|anxiet|turbulence|sub-plot|competitive\s*threat)\b/gi;

interface Topic {
  id: string;
  title: string;
  icon: typeof TrendingUp;
  defaultColor: SectionColor;
  re: RegExp;
}

// Specific topics, ordered roughly by how unique their keywords are.
// Each paragraph picks the topic with the highest keyword count.
const TOPICS: Topic[] = [
  { id: "earnings",      title: "Earnings & Revenue",     icon: DollarSign,    defaultColor: "blue",  re: /\b(earnings?|revenue|eps|quarterly|fiscal|q[1-4]\b|crushed|beat\s+(?:consensus|estimates)|guidance)\b/gi },
  { id: "margins",       title: "Margin Profile",         icon: DollarSign,    defaultColor: "blue",  re: /\b(profit\s*margin|gross\s*margin|net\s*margin|operating\s*margin|margin\s*expansion|margin\s*compression|gross\s*profit|return\s*on\s*equity|roe)\b/gi },
  { id: "cashflow",      title: "Cash Flow",              icon: DollarSign,    defaultColor: "blue",  re: /\b(cash\s*flow|fcf|free\s*cash\s*flow|cash\s*generation)\b/gi },
  { id: "technical",     title: "Technical Setup",        icon: TrendingUp,    defaultColor: "blue",  re: /\b(rsi|sma|ema|moving\s*average|chart|breakout|consolidation|support|resistance|sideways|trading\s*cycle|price\s*action)\b/gi },
  { id: "returns",       title: "Capital Returns",        icon: DollarSign,    defaultColor: "green", re: /\b(dividend|buyback|share\s*repurchase|payout(?:\s*ratio)?|shareholder\s*yield)\b/gi },
  { id: "analysts",      title: "Analyst Consensus",      icon: Target,        defaultColor: "amber", re: /\b(analyst|wall\s*street|price\s*target|consensus|upgrade|downgrade|rating|coverage)\b/gi },
  { id: "institutional", title: "Institutional Activity", icon: TrendingUp,    defaultColor: "green", re: /\b(institutional|hedge\s*fund|insider(?:\s*(?:buying|selling|accumulation))?|accumulation|holding|conviction|institutional\s*holding)\b/gi },
  { id: "competition",   title: "Competitive Position",   icon: TrendingUp,    defaultColor: "blue",  re: /\b(competit|moat|peer|market\s*share|industry|monopoly|apex|sub-plot|counter-offensive|leader)\b/gi },
  { id: "valuation",     title: "Valuation",              icon: DollarSign,    defaultColor: "blue",  re: /\b(p\/e\b|peg|valuation|multiple|undervalued|overvalued|fair\s*value|dcf|wacc|ebitda|book\s*value|enterprise\s*value|mispriced|premium)\b/gi },
  { id: "risks",         title: "Key Risks",              icon: TrendingDown,  defaultColor: "red",   re: /\b(risk|concern|downside|headwind|threat|caution|pressure|compression|decline|volatil|anxiet|turbulence|overvalued|expensive|stretched|dependency|exposure|regulator|antitrust)\b/gi },
  { id: "outlook",       title: "Outlook",                icon: Target,        defaultColor: "amber", re: /\b(outlook|long[-\s]term|forecast|implies?|implying|upside|projection|future)\b/gi },
];

function countMatches(text: string, re: RegExp): number {
  // Use a fresh regex each time to reset lastIndex on /g flag.
  const fresh = new RegExp(re.source, re.flags);
  const m = text.match(fresh);
  return m ? m.length : 0;
}

function rankTopics(body: string): { topic: Topic; count: number }[] {
  return TOPICS
    .map(t => ({ topic: t, count: countMatches(body, t.re) }))
    .filter(t => t.count >= 2)
    .sort((a, b) => b.count - a.count);
}

function autoCategorizeBody(
  body: string,
  usedTitles: Set<string>,
): { color: SectionColor; title: string; icon: typeof TrendingUp } {
  const bull = countMatches(body, BULL_KW);
  const risk = countMatches(body, RISK_KW);

  // Pick the most specific topic that hasn't been used yet
  const ranked = rankTopics(body);
  const pick = ranked.find(t => !usedTitles.has(t.topic.title));

  if (pick) {
    let color = pick.topic.defaultColor;
    // Override color by overall sentiment if it's clearly bullish or bearish
    if (risk >= 3 && risk > bull) color = "red";
    else if (bull >= 4 && bull > risk * 2 && color === "blue") color = "green";
    return { color, title: pick.topic.title, icon: pick.topic.icon };
  }

  // Nothing matched ≥2 — fall back to broad sentiment label
  if (bull >= 3 && bull > risk) return { color: "green", title: "Strengths & Drivers", icon: TrendingUp };
  if (risk >= 3 && risk > bull) return { color: "red", title: "Risks & Concerns", icon: TrendingDown };
  return { color: "neutral", title: "Overview", icon: Info };
}

function parseSections(content: string): { intro: string; sections: ParsedSection[] } {
  if (!content) return { intro: "", sections: [] };

  const rawCleaned = content
    .replace(/\r\n/g, "\n")
    .replace(/Rating\s+\d+(?:\.\d+)?\s*\/\s*100\.?/gi, "")
    .trim();

  // The verdict pill already shows the first sentence as the TL;DR. Strip it
  // from the body so the first colored card doesn't repeat the same text.
  const firstSent = splitAllSentences(rawCleaned)[0] || "";
  const cleaned = firstSent && rawCleaned.startsWith(firstSent)
    ? rawCleaned.slice(firstSent.length).trimStart()
    : rawCleaned;

  if (!cleaned) return { intro: "", sections: [] };

  // Phase 1: try to parse explicit **Heading:** markers
  const segments: { title: string | null; body: string }[] = [];
  let currentTitle: string | null = null;
  let currentBody: string[] = [];

  const lines = cleaned.split("\n");
  for (const line of lines) {
    const headingInline = line.match(/^\s*\*\*([^*\n]{2,60}?):?\*\*:?\s*(.+)$/);
    const headingStandalone = line.match(/^\s*\*\*([^*\n]{2,60}?):?\*\*:?\s*$/);
    const heading = headingInline || headingStandalone;

    if (heading) {
      if (currentBody.length || currentTitle !== null) {
        segments.push({ title: currentTitle, body: currentBody.join("\n").trim() });
      }
      currentTitle = heading[1].replace(/:$/, "").trim();
      currentBody = [];
      if (headingInline && headingInline[2]) {
        currentBody.push(headingInline[2]);
      }
    } else {
      currentBody.push(line);
    }
  }
  if (currentBody.length || currentTitle !== null) {
    segments.push({ title: currentTitle, body: currentBody.join("\n").trim() });
  }

  // Did we find any actual labeled sections?
  const labeledCount = segments.filter(s => s.title !== null).length;

  // Phase 2 (fallback): if no explicit headings, split unlabeled content into chunks
  // and auto-categorize each one.
  if (labeledCount === 0) {
    const fullText = segments.map(s => s.body).filter(Boolean).join("\n\n").trim() || cleaned;

    // First try splitting by paragraph breaks. If the content is one giant block
    // (no \n\n), fall back to grouping sentences into ~3-sentence chunks so the
    // user still sees the verdict broken into bite-sized colored cards.
    let chunks = fullText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
    if (chunks.length <= 1) {
      const sentences = splitAllSentences(fullText);
      if (sentences.length >= 4) {
        const SENTENCES_PER_CHUNK = 3;
        chunks = chunkSentences(sentences, SENTENCES_PER_CHUNK);
      } else {
        chunks = [fullText];
      }
    }

    const usedTitles = new Set<string>();
    const autoSections: ParsedSection[] = chunks.map(p => {
      const cat = autoCategorizeBody(p, usedTitles);
      usedTitles.add(cat.title);
      return { title: cat.title, body: p, color: cat.color };
    });

    return { intro: "", sections: autoSections };
  }

  // Phase 3: we have labeled sections — keep the original behavior
  let intro = "";
  const sections: ParsedSection[] = [];

  for (const seg of segments) {
    if (!seg.body && !seg.title) continue;
    if (seg.title === null) {
      if (!intro) intro = seg.body;
      else intro += "\n\n" + seg.body;
    } else {
      const { color } = categorizeSection(seg.title);
      sections.push({ title: seg.title, body: seg.body || "—", color });
    }
  }

  return { intro: intro.trim(), sections };
}

const COLOR_STYLES: Record<SectionColor, { border: string; bg: string; title: string; iconBg: string; iconColor: string }> = {
  green: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    title: "text-emerald-400",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
  },
  red: {
    border: "border-rose-500/30",
    bg: "bg-rose-500/5",
    title: "text-rose-400",
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-400",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    title: "text-amber-400",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
  },
  blue: {
    border: "border-sky-500/30",
    bg: "bg-sky-500/5",
    title: "text-sky-400",
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-400",
  },
  neutral: {
    border: "border-border/60",
    bg: "bg-muted/20",
    title: "text-foreground",
    iconBg: "bg-muted/40",
    iconColor: "text-muted-foreground",
  },
};

function IntroBlock({ content }: { content: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <h4 className="font-display font-bold text-xs sm:text-sm text-foreground uppercase tracking-wider">
          Overview
        </h4>
      </div>
      <div className="text-sm sm:text-[15px] leading-relaxed text-foreground/90">
        <FormattedAnalysis content={content} />
      </div>
    </div>
  );
}

function SectionCard({ section }: { section: ParsedSection }) {
  const styles = COLOR_STYLES[section.color];
  const { icon: Icon } = categorizeSection(section.title);

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-4 sm:p-5`}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 rounded-lg ${styles.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`h-4 w-4 ${styles.iconColor}`} />
        </div>
        <h4 className={`font-display font-bold text-sm sm:text-base uppercase tracking-wider ${styles.title}`}>
          {section.title}
        </h4>
      </div>
      <div className="text-sm sm:text-[15px] leading-relaxed text-foreground/90">
        <FormattedAnalysis content={section.body} />
      </div>
    </div>
  );
}

export function VerdictSummary({ content, score, qualityFlags }: VerdictSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const tldr = extractTldr(content);
  const verdict = getVerdictLabel(score);
  const VerdictIcon = verdict.icon;
  const { intro, sections } = parseSections(content);

  const positives = (qualityFlags?.positives || []).filter(Boolean).slice(0, 5);
  const concerns = (qualityFlags?.concerns || []).filter(Boolean).slice(0, 5);
  const hasFlags = positives.length > 0 || concerns.length > 0;
  const hasDetail = hasFlags || !!intro || sections.length > 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Verdict pill — colored header (replaces the gradient tab header) */}
      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${verdict.gradient} p-5 sm:p-6`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" aria-hidden="true" />
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <VerdictIcon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h3 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
                {verdict.label}
              </h3>
              <span className="text-sm sm:text-base text-white/80 font-medium">{score}/100</span>
            </div>
            {tldr && (
              <p className="mt-2 text-sm sm:text-base text-white/95 leading-relaxed">{tldr}</p>
            )}
          </div>
          <div className="hidden sm:block flex-shrink-0">
            <ScoreRing score={score} size={72} onColoredBg />
          </div>
        </div>
      </div>

      {/* Single global toggle — reveals all detail below */}
      {hasDetail && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border bg-background/50 hover:bg-muted/30 hover:border-primary/40 transition-all group"
        >
          <span className="text-sm font-semibold text-foreground">
            {expanded ? "Hide detailed breakdown" : "Read detailed breakdown"}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:translate-y-0.5 transition-transform" />
          )}
        </button>
      )}

      {/* Quick flags (bullet cards) — only when expanded */}
      {expanded && hasFlags && (
        <div className="grid sm:grid-cols-2 gap-3 animate-fade-up">
          {positives.length > 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <span className="font-display font-bold text-xs sm:text-sm text-emerald-400 uppercase tracking-wider">
                  Key strengths
                </span>
              </div>
              <ul className="space-y-1.5">
                {positives.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                    <span className="text-emerald-400 mt-0.5 flex-shrink-0 text-xs">▲</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {concerns.length > 0 && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-7 h-7 rounded-lg bg-rose-500/15 flex items-center justify-center">
                  <ThumbsDown className="h-3.5 w-3.5 text-rose-400" />
                </div>
                <span className="font-display font-bold text-xs sm:text-sm text-rose-400 uppercase tracking-wider">
                  Key risks
                </span>
              </div>
              <ul className="space-y-1.5">
                {concerns.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                    <span className="text-rose-400 mt-0.5 flex-shrink-0 text-xs">▼</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Intro paragraph */}
      {expanded && intro && (
        <div className="animate-fade-up">
          <IntroBlock content={intro} />
        </div>
      )}

      {/* Parsed sections — each in its own color */}
      {expanded && sections.length > 0 && (
        <div className="space-y-3 sm:space-y-4 animate-fade-up">
          {sections.map((section, i) => (
            <SectionCard key={i} section={section} />
          ))}
        </div>
      )}

      {/* Fallback: if no parsed sections and no intro, show raw content */}
      {expanded && !intro && sections.length === 0 && !hasFlags && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5 animate-fade-up">
          <div className="text-sm sm:text-[15px] leading-relaxed text-foreground/90">
            <FormattedAnalysis content={content} />
          </div>
        </div>
      )}
    </div>
  );
}
