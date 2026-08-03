"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, CalendarDays, Trophy, Newspaper, Flag, User, BookOpen, Sparkles } from "lucide-react";
import { ChatMessage } from "@/types/assistant";
import { askAssistant } from "@/lib/api/rag";

interface Props { open: boolean; onClose: () => void }

const MAX_QUESTION_CHARS = 500;

// Starters chosen to ALWAYS return a rich, correct answer (great for a demo):
// every one has data behind it right now — fixtures across sports, news, a player
// bio, and a rule. Each carries a colour + category badge.
const STARTERS: { icon: typeof CalendarDays; label: string; hint: string; color: string; bg: string }[] = [
  { icon: CalendarDays, label: "What are the upcoming football matches?", hint: "fixtures",  color: "#2563eb", bg: "#eff6ff" },
  { icon: Trophy,       label: "Upcoming basketball games this week?",     hint: "basketball", color: "#ea580c", bg: "#fff7ed" },
  { icon: Flag,         label: "What are the upcoming F1 races?",          hint: "formula 1",  color: "#dc2626", bg: "#fef2f2" },
  { icon: Newspaper,    label: "Latest football news",                     hint: "news",       color: "#d97706", bg: "#fffbeb" },
  { icon: User,         label: "Who is Lionel Messi?",                     hint: "player",     color: "#7c3aed", bg: "#f5f3ff" },
  { icon: BookOpen,     label: "When is a handball called in soccer?",     hint: "rules",      color: "#0d9488", bg: "#f0fdfa" },
];

// ── date helpers: ISO -> "Today 19:45", "Tomorrow", "16 September 2026" ──
const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z?/;
const ISO_RE_G = new RegExp(ISO_RE.source, "g");
function friendlyDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayT = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((dayT.getTime() - day0.getTime()) / 86400000);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;
  if (diff === -1) return `Yesterday ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · ${time}`;
}
const humanizeDates = (t: string) => t.replace(ISO_RE_G, (iso) => friendlyDate(iso));

