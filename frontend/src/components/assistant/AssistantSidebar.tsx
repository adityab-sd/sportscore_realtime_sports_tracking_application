"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Bot } from "lucide-react";
import { mockConversation } from "@/lib/mock/assistantData";
import { ChatMessage } from "@/types/assistant";
import { askAssistant } from "@/lib/api/rag";

interface Props { open: boolean; onClose: () => void }

export default function AssistantSidebar({ open, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(mockConversation);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Guards against setMessages/setLoading firing after the component has
  // unmounted (e.g. sidebar closed while a request is still in flight) —
  // addresses the earlier review note about the old setTimeout doing this.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function handleSend() {
    if (!input.trim()) return;
    const question = input;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: question };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const data = await askAssistant(question);

    if (!isMountedRef.current) return; // sidebar closed while we were waiting

    if (data && !data.error) {
      const reply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
        citations: data.sources?.map(s => `${s.title} (${s.category})`),
      };
      setMessages(prev => [...prev, reply]);
    } else {
      // Either askAssistant() returned null (network failure reaching the
      // Java gateway) or the gateway/Flask responded with an error field.
      const reply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          data?.error ??
          "Sorry, I couldn't reach the Knowledge Assistant right now. Please try again in a moment.",
      };
      setMessages(prev => [...prev, reply]);
    }

    setLoading(false);
  }

  return (
    <>
      {/* PLEASE review — clickable backdrop is not keyboard accessible: a div with onClick cannot be dismissed by keyboard users. EXAMPLE: <button type="button" aria-label="Close assistant overlay" onClick={onClose} style={backdropStyle} />. */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.18)",
            zIndex: 40,
          }}
        />
      )}
      <div
        style={{
          position: "fixed", top: 0, right: 0,
          height: "100%", width: "100%", maxWidth: 400,
          background: "var(--white)",
          borderLeft: "1px solid var(--border)",
          zIndex: 50,
          display: "flex", flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 280ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px",
          borderBottom: "1px solid var(--border)",
          background: "var(--indigo-light)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--indigo)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bot size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)" }}>Knowledge Assistant</div>
              <div style={{ fontSize: 11, color: "var(--indigo-text)" }}>Powered by Azure OpenAI</div>
            </div>
          </div>
          {/* PLEASE review — icon-only close button needs an accessible name. EXAMPLE: <button type="button" aria-label="Close assistant" onClick={onClose}>...</button>. */}
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: "flex", flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                animation: "fadeSlideUp 0.25s ease both",
              }}
            >
              <div style={{
                padding: "10px 14px",
                borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                fontSize: 13,
                lineHeight: 1.55,
                background: msg.role === "user" ? "var(--indigo)" : "var(--cloud)",
                color: msg.role === "user" ? "#fff" : "var(--obsidian)",
              }}>
                {msg.content}
              </div>
              {msg.citations?.map((c, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10 }}>📎</span> {c}
                </div>
              ))}
            </div>
          ))}
          {loading && (
            <div style={{
              alignSelf: "flex-start", background: "var(--cloud)",
              borderRadius: "14px 14px 14px 4px",
              padding: "10px 14px", fontSize: 13, color: "var(--text-muted)",
            }}>
              <span style={{ display: "inline-flex", gap: 3 }}>
                {[0,1,2].map(i => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "var(--indigo-mid)", display: "inline-block",
                    animation: `livePulse 1s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          borderTop: "1px solid var(--border)",
          padding: "12px 14px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Ask about rules, players, stats..."
            style={{
              flex: 1, fontSize: 13, padding: "9px 14px",
              border: "1px solid var(--border)", borderRadius: 20,
              outline: "none", color: "var(--obsidian)",
              background: "var(--white)",
              transition: "border-color 120ms",
            }}
            onFocus={e => (e.target.style.borderColor = "var(--indigo)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <button
            onClick={handleSend}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--indigo)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "background 120ms", flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--indigo-mid)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--indigo)")}
          >
            {/* PLEASE review — send icon button needs an accessible name. EXAMPLE: <button type="button" aria-label="Send assistant message" onClick={handleSend}>...</button>. */}
            <Send size={15} color="#fff" />
          </button>
        </div>
      </div>
    </>
  );
}