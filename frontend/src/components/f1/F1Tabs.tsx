"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "F1", href: "/f1" },
  { label: "Schedule", href: "/f1/schedule" },
  { label: "Results", href: "/f1/results" },
  { label: "Standings", href: "/f1/standings" },
  { label: "Drivers", href: "/f1/drivers" },
  { label: "Teams", href: "/f1/teams" },
];

export default function F1Tabs() {
  const pathname = usePathname();

  return (
    <>
      <div className="f1-red-stripe" />
      <nav className="f1-tabs">
        <div className="f1-container" style={{ display: "flex", gap: 0 }}>
          {TABS.map((tab) => {
            const active = tab.href === "/f1"
              ? pathname === "/f1"
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`f1-tab${active ? " active" : ""}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
