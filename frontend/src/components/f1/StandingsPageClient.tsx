"use client";
import { useState } from "react";
import type { Standings } from "@/lib/api/f1";
import DriverPodium from "./DriverPodium";
import TeamPodium from "./TeamPodium";
import { DriverStandingsTable, ConstructorStandingsTable } from "./StandingsTable";

export default function StandingsPageClient({ standings }: { standings: Standings }) {
  const [tab, setTab] = useState<"drivers" | "teams">("drivers");

  return (
    <>
      <div style={{ display: "flex", gap: 0, marginBottom: 28 }}>
        <button
          onClick={() => setTab("drivers")}
          className={`f1-tab${tab === "drivers" ? " active" : ""}`}
          style={{ background: "none", border: "none", borderBottom: tab === "drivers" ? "3px solid #e10600" : "3px solid transparent" }}
        >
          Drivers
        </button>
        <button
          onClick={() => setTab("teams")}
          className={`f1-tab${tab === "teams" ? " active" : ""}`}
          style={{ background: "none", border: "none", borderBottom: tab === "teams" ? "3px solid #e10600" : "3px solid transparent" }}
        >
          Teams
        </button>
      </div>

      {tab === "drivers" ? (
        <>
          <DriverPodium drivers={standings.drivers} />
          <DriverStandingsTable drivers={standings.drivers} />
        </>
      ) : (
        <>
          <TeamPodium constructors={standings.constructors} />
          <ConstructorStandingsTable constructors={standings.constructors} />
        </>
      )}
    </>
  );
}
