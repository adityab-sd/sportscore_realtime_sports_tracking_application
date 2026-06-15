"use client";

import { useState } from "react";
import { X, Send, Bot } from "lucide-react";
import { mockConversation } from "@/lib/mock/assistantData";
import { ChatMessage } from "@/types/assistant";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AssistantSidebar({ open, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(mockConversation);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSend() {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // Mock streaming response
    setTimeout(() => {
      const reply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "This is a mock response. Real answers will be powered by the Knowledge Assistant once the RAG pipeline is connected.",
      };
      setMessages(prev => [...prev, reply]);
      setLoading(false);
    }, 1000);
  }

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white border-l border-gray-200 z-50 transform transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-violet-50">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-violet-500" />
            <span className="font-semibold text-gray-900">Knowledge Assistant</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] ${
                msg.role === "user" ? "self-end items-end" : "self-start items-start"
              }`}
            >
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-violet-100 text-gray-900"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.content}
              </div>
              {msg.citations && (
                <div className="mt-1 flex flex-col gap-0.5">
                  {msg.citations.map((c, i) => (
                    <span key={i} className="text-xs text-gray-400">
                      📎 {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="self-start bg-gray-100 rounded-2xl px-4 py-2.5 text-sm text-gray-400">
              Thinking...
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-3 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about rules, players, stats..."
            className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-full focus:outline-none focus:border-violet-300 text-black"
          />
          <button
            onClick={handleSend}
            className="p-2 bg-violet-500 text-white rounded-full hover:bg-violet-600 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </>
  );
}