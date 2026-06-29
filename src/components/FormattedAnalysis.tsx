import { ReactNode } from "react";

interface FormattedAnalysisProps {
  content: string;
  tabColor?: string;
}

// ─── Clean input ──────────────────────────────────────────────────────────────

function clean(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/�/g, "")
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s*[\-–]?\s*Rating\s+\d+(?:\.\d+)?\s*\/\s*100\.?\s*$/i, "")
    .trim();
}

// ─── Sentence splitter ────────────────────────────────────────────────────────

const ABBREV = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|Corp|Inc|Ltd|LLC|Co|etc|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|No|Vol|Fig|pp|cf|al|U\.S|e\.g|i\.e)\s*$/i;

function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    const after = text.slice(i + 1);
    if (!/^\s+[A-Z"'(]/.test(after)) continue;
    const before = text.slice(Math.max(0, i - 12), i + 1);
    if (ABBREV.test(before)) continue;
    if (i > 0 && /\d/.test(text[i - 1]) && /\s*\d/.test(after)) continue;
    out.push(text.slice(start, i + 1).trim());
    start = i + 1;
    while (start < text.length && /\s/.test(text[start])) start++;
    i = start - 1;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out.filter(Boolean);
}

function groupSentences(sentences: string[], perChunk = 3): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += perChunk) {
    const chunk = sentences.slice(i, i + perChunk).join(" ").trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

// ─── Highlight rules ──────────────────────────────────────────────────────────
// Each rule: regex + style class. Evaluated in order — first match wins per token.

interface HighlightRule {
  re: RegExp;
  cls: string;
  prefix?: string;  // optional symbol prepended (e.g. "↑ ")
}

const RULES: HighlightRule[] = [
  // ── Explicit markdown bold  **text** ─────────────────────────────────────
  { re: /\*\*(.*?)\*\*/g, cls: "font-semibold text-foreground" },

  // ── Explicit markdown italic  *text* ─────────────────────────────────────
  { re: /\*(.*?)\*/g, cls: "italic text-foreground/90" },

  // ── $ amounts + optional scale word ("$9 billion", "$26.53", "$1.2T") ────
  { re: /\$\d[\d,]*(?:\.\d+)?(?:\s*(?:billion|million|trillion|[BMT]))?(?=\b|\s|,|\.)/gi, cls: "font-semibold text-emerald-400 bg-emerald-500/10 px-0.5 rounded" },

  // ── Percentages (signed or unsigned) ─────────────────────────────────────
  { re: /[+-]?\d+\.?\d*%/g, cls: "" /* handled inline for sign */ },

  // ── Bullish signal words ──────────────────────────────────────────────────
  { re: /\b(Strong\s+Buy|Buy|Bullish|Outperform|Overweight|Accumulate)\b/gi, cls: "font-bold text-emerald-400", prefix: "↑ " },

  // ── Bearish signal words ──────────────────────────────────────────────────
  { re: /\b(Strong\s+Sell|Sell|Bearish|Underperform|Underweight|Reduce)\b/gi, cls: "font-bold text-rose-400", prefix: "↓ " },

  // ── Neutral signal words ──────────────────────────────────────────────────
  { re: /\b(Hold|Neutral|Market\s+Perform)\b/gi, cls: "font-semibold text-amber-400" },

  // ── Metric acronyms ───────────────────────────────────────────────────────
  { re: /\b(P\/E|EV\/EBITDA|P\/S|P\/B|RSI|SMA\s*\d+|EMA\s*\d+|MACD|EPS|ROE|ROA|FCF|EBITDA|CAGR|YoY|QoQ|TTM|WACC|DCF|NAV)\b/gi, cls: "font-mono text-xs font-semibold text-sky-400 bg-sky-500/10 px-0.5 rounded" },

  // ── Bullish key phrases (green pill) ─────────────────────────────────────
  {
    re: /\b((?:mathematically\s+)?floored?|war\s+chest|cash\s+(?:reserve|floor|pile|position)|margin\s+expansion|revenue\s+growth|profit\s+margin|market\s+share|competitive\s+advantage|moat|undervalued|fair\s+value|attractive\s+valuation|high-margin|recurring\s+(?:revenue|income)|growth\s+trajectory|strong\s+(?:balance\s+sheet|fundamentals|earnings|cash\s+flow)|short\s+squeeze|catalyst|breakout|bullish\s+(?:momentum|signal|setup))\b/gi,
    cls: "text-emerald-300 bg-emerald-500/15 px-1 rounded font-medium",
  },

  // ── Bearish / risk phrases (red pill) ────────────────────────────────────
  {
    re: /\b(short\s+interest|overvalued|overbought|oversold|downside\s+risk|bankruptcy|debt\s+(?:load|burden|spiral)|declining\s+(?:revenue|earnings|margins?)|revenue\s+decay|margin\s+compression|integration\s+risk|liquidity\s+(?:risk|crunch)|hostile\s+takeover|leveraged\s+buyout|highly\s+(?:leveraged|indebted)|red\s+flag)\b/gi,
    cls: "text-rose-300 bg-rose-500/15 px-1 rounded font-medium",
  },

  // ── Notable financial / strategic phrases (amber pill) ───────────────────
  {
    re: /\b(acquisition|merger|spinoff|split|buyback|(?:share\s+)?repurchase|dividend\s+(?:cut|increase|yield)|M&A|IPO|secondary\s+offering|insider\s+(?:buying|selling|activity)|institutional\s+(?:buying|selling|ownership)|hedge\s+fund|private\s+equity|holding\s+company|war\s+chest|compensation\s+package|valuation)\b/gi,
    cls: "text-amber-300 bg-amber-500/15 px-1 rounded font-medium",
  },
];

// ─── Token renderer ───────────────────────────────────────────────────────────

function renderTokens(text: string): ReactNode[] {
  // Build a flat list of [start, end, ReactNode] spans from all rules,
  // then fill gaps with plain text. Rules are applied in priority order;
  // overlapping ranges from lower-priority rules are skipped.

  type Span = { s: number; e: number; node: ReactNode };
  const spans: Span[] = [];

  const overlaps = (s: number, e: number) =>
    spans.some(sp => s < sp.e && e > sp.s);

  for (const rule of RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const s = m.index;
      const e = s + m[0].length;
      if (overlaps(s, e)) continue;

      const inner = m[1] ?? m[0]; // use capture group if present, else full match
      const raw = m[0];

      let node: ReactNode;

      // Special case: percentages — color by sign
      if (/^[+-]?\d+\.?\d*%$/.test(raw)) {
        const neg = raw.startsWith("-");
        node = (
          <span key={`${s}`} className={`font-semibold ${neg ? "text-rose-400" : "text-emerald-400"}`}>
            {raw}
          </span>
        );
      } else if (rule.re.source.startsWith("\\*\\*(")) {
        // **bold**
        node = <strong key={`${s}`} className={rule.cls}>{inner}</strong>;
      } else if (rule.re.source.startsWith("\\*(")) {
        // *italic*
        node = <em key={`${s}`} className={rule.cls}>{inner}</em>;
      } else if (rule.prefix) {
        node = (
          <span key={`${s}`} className={rule.cls}>
            {rule.prefix}{raw}
          </span>
        );
      } else {
        node = <span key={`${s}`} className={rule.cls}>{raw}</span>;
      }

      spans.push({ s, e, node });
    }
  }

  if (spans.length === 0) return [text];

  // Sort by start position
  spans.sort((a, b) => a.s - b.s);

  const result: ReactNode[] = [];
  let cursor = 0;
  for (const sp of spans) {
    if (sp.s > cursor) result.push(text.slice(cursor, sp.s));
    result.push(sp.node);
    cursor = sp.e;
  }
  if (cursor < text.length) result.push(text.slice(cursor));
  return result;
}

