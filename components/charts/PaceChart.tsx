"use client";
import { useTooltip } from "../TooltipContext";
import { formatPace } from "@/lib/analysis";
import type { PaceTrendPoint, ZoneBound } from "@/lib/analysis";

const EFFORT4_VARS = ["var(--effort4-1)", "var(--effort4-2)", "var(--effort4-3)", "var(--effort4-4)"];
const LABELS = ["aerobie", "tempo", "seuil", "maximal"] as const;

function zoneOf(hr: number, zones: ZoneBound[]): { label: string; color: string } {
  const idx = zoneIndex(hr, zones);
  return { label: LABELS[idx], color: EFFORT4_VARS[idx] };
}

function zoneIndex(hr: number, zones: ZoneBound[]): number {
  if (zones.length >= 5) {
    if (hr < zones[2].min) return 0;
    if (hr < zones[3].min) return 1;
    if (hr < zones[4].min) return 2;
    return 3;
  }
  // fallback générique si les zones Strava ne sont pas disponibles
  if (hr < 140) return 0;
  if (hr < 155) return 1;
  if (hr < 170) return 2;
  return 3;
}

export default function PaceChart({
  paceTrend,
  zones,
}: {
  paceTrend: PaceTrendPoint[];
  zones: ZoneBound[];
}) {
  const tooltip = useTooltip();
  if (paceTrend.length === 0) {
    return (
      <p style={{ color: "var(--ink-muted)", fontSize: 14 }}>
        Pas assez de sorties avec fréquence cardiaque enregistrée pour tracer cette tendance.
      </p>
    );
  }

  const W = Math.max(700, paceTrend.length * 34);
  const H = 260;
  const padL = 44,
    padR = 16,
    padT = 16,
    padB = 34;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const paces = paceTrend.map((p) => p.pace);
  const minP = Math.min(...paces) - 0.3,
    maxP = Math.max(...paces) + 0.3;
  const bw = plotW / paceTrend.length;

  const pts = paceTrend.map((p, i) => {
    const x = padL + i * bw + bw / 2;
    const y = padT + plotH - ((p.pace - minP) / (maxP - minP)) * plotH;
    return { x, y, p };
  });
  const path = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");

  const gridVals = [4, 5, 6, 7, 8].filter((v) => v >= minP && v <= maxP);

  return (
    <>
      <div className="chart-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
          {gridVals.map((v) => {
            const y = padT + plotH - ((v - minP) / (maxP - minP)) * plotH;
            return (
              <g key={v}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} className="axis-line" />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={10}>
                  {v}:00/km
                </text>
              </g>
            );
          })}
          <path d={path} fill="none" stroke="var(--hairline)" strokeWidth={1.5} />
          {pts.map((pt, i) => {
            const z = zoneOf(pt.p.avg_hr, zones);
            return (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={5}
                fill={z.color}
                stroke="var(--surface)"
                strokeWidth={1.5}
                className="dot-pt"
                onMouseMove={(e) =>
                  tooltip.show(
                    e.clientX,
                    e.clientY,
                    <>
                      <b>
                        {pt.p.month} — {pt.p.dist_km} km
                      </b>
                      Allure {formatPace(pt.p.pace)} · FC moy. {Math.round(pt.p.avg_hr)} bpm ({z.label})
                      <br />
                      <span style={{ opacity: 0.7 }}>{pt.p.name}</span>
                    </>
                  )
                }
                onMouseLeave={tooltip.hide}
              />
            );
          })}
          {pts.map(
            (pt, i) =>
              i % 3 === 0 && (
                <text key={i} x={pt.x} y={H - 14} textAnchor="middle" fontSize={9.5}>
                  {paceTrend[i].month.slice(2).replace("-", "/")}
                </text>
              )
          )}
        </svg>
      </div>
      <div className="legend">
        {LABELS.map((l, i) => (
          <div className="legend-item" key={l}>
            <span className="legend-swatch" style={{ background: EFFORT4_VARS[i] }} />
            {l}
          </div>
        ))}
      </div>
    </>
  );
}
