"use client";

import { Radio, Bot } from "lucide-react";

export default function Navbar() {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <span className="font-bold text-gray-900 text-lg">SportScore</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => alert("Radio Mode — coming soon")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Radio size={16} />
          Radio
        </button>
        <button
          onClick={() => alert("AI Assistant — coming soon")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Bot size={16} />
          Assistant
        </button>
      </div>
    </header>
  );
}