// ─── Inline renderer (first sentence emphasis) ────────────────────────────────

function renderInline(text: string, emphFirst = false): ReactNode {
  if (emphFirst) {
    const sentences = splitSentences(text);
    if (sentences.length > 1) {
      return (
        <>
          <span className="font-medium text-foreground">{renderTokens(sentences[0])} </span>
          <span className="text-foreground/80">{renderTokens(sentences.slice(1).join(" "))}</span>
        </>
      );
    }
  }
  return <>{renderTokens(text)}</>;
}

// ─── Block types ──────────────────────────────────────────────────────────────

type Block =
  | { kind: "heading"; text: string }
  | { kind: "bullet"; items: string[] }
  | { kind: "para"; text: string; lead?: boolean };

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseContent(raw: string): Block[] {
  const text = clean(raw);
  if (!text) return [];

  const blocks: Block[] = [];

  const lines = text.split("\n");
  const hasStructure = lines.some(l => /^\s*[-*•]\s+/.test(l) || /^#{1,3}\s/.test(l) || /^\d+\.\s+/.test(l));
  const hasDoubleNewlines = text.includes("\n\n");

  if (hasStructure || hasDoubleNewlines) {
    let bulletAccum: string[] = [];
    let paraAccum: string[] = [];

    const flushBullets = () => {
      if (!bulletAccum.length) return;
      blocks.push({ kind: "bullet", items: [...bulletAccum] });
      bulletAccum = [];
    };
    const flushPara = () => {
      if (!paraAccum.length) return;
      const joined = paraAccum.join(" ").trim();
      if (!joined) { paraAccum = []; return; }
      const sents = splitSentences(joined);
      if (sents.length > 6) {
        groupSentences(sents, 4).forEach(chunk =>
          blocks.push({ kind: "para", text: chunk })
        );
      } else {
        blocks.push({ kind: "para", text: joined });
      }
      paraAccum = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { flushBullets(); flushPara(); continue; }
      if (/^#{1,3}\s/.test(line)) {
        flushBullets(); flushPara();
        blocks.push({ kind: "heading", text: line.replace(/^#{1,3}\s*/, "") });
        continue;
      }
      if (/^\*\*[^*]{2,60}\*\*:?\s*$/.test(line)) {
        flushBullets(); flushPara();
        blocks.push({ kind: "heading", text: line.replace(/\*\*/g, "").replace(/:$/, "") });
        continue;
      }
      if (/^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
        flushPara();
        bulletAccum.push(line.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, ""));
        continue;
      }
      flushBullets();
      paraAccum.push(line);
    }

    flushBullets();
    flushPara();

    if (blocks.length > 0) {
      blocks[0] = { ...blocks[0], ...(blocks[0].kind === "para" ? { lead: true } : {}) };
      return blocks;
    }
  }

  const sentences = splitSentences(text);
  if (sentences.length === 0) return [{ kind: "para", text, lead: true }];
  const chunks = groupSentences(sentences, 4);
  return chunks.map((chunk, i) => ({ kind: "para" as const, text: chunk, lead: i === 0 }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FormattedAnalysis({ content }: FormattedAnalysisProps) {
  if (!content) return null;
  const safeContent = typeof content === "string" ? content : String(content);
  const blocks = parseContent(safeContent);

  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <h4 key={i} className="font-semibold text-foreground text-base uppercase tracking-wide mt-6 mb-2 flex items-center gap-2">
              <span className="w-4 h-px bg-primary/50 inline-block" />
              {renderTokens(block.text)}
            </h4>
          );
        }

        if (block.kind === "bullet") {
          return (
            <ul key={i} className="space-y-2.5 pl-2">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-3 text-foreground/85 text-base leading-relaxed">
                  <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                  <span>{renderTokens(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="text-base leading-[1.85] text-foreground/85">
            {renderInline(block.text, block.lead)}
          </p>
        );
      })}
    </div>
  );
}
