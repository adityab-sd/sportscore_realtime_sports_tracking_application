"use client";

import { useState } from "react";
import { Radio, Bot } from "lucide-react";
import AssistantSidebar from "@/components/assistant/AssistantSidebar";
import RadioBar from "@/components/radio/RadioBar";

export default function Navbar() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [radioOpen, setRadioOpen] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <span className="font-bold text-gray-900 text-lg">SportScore</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRadioOpen(!radioOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              radioOpen
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : "text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Radio size={16} />
            Radio
          </button>
          <button
            onClick={() => setAssistantOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-violet-500 rounded-lg hover:bg-violet-600 transition-colors"
          >
            <Bot size={16} />
            Assistant
          </button>
        </div>
      </header>

      <AssistantSidebar open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <RadioBar open={radioOpen} onClose={() => setRadioOpen(false)} />
    </>
  );
}