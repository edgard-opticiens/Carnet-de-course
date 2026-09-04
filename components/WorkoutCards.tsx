import type { WorkoutCard } from "@/lib/analysis";

const ZONE_COLOR_VAR: Record<WorkoutCard["zoneLabel"], string> = {
  aerobie: "var(--effort4-1)",
  tempo: "var(--effort4-2)",
  seuil: "var(--effort4-3)",
  maximal: "var(--effort4-4)",
};

export default function WorkoutCards({ workouts }: { workouts: WorkoutCard[] }) {
  return (
    <div className="workout-grid">
      {workouts.map((w) => (
        <div className="card workout-card" key={w.n}>
          <div className="workout-num display">{String(w.n).padStart(2, "0")}</div>
          <div className="workout-title">{w.title}</div>
          <div className="workout-zone">
            <span className="legend-swatch" style={{ background: ZONE_COLOR_VAR[w.zoneLabel] }} />
            zone {w.zoneLabel}
          </div>
          <div className="workout-meta">
            <div>
              <b>Fréquence —</b> {w.freq}
            </div>
            <div>
              <b>Format —</b> {w.duree}
            </div>
            <div>
              <b>Cible —</b> {w.cible}
            </div>
          </div>
          <p className="workout-why">{w.why}</p>
        </div>
      ))}
    </div>
  );
}
