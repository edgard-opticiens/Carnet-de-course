"use client";
import { useTooltip } from "../TooltipContext";
import { formatPace } from "@/lib/analysis";
import type { MonthlyPoint } from "@/lib/analysis";

export default function MonthlyChart({ monthly }: { monthly: MonthlyPoint[] }) {
  const tooltip = useTooltip();
  const W = Math.max(700, monthly.length * 34);
  const H = 220;
  const padL = 40,
    padR = 10,
    padT = 10,
    padB = 34;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const maxDist = Math.max(...monthly.map((m) => m.dist_km), 1);
  const bw = plotW / monthly.length;
  const gridVals = [0, 25, 50, 75, 100, 150, 200].filter((v) => v <= maxDist + 10);

  return (
    <div className="chart-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        {gridVals.map((v) => {
          const y = padT + plotH - (v / maxDist) * plotH;
          return (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} className="axis-line" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={10}>
                {v}km
              </text>
            </g>
          );
        })}
        {monthly.map((m, i) => {
          const x = padL + i * bw + bw * 0.18;
          const bwid = bw * 0.64;
          const h = m.dist_km > 0 ? Math.max(2, (m.dist_km / maxDist) * plotH) : 3;
          const y = padT + plotH - h;
          const isGap = m.runs === 0;
          return (
            <g key={m.month}>
              <rect
                x={x}
                y={y}
                width={bwid}
                height={h}
                rx={3}
                fill={isGap ? "var(--surface-2)" : "var(--accent)"}
                stroke={isGap ? "var(--hairline)" : "none"}
                className="bar"
                onMouseMove={(e) =>
                  tooltip.show(
                    e.clientX,
                    e.clientY,
                    isGap ? (
                      <>
                        <b>{m.month}</b>Aucune sortie enregistrée
                      </>
                    ) : (
                      <>
                        <b>{m.month}</b>
                        {m.dist_km} km · {m.runs} sortie{m.runs > 1 ? "s" : ""}
                        <br />
                        allure moy. {m.avg_pace != null ? formatPace(m.avg_pace) : "—"} · D+ {m.elev_m} m
                      </>
                    )
                  )
                }
                onMouseLeave={tooltip.hide}
              />
              {(i % 2 === 0 || monthly.length < 20) && (
                <text x={x + bwid / 2} y={H - 14} textAnchor="middle" fontSize={9.5}>
                  {m.month.slice(2).replace("-", "/")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
