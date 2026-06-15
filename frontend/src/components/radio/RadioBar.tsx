"use client";

import { useState } from "react";
import { Radio, X, Play, Pause, Volume2 } from "lucide-react";
import { mockRadioEvents } from "@/lib/mock/radioData";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function RadioBar({ open, onClose }: Props) {
  const [playing, setPlaying] = useState(true);
  const current = mockRadioEvents[0];

  if (!open) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex-shrink-0">
          <Radio size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
              Radio Mode
            </span>
            <span className="text-xs text-gray-400">• {current.match}</span>
          </div>
          <p className="text-sm text-gray-800 truncate">{current.text}</p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setPlaying(!playing)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors hidden sm:flex">
            <Volume2 size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}