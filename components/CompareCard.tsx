"use client";
import { useTooltip } from "./TooltipContext";
import type { DashboardData } from "@/lib/analysis";
import RaceEstimatesCard from "./RaceEstimatesCard";

export default function CompareCard({ data }: { data: DashboardData }) {
  const { compare, weeks16 } = data;
  const max = Math.max(compare.prevKm, compare.currKm, 1);
  const deltaPct =
    compare.prevKm > 0 ? Math.round(((compare.currKm - compare.prevKm) / compare.prevKm) * 100) : null;
  const tooltip = useTooltip();

  const rows = [
    { label: "8 sem. précédentes", km: compare.prevKm, color: "var(--blue)" },
    { label: "8 dernières sem.", km: compare.currKm, color: "var(--accent)" },
  ];

  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <h2 className="section-title display">Où en es-tu, là, maintenant</h2>
          {deltaPct !== null && (
            <span className={`pill ${deltaPct < 0 ? "critical" : "good"}`}>
              {deltaPct >= 0 ? "+" : ""}
              {deltaPct} % de volume
            </span>
          )}
        </div>
        <p className="lede">
          Les huit dernières semaines comparées aux huit précédentes — le point de départ pour
          calibrer la suite.
        </p>
        <div className="forme-grid">
          <div className="card">
            {rows.map((r) => (
              <div className="compare-row" key={r.label}>
                <div className="compare-label">{r.label}</div>
                <div className="compare-bar-track">
                  <div
                    className="compare-bar-fill"
                    style={{ width: `${(r.km / max) * 100}%`, background: r.color }}
                  />
                </div>
                <div className="compare-val">{r.km.toFixed(0)} km</div>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 10 }}>
              16 dernières semaines (chaque case = 1 semaine, la plus récente en bas à droite)
            </div>
            <WeeksHeat weeks={weeks16} tooltip={tooltip} />
            <div className="legend" style={{ marginTop: 16 }}>
              <div className="legend-item">
                <span className="legend-swatch" style={{ background: "var(--accent)" }} />
                semaine avec sortie(s)
              </div>
              <div className="legend-item">
                <span
                  className="legend-swatch"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }}
                />
                semaine sans sortie
              </div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <RaceEstimatesCard raceEstimates={data.raceEstimates} />
        </div>
      </div>
    </section>
  );
}

function WeeksHeat({
  weeks,
  tooltip,
}: {
  weeks: { runs: number; km: number }[];
  tooltip: ReturnType<typeof useTooltip>;
}) {
  const w = 20,
    gap = 4,
    cols = 8;
  const rows = Math.ceil(weeks.length / cols);
  return (
    <svg viewBox={`0 0 ${cols * (w + gap)} ${rows * (w + gap) + 4}`} width="100%" height={rows * (w + gap) + 30}>
      {weeks.map((wk, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const active = wk.runs > 0;
        return (
          <rect
            key={i}
            x={col * (w + gap)}
            y={row * (w + gap)}
            width={w}
            height={w}
            rx={5}
            fill={active ? "var(--accent)" : "var(--surface-2)"}
            stroke={active ? "none" : "var(--hairline)"}
            fillOpacity={active ? Math.min(1, 0.45 + wk.runs * 0.2) : 1}
            style={{ cursor: "pointer" }}
            onMouseMove={(e) =>
              tooltip.show(
                e.clientX,
                e.clientY,
                <>
                  <b>
                    Semaine {i + 1}/{weeks.length}
                  </b>
                  {wk.runs} sortie{wk.runs > 1 ? "s" : ""} · {wk.km} km
                </>
              )
            }
            onMouseLeave={tooltip.hide}
          />
        );
      })}
    </svg>
  );
}