const AVATARS = ["#e11d48", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#ea580c", "#4f46e5"];
function crest(name = "") {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { color: AVATARS[h % AVATARS.length], initials: name.split(/\s+/).map(w => w[0] ?? "").join("").slice(0, 3).toUpperCase() };
}
function Crest({ name }: { name: string }) {
  const c = crest(name);
  return <span style={{ width: 22, height: 22, borderRadius: 6, background: c.color, color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{c.initials}</span>;
}

// ── parsers ──
interface ParsedMatch { home: string; away: string; hs: number; as: number; live: boolean }
function parseScores(text: string): ParsedMatch[] {
  const re = /([A-Z][A-Za-z .'&-]{1,26}?)\s+(\d{1,3})\s*[-–:]\s*(\d{1,3})\s+([A-Z][A-Za-z .'&-]{1,26})/g;
  const out: ParsedMatch[] = []; let m: RegExpExecArray | null;
  const live = /\blive\b|in progress|currently/i.test(text) && !/finished|full ?time|final/i.test(text);
  while ((m = re.exec(text)) && out.length < 8) out.push({ home: m[1].trim(), away: m[4].trim(), hs: +m[2], as: +m[3], live });
  return out;
}
interface Fixture { home: string; away: string; when?: string }
function parseFixtures(text: string): { league: string; fixtures: Fixture[] }[] | null {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const groups: { league: string; fixtures: Fixture[] }[] = [];
  let cur: { league: string; fixtures: Fixture[] } | null = null; let found = false;
  for (const line of lines) {
    if (/:$/.test(line) && !/\bvs\b/i.test(line)) { cur = { league: line.replace(/:$/, "").trim(), fixtures: [] }; groups.push(cur); continue; }
    const fx = line.replace(/^\d+\.\s*/, "").match(/^(.+?)\s+vs\s+(.+?)(?:\s*[—–-]\s*(.+?))?\.?$/i);
    if (fx) {
      found = true;
      if (!cur) { cur = { league: "Fixtures", fixtures: [] }; groups.push(cur); }
      const iso = fx[3]?.match(ISO_RE)?.[0];
      cur.fixtures.push({ home: fx[1].trim(), away: fx[2].trim(), when: iso ? friendlyDate(iso) : fx[3]?.trim() });
    }
  }
  return found ? groups.filter(g => g.fixtures.length) : null;
}
interface NewsItem { headline: string; when?: string }
function parseNews(text: string): NewsItem[] | null {
  const items: NewsItem[] = [];
  for (const line of text.split("\n").map(l => l.trim())) {
    const m = line.match(/^\d+\.\s*(.+)$/); if (!m) continue;
    let body = m[1]; const iso = body.match(ISO_RE)?.[0];
    if (iso) body = body.replace(iso, "").replace(/[—–(\-\s]+$/, "").replace(/\)\s*\.?$/, "").trim();
    items.push({ headline: body.replace(/\.$/, ""), when: iso ? friendlyDate(iso) : undefined });
  }
  return items.length ? items : null;
}

// ── cards ──
function ScoreCard({ m }: { m: ParsedMatch }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderLeft: `3px solid ${m.live ? "#10b981" : "#94a3b8"}`, borderRadius: 12, background: "var(--white)", padding: "10px 12px", marginTop: 6, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: "var(--text-muted)", textTransform: "uppercase" }}>Result</span>
        {m.live ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#059669" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "livePulse 1s ease-in-out infinite" }} /> LIVE</span> : <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Full time</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}><Crest name={m.home} /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.home}</span></div>
        <span style={{ fontSize: 18, fontWeight: 800, color: "var(--obsidian)", fontVariantNumeric: "tabular-nums", padding: "0 4px" }}>{m.hs}–{m.as}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, justifyContent: "flex-end" }}><span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.away}</span><Crest name={m.away} /></div>
      </div>
    </div>
  );
}
function FixtureGroups({ groups }: { groups: { league: string; fixtures: Fixture[] }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {groups.map((g, gi) => (
        <div key={gi}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: "var(--indigo)", textTransform: "uppercase", marginBottom: 6 }}>{g.league}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {g.fixtures.map((f, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--white)", padding: "10px 12px", boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}><Crest name={f.home} /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.home}</span></div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>vs</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, justifyContent: "flex-end" }}><span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.away}</span><Crest name={f.away} /></div>
                </div>
                {f.when && <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 11, fontWeight: 600, color: "var(--indigo)" }}><CalendarDays size={12} /> {f.when}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
function NewsList({ items }: { items: NewsItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {items.map((n, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--white)", padding: "10px 12px", display: "flex", gap: 10, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: "#fffbeb", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}><Newspaper size={13} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: "var(--obsidian)" }}>{n.headline}</div>
            {n.when && <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginTop: 3 }}>{n.when}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
function renderBold(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>);
}
function TextBody({ text }: { text: string }) {
  const lines = humanizeDates(text).split("\n").filter(l => l.trim());
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {lines.map((line, i) => {
        const num = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (num) return <div key={i} style={{ display: "flex", gap: 7 }}><span style={{ minWidth: 18, height: 18, borderRadius: 5, background: "var(--indigo-light)", color: "var(--indigo)", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{num[1]}</span><span>{renderBold(num[2])}</span></div>;
        if (/:$/.test(line.trim()) && line.trim().length < 42) return <div key={i} style={{ fontWeight: 700, marginTop: 2 }}>{line.trim()}</div>;
        return <div key={i}>{renderBold(line)}</div>;
      })}
    </div>
  );
}
function AssistantContent({ content, citations }: { content: string; citations?: string[] }) {
  const isNews = !!citations?.length && citations.filter(c => /news/i.test(c)).length >= Math.ceil(citations.length / 2);
  if (isNews) { const n = parseNews(content); if (n && n.length >= 2) return <NewsList items={n} />; }
  const fx = parseFixtures(content);
  if (fx && fx.reduce((a, g) => a + g.fixtures.length, 0) >= 2) {
    const intro = content.split("\n").find(l => l.trim() && !/vs/i.test(l) && !/:$/.test(l.trim()));
    return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{intro && <TextBody text={intro} />}<FixtureGroups groups={fx} /></div>;
  }
  const scores = parseScores(content);
  return <div><TextBody text={content} />{scores.map((m, i) => <ScoreCard key={i} m={m} />)}</div>;
}

export default function AssistantSidebar({ open, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open, loading]);

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || loading || question.length > MAX_QUESTION_CHARS) return;
    setMessages(p => [...p, { id: Date.now().toString(), role: "user", content: question }]);
    setInput(""); setLoading(true);
    const data = await askAssistant(question);
    if (!isMountedRef.current) return;
    const friendly = (data?.error || "").includes("rate_limit")
      ? "I'm getting a lot of requests right now — give me a few seconds and ask again."
      : (data?.error ?? "Sorry, I couldn't reach the assistant right now. Please try again in a moment.");
    const reply: ChatMessage = (data && !data.error)
      ? { id: (Date.now() + 1).toString(), role: "assistant", content: data.answer, citations: data.sources?.map(s => `${s.title} (${s.category})`) }
      : { id: (Date.now() + 1).toString(), role: "assistant", content: friendly };
    setMessages(p => [...p, reply]); setLoading(false);
  }

  const empty = messages.length === 0;

  return (
    <>
      {open && <button type="button" aria-label="Close assistant overlay" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.28)", backdropFilter: "blur(2px)", border: "none", padding: 0, cursor: "pointer", zIndex: 40 }} />}
      <div style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "100%", maxWidth: 420, background: "var(--white)", borderLeft: "1px solid var(--border)", zIndex: 50, display: "flex", flexDirection: "column", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 300ms cubic-bezier(0.32,0.72,0,1)", boxShadow: open ? "-16px 0 48px rgba(15,23,42,0.12)" : "none" }}>
        {/* Header with gradient */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", background: "linear-gradient(135deg, var(--indigo) 0%, #4f46e5 100%)", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}><Bot size={17} color="#fff" /></div>
            <div><div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.2 }}>Benchwarmer</div><div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)" }}>Warming the bench, watching every game.</div></div>
          </div>
          <button type="button" aria-label="Close assistant" onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", color: "#fff", padding: 6, borderRadius: 8, display: "flex" }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px 8px", display: "flex", flexDirection: "column", gap: 12, background: "linear-gradient(180deg, var(--indigo-light) 0%, var(--white) 90px)" }}>
          {empty && (
            <div style={{ padding: "2px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--indigo)", background: "var(--white)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 20, marginBottom: 10 }}><Sparkles size={12} /> AI SPORTS ASSISTANT</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--obsidian)", letterSpacing: -0.4 }}>Hey, I&apos;m Benchwarmer.</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55, marginTop: 6, marginBottom: 14 }}>Live scores, fixtures, goals, news, players, and the rules of the game — across football, basketball, baseball and F1. Try one:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {STARTERS.map(({ icon: Icon, label, hint, color, bg }) => (
                  <button key={label} type="button" onClick={() => send(label)}
                    style={{ display: "flex", alignItems: "center", gap: 11, textAlign: "left", padding: "11px 12px", border: "1px solid var(--border)", borderRadius: 14, background: "var(--white)", cursor: "pointer", transition: "transform 120ms, box-shadow 120ms, border-color 120ms", boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(16,24,40,0.10)"; e.currentTarget.style.borderColor = color; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(16,24,40,0.04)"; e.currentTarget.style.borderColor = "var(--border)"; }}>
                    <span style={{ width: 32, height: 32, borderRadius: 9, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={16} /></span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--obsidian)", lineHeight: 1.3 }}>{label}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color, background: bg, padding: "3px 7px", borderRadius: 20 }}>{hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: msg.role === "user" ? "88%" : "100%", alignSelf: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeSlideUp 0.25s ease both" }}>
              <div style={{ padding: "11px 14px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", fontSize: 13, lineHeight: 1.55, background: msg.role === "user" ? "linear-gradient(135deg, var(--indigo) 0%, #4f46e5 100%)" : "var(--cloud)", color: msg.role === "user" ? "#fff" : "var(--obsidian)", width: msg.role === "assistant" ? "100%" : "auto", boxShadow: msg.role === "user" ? "0 2px 8px rgba(79,70,229,0.25)" : "none" }}>
                {msg.role === "assistant" ? <AssistantContent content={msg.content} citations={msg.citations} /> : msg.content}
              </div>
              {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                <details style={{ marginTop: 5, width: "100%" }}>
                  <summary style={{ fontSize: 11, color: "var(--text-muted)", cursor: "pointer", listStyle: "none" }}>📎 {msg.citations.length} source{msg.citations.length > 1 ? "s" : ""}</summary>
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>{msg.citations.map((c, i) => <div key={i} style={{ fontSize: 11, color: "var(--text-muted)" }}>• {c}</div>)}</div>
                </details>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ alignSelf: "flex-start", background: "var(--cloud)", borderRadius: "16px 16px 16px 4px", padding: "12px 15px" }}>
              <span style={{ display: "inline-flex", gap: 4 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--indigo-mid)", display: "inline-block", animation: `livePulse 1s ease-in-out ${i * 0.2}s infinite` }} />)}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, background: "var(--white)" }}>
          <input type="text" value={input} maxLength={MAX_QUESTION_CHARS} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask about rules, players, live scores..."
            style={{ flex: 1, fontSize: 13, padding: "11px 15px", border: "1px solid var(--border)", borderRadius: 22, outline: "none", color: "var(--obsidian)", background: "var(--white)", transition: "border-color 120ms, box-shadow 120ms" }}
            onFocus={e => { e.target.style.borderColor = "var(--indigo)"; e.target.style.boxShadow = "0 0 0 3px var(--indigo-light)"; }}
            onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }} />
          <button type="button" aria-label="Send message" onClick={() => send()} disabled={!input.trim() || loading}
            style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, var(--indigo) 0%, #4f46e5 100%)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() && !loading ? "pointer" : "not-allowed", opacity: input.trim() && !loading ? 1 : 0.5, transition: "opacity 120ms", flexShrink: 0, boxShadow: "0 2px 8px rgba(79,70,229,0.3)" }}>
            <Send size={16} color="#fff" />
          </button>
        </div>
      </div>
    </>
  );
}