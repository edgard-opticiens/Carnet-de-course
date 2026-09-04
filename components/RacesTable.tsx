import type { RaceEntry } from "@/lib/analysis";

export default function RacesTable({ races }: { races: RaceEntry[] }) {
  if (races.length === 0) {
    return (
      <p style={{ color: "var(--ink-muted)", fontSize: 14 }}>
        Pas encore de sortie marquante détectée sur la période analysée.
      </p>
    );
  }
  return (
    <div className="card races-scroll">
      <table className="races">
        <thead>
          <tr>
            <th>Date</th>
            <th>Sortie</th>
            <th>Distance</th>
            <th>Temps</th>
            <th>Allure</th>
            <th>FC moy.</th>
            <th>D+</th>
          </tr>
        </thead>
        <tbody>
          {races.map((r) => (
            <tr key={r.id}>
              <td className="num">
                {new Date(r.date).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td>
                <span className="race-name">{r.name}</span>
                {r.isPR && <span className="race-badge badge-pr">record perso</span>}
                {r.isRace && <span className="race-badge badge-race">course</span>}
              </td>
              <td className="num">{r.dist_km} km</td>
              <td className="num">{r.time}</td>
              <td className="num">{r.pace}</td>
              <td className="num">{r.avg_hr != null ? `${r.avg_hr} bpm` : "—"}</td>
              <td className="num">{r.elev_m} m</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
