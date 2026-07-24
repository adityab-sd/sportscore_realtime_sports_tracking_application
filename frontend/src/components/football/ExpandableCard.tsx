"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

interface ExpandableCardProps {
  title: string;
  src: string | null;
  /** Fallback initials shown when `src` is empty (e.g. no headshot on file). */
  initials?: string;
  accentColor?: string | null;
  description: string;
  children?: React.ReactNode;
  className?: string;
  classNameExpanded?: string;
  [key: string]: unknown;
}

function Media({
  src, title, initials, accentColor, className,
}: { src: string | null; title: string; initials?: string; accentColor?: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={title} className={className} style={{ objectPosition: "top" }} />;
  }
  return (
    <div
      className={className}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        background: accentColor ? `linear-gradient(135deg, ${accentColor} 0%, #0a1628 100%)` : "linear-gradient(135deg, #1e3a5f 0%, #0a1628 100%)",
        color: "rgba(255,255,255,0.9)", fontWeight: 800, letterSpacing: "-0.5px",
      }}
    >
      {initials ?? "?"}
    </div>
  );
}

export function ExpandableCard({
  title,
  src,
  initials,
  accentColor,
  description,
  children,
  className,
  classNameExpanded,
  ...props
}: ExpandableCardProps) {
  const [active, setActive] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const id = React.useId();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(false);
    };
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setActive(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/60 backdrop-blur-md h-full w-full z-[100]"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {active && (
          <div className="fixed inset-0 grid place-items-center z-[101] p-4">
            <motion.div
              layoutId={`card-${title}-${id}`}
              ref={cardRef}
              className={cn(
                "w-full max-w-[560px] max-h-[85vh] flex flex-col overflow-auto [scrollbar-width:none] rounded-2xl bg-white shadow-2xl relative",
                classNameExpanded,
              )}
              {...(props as Record<string, unknown>)}
            >
              <motion.div layoutId={`image-${title}-${id}`}>
                <Media
                  src={src} title={title} initials={initials} accentColor={accentColor}
                  className="w-full h-56 object-cover object-center block"
                />
              </motion.div>
              <div className="relative px-6 py-5">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <motion.p layoutId={`description-${description}-${id}`} className="text-sm font-semibold" style={{ color: "var(--navy)" }}>
                      {description}
                    </motion.p>
                    <motion.h3 layoutId={`title-${title}-${id}`} className="font-extrabold text-2xl mt-0.5" style={{ color: "var(--obsidian)", letterSpacing: "-0.4px" }}>
                      {title}
                    </motion.h3>
                  </div>
                  <motion.button
                    aria-label="Close card"
                    layoutId={`button-${title}-${id}`}
                    onClick={() => setActive(false)}
                    className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full border transition-colors"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    <motion.div animate={{ rotate: active ? 45 : 0 }} transition={{ duration: 0.3 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" /><path d="M12 5v14" />
                      </svg>
                    </motion.div>
                  </motion.button>
                </div>
                <motion.div
                  layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="mt-4 flex flex-col gap-3"
                  style={{ fontSize: 13, color: "var(--text-secondary)" }}
                >
                  {children}
                </motion.div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div
        role="button"
        tabIndex={0}
        aria-labelledby={`card-title-${id}`}
        layoutId={`card-${title}-${id}`}
        onClick={() => setActive(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActive(true); }}
        className={cn(
          "flex flex-col rounded-xl cursor-pointer border overflow-hidden bg-white transition-shadow hover:shadow-md",
          className,
        )}
        style={{ borderColor: "var(--border)" }}
      >
        <motion.div layoutId={`image-${title}-${id}`}>
          <Media
            src={src} title={title} initials={initials} accentColor={accentColor}
            className="w-full aspect-[4/3] object-cover object-center block"
          />
        </motion.div>
        <div className="p-3">
          <motion.p layoutId={`description-${description}-${id}`} className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
            {description}
          </motion.p>
          <motion.h3 layoutId={`title-${title}-${id}`} className="font-bold text-[13px] mt-0.5 truncate" style={{ color: "var(--obsidian)" }}>
            {title}
          </motion.h3>
        </div>
      </motion.div>
    </>
  );
}