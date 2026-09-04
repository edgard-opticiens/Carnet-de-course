import type { RaceEstimates } from "@/lib/analysis";

export default function RaceEstimatesCard({ raceEstimates }: { raceEstimates: RaceEstimates | null }) {
  if (!raceEstimates) {
    return (
      <div className="card">
        <div className="estimates-title">Estimations de temps de course</div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
          Pas encore assez de sorties récentes (moins de 4 mois) pour estimer tes temps de course.
        </p>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="estimates-title">Estimations de temps de course</div>
      <div className="estimates-grid">
        {raceEstimates.estimates.map((e) => (
          <div className="estimate-tile" key={e.key}>
            <div className="estimate-label">{e.label}</div>
            <div className="estimate-time display">{e.timeLabel}</div>
            <div className="estimate-pace">{e.paceLabel}</div>
          </div>
        ))}
      </div>
      <p className="estimates-note">{raceEstimates.basisLabel}</p>
      {raceEstimates.marathonCaveat && <p className="estimates-note">{raceEstimates.marathonCaveat}</p>}
    </div>
  );
}
