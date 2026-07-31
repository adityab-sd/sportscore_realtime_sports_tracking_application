import type { Metadata } from "next";
import Link from "next/link";
import F1Tabs from "@/components/f1/F1Tabs";
import { DRIVERS_2026, getTeamColor, driverSlug } from "@/types/f1";

export const metadata: Metadata = {
  title: "F1 Drivers 2026 — SportScore",
  description: "All 2026 Formula 1 drivers.",
};

export default function F1DriversPage() {
  return (
    <>
      <F1Tabs />
      <div 
        className="f1-container" 
        style={{ 
          paddingTop: 32, 
          paddingBottom: 60,
          maxWidth: "100%", // Overrides global container max-width
          width: "100%",
        }}
      >
        <h1 className="f1-section-title" style={{ fontSize: "clamp(24px, 4vw, 36px)", marginBottom: 8 }}>
          F1 DRIVERS 2026
        </h1>
        <p style={{ color: "black", fontSize: 14, margin: "0 0 32px" }}>
          Find the current Formula 1 drivers for the 2026 season
        </p>

        {/* Responsive grid: 4 cols desktop, 2 cols tablet, 1 col mobile */}
        <div
          style={{
            display: "grid",
            gap: 16,
            width: "100%",
          }}
          className="f1-drivers-grid"
        >
          {DRIVERS_2026.map((driver) => {
            const teamColor = getTeamColor(driver.team);
            return (
              <Link
                key={driver.name}
                href={`/f1/drivers/${driverSlug(driver.name)}`}
                style={{
                  position: "relative",
                  display: "block",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: `linear-gradient(to right, #15151e 0%, ${teamColor} 100%)`,
                  aspectRatio: "9 / 6",
                  textDecoration: "none",
                  color: "#fff",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
                className="f1-driver-card-v2"
              >
                {/* Halftone overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: "radial-gradient(rgba(0,0,0,0.15) 18%, transparent 19%)",
                    backgroundSize: "8px 8px",
                    opacity: 0.4,
                    pointerEvents: "none",
                    zIndex: 1,
                  }}
                />

                {/* Driver info — top left */}
                <div style={{ position: "absolute", top: 20, left: 20, zIndex: 3 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 500,
                    opacity: 0.9,
                    lineHeight: 1.2,
                  }}>
                    {driver.firstName}
                  </div>
                  <div style={{
                    fontSize: "20px",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "-0.5px",
                    lineHeight: 1.1,
                    fontFamily: "'Montserrat', 'Arial Black', sans-serif",
                  }}>
                    {driver.lastName}
                  </div>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 500,
                    opacity: 0.7,
                    marginTop: 2,
                  }}>
                    {driver.team}
                  </div>
                  {/* Driver number */}
                  <div style={{
                    fontSize: "clamp(36px, 5vw, 48px)",
                    fontWeight: 900,
                    fontStyle: "italic",
                    lineHeight: 1,
                    marginTop: 6,
                    opacity: 0.6,
                    fontFamily: "'Impact', 'Arial Black', sans-serif",
                  }}>
                    {driver.number}
                  </div>
                </div>

                {/* Flag — bottom left */}
                <div style={{
                  position: "absolute",
                  bottom: 16,
                  left: 20,
                  zIndex: 3,
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 43,
                  lineHeight: 1,
                  overflow: "hidden",
                }}>
                  {driver.flagEmoji}
                </div>

                {/* Driver image — right side */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={driver.image}
                  alt={driver.name}
                  style={{
                    position: "absolute",
                    right: -6,
                    bottom: 0,
                    width: "60%",
                    height: "90%",
                    objectFit: "cover",
                    objectPosition: "top center",
                    zIndex: 2,
                  }}
                />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        .f1-container:has(.f1-drivers-grid) {
          max-width: 100% !important;
          width: 100% !important;
        }
        .f1-drivers-grid {
          grid-template-columns: repeat(4, 1fr) !important;
        }
        .f1-driver-card-v2:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
        }
        @media (max-width: 1024px) {
          .f1-drivers-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .f1-drivers-grid {
            grid-template-columns: 1fr !important;
            max-width: 420px;
            margin: 0 auto;
          }
        }
          .f1-drivers-container {
          padding-left: 94px;
          padding-right: 94px;
        }
        @media (max-width: 1024px) {
          .f1-drivers-container { padding-left: 40px; padding-right: 40px; }
        }
        @media (max-width: 768px) {
          .f1-drivers-container { padding-left: 20px; padding-right: 20px; }
        }
        @media (max-width: 480px) {
          .f1-drivers-container { padding-left: 12px; padding-right: 12px; }
        }
      `}</style>
    </>
  );
}