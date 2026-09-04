import type { LastRunReview } from "@/lib/analysis";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function LastRunCard({ run }: { run: LastRunReview }) {
  const stats: [string, string][] = [
    [`${run.distKm.toLocaleString("fr-FR")} km`, "distance"],
    [run.durationLabel, "durée"],
    [run.paceLabel, "allure moyenne"],
  ];
  if (run.avgHr !== null) {
    stats.push([`${run.avgHr} bpm${run.hrZoneIdx ? ` · Z${run.hrZoneIdx}` : ""}`, "FC moyenne"]);
  }
  if (run.elevM > 0) {
    stats.push([`${run.elevM} m`, "dénivelé"]);
  }

  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <h2 className="section-title display">Ta dernière sortie</h2>
          <span className="section-note">
            {formatDate(run.date)} · {run.typeLabel}
            {run.isPR ? " · record personnel" : ""}
          </span>
        </div>
        <p className="lede">
          {run.name} — cette analyse se met à jour toute seule : rouvre cette page après ta
          prochaine sortie, dès que Strava l&rsquo;a synchronisée, pour la retrouver ici.
        </p>

        <div className="card lastrun-card">
          <div className="lastrun-stats">
            {stats.map(([v, l]) => (
              <div className="lastrun-stat" key={l}>
                <div className="lastrun-stat-val display">{v}</div>
                <div className="lastrun-stat-label">{l}</div>
              </div>
            ))}
          </div>

          <div className="lastrun-cols">
            <div className="lastrun-col">
              <div className="lastrun-col-head good">Ce qui était bien</div>
              <ul className="lastrun-list good">
                {run.positives.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
            <div className="lastrun-col">
              <div className="lastrun-col-head warning">À surveiller</div>
              <ul className="lastrun-list warning">
                {run.watchouts.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lastrun-next">
            <div className="lastrun-next-block">
              <div className="lastrun-next-label">Repos conseillé</div>
              <p>{run.restAdvice}</p>
            </div>
            {run.nextWorkout && (
              <div className="lastrun-next-block">
                <div className="lastrun-next-label">Proposition pour la prochaine sortie</div>
                <p>
                  <b>{run.nextWorkout.title}</b> — {run.nextWorkout.duree}. {run.nextWorkoutRationale}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
