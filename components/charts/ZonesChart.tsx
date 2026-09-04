import type { ZoneBound } from "@/lib/analysis";

const LABELS5 = ["Z1 · Récup", "Z2 · Endurance", "Z3 · Tempo", "Z4 · Seuil", "Z5 · Maximal"];
const EFFORT5_VARS = [
  "var(--effort5-1)",
  "var(--effort5-2)",
  "var(--effort5-3)",
  "var(--effort5-4)",
  "var(--effort5-5)",
];

export default function ZonesChart({ zones }: { zones: ZoneBound[] }) {
  if (zones.length === 0) {
    return (
      <p style={{ color: "var(--ink-muted)", fontSize: 14 }}>
        Zones de fréquence cardiaque non disponibles sur ce compte Strava (configure-les dans
        Strava &gt; Mon Profil &gt; Réglages FC pour les voir apparaître ici).
      </p>
    );
  }
  const maxShow = zones[zones.length - 1]?.min + 40 || 200;
  return (
    <div>
      {zones.map((z, i) => {
        const lo = z.min,
          hi = z.max ?? maxShow;
        const pct = ((hi - lo) / maxShow) * 100;
        const leftPct = (lo / maxShow) * 100;
        return (
          <div className="zone-row" key={i}>
            <div className="zone-name">{LABELS5[i] ?? `Z${i + 1}`}</div>
            <div style={{ position: "relative", height: 20, background: "var(--surface-2)", borderRadius: 5 }}>
              <div
                className="zone-bar"
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  width: `${pct}%`,
                  background: EFFORT5_VARS[i] ?? "var(--accent)",
                }}
              />
            </div>
            <div className="zone-range">
              {lo}
              {z.max ? `–${z.max}` : "+"} bpm
            </div>
          </div>
        );
      })}
    </div>
  );
}
