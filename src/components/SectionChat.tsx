import { useState, useRef, useEffect } from "react";
import React from "react";
import { Send, Sparkles, MessageCircle, X, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchAuthSession } from "aws-amplify/auth";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SectionChatProps {
  sectionName: string;
  sectionContent: string;
  stockSymbol: string;
  suggestedQuestions: string[];
  /** Full stringified analysis (all tabs) — gives the AI complete context */
  fullContext?: string;
}

const API_URL = import.meta.env.VITE_AWS_API_URL || "http://localhost:8000";

/** Render inline markdown: **bold**, *italic*, `code` */
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="bg-black/20 rounded px-1 text-xs font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
}

/** Render assistant markdown content as React nodes */
function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (!line.trim()) { i++; continue; }

    // Heading ### / ## / #
    const hMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = level === 1 ? "text-base font-bold mt-3 mb-1" : level === 2 ? "text-sm font-bold mt-3 mb-1" : "text-sm font-semibold mt-2 mb-0.5";
      nodes.push(<p key={i} className={cls}>{renderInline(hMatch[2])}</p>);
      i++; continue;
    }

    // Horizontal rule ***  ---
    if (/^\*{3,}$/.test(line.trim()) || /^-{3,}$/.test(line.trim())) {
      nodes.push(<hr key={i} className="border-border/50 my-2" />);
      i++; continue;
    }

    // Unordered list block
    if (/^\s*[-*]\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        const text = lines[i].replace(/^\s*[-*]\s/, "");
        items.push(<li key={i} className="ml-3 list-disc list-inside">{renderInline(text)}</li>);
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className="my-1 space-y-0.5 text-sm">{items}</ul>);
      continue;
    }

    // Ordered list block
    if (/^\s*\d+\.\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        const text = lines[i].replace(/^\s*\d+\.\s/, "");
        items.push(<li key={i} className="ml-3 list-decimal list-inside">{renderInline(text)}</li>);
        i++;
      }
      nodes.push(<ol key={`ol-${i}`} className="my-1 space-y-0.5 text-sm">{items}</ol>);
      continue;
    }

    // Regular paragraph
    nodes.push(<p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>);
    i++;
  }

  return <div className="space-y-1">{nodes}</div>;
}

export function SectionChat({
  sectionName,
  sectionContent,
  stockSymbol,
  suggestedQuestions,
  fullContext,
}: SectionChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (userMessage: string) => {
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    let token: string | undefined;
    try {
      const session = await fetchAuthSession();
      token = session.tokens?.idToken?.toString();
    } catch {
      // unauthenticated — endpoint will reject if it requires auth
    }

    try {
      const resp = await fetch(`${API_URL}/chat/section`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          symbol: stockSymbol,
          section_name: sectionName,
          section_content: sectionContent,
          full_context: fullContext ?? null,
          messages: newMessages,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 401) {
          toast.error("Please sign in to use the AI chat.");
        } else if (resp.status === 402) {
          toast.error("Insufficient credits. Visit Pricing to add more.");
        } else if (resp.status === 429) {
          toast.error("Rate limit reached. Please wait a moment.");
        } else {
          toast.error("AI chat unavailable. Please try again.");
        }
        setIsLoading(false);
        return;
      }

      const { job_id } = await resp.json();
      
      // Poll for results
      let attempts = 0;
      const maxAttempts = 20; // 20 * 15s = 300s (5 mins)
      
      const poll = async () => {
        try {
          const statusResp = await fetch(`${API_URL}/chat/section/${job_id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          
          if (!statusResp.ok) throw new Error("Status check failed");
          
          const statusData = await statusResp.json();
          
          if (statusData.status === "completed") {
            setMessages([...newMessages, { role: "assistant", content: statusData.content }]);
            setIsLoading(false);
          } else if (statusData.status === "failed") {
            toast.error(statusData.error_message || "AI failed to generate a response.");
            setIsLoading(false);
          } else {
            // Still running, poll again
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(poll, 10000);
            } else {
              toast.error("AI is taking too long. Please try again later.");
              setIsLoading(false);
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
          toast.error("Connection lost while waiting for AI.");
          setIsLoading(false);
        }
      };

      // Start polling
      setTimeout(poll, 1500);

    } catch (err) {
      console.error("Chat error:", err);
      toast.error("Failed to connect to AI assistant.");
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const msg = input.trim();
    setInput("");
    sendMessage(msg);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 mt-4 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30 border border-primary/30 transition-all duration-300 group"
      >
        <MessageCircle className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
        <span className="text-sm font-medium">Ask AI about this analysis</span>
        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-primary/30 bg-gradient-to-br from-card to-secondary/30 overflow-hidden animate-scale-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/20 to-accent/20 border-b border-primary/20">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-display font-semibold text-sm">AI Assistant · {stockSymbol}</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground border border-border/50 rounded-full px-2 py-0.5">
            <Globe className="h-3 w-3" /> Web search enabled
          </span>
        </div>
        <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-white/10 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Suggested Questions */}
      {messages.length === 0 && suggestedQuestions.length > 0 && (
        <div className="p-4 border-b border-border/50">
          <p className="text-xs text-muted-foreground mb-2">Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 border border-border/50 hover:border-primary/30 transition-all disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="h-72 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 mt-1 mr-2">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            )}
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm text-sm leading-relaxed whitespace-pre-wrap"
                  : "bg-secondary/80 text-foreground rounded-bl-sm"
              }`}
            >
              {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <div className="bg-secondary/80 px-3 py-2.5 rounded-xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border/50 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${stockSymbol} or search the web...`}
          className="flex-1 bg-secondary/50 border-border/50 text-sm"
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
