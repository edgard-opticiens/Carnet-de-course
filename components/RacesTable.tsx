import type { RaceEntry } from "@/lib/analysis";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function RacesTable({ races }: { races: RaceEntry[] }) {
  if (races.length === 0) {
    return (
      <p style={{ color: "var(--ink-muted)", fontSize: 14 }}>
        Pas encore de sortie marquante détectée sur la période analysée.
      </p>
    );
  }
  return (
    <>
      {/* Tableau complet — bureau et écrans larges */}
      <div className="card races-scroll races-table-view">
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
                <td className="num">{fmtDate(r.date)}</td>
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

      {/* Cartes empilées — mobile : toutes les données visibles sans défilement horizontal */}
      <div className="races-cards-view">
        {races.map((r) => (
          <div className="card race-card" key={r.id}>
            <div className="race-card-head">
              <span className="race-name">{r.name}</span>
              {r.isPR && <span className="race-badge badge-pr">record perso</span>}
              {r.isRace && <span className="race-badge badge-race">course</span>}
            </div>
            <div className="race-card-date">{fmtDate(r.date)}</div>
            <div className="race-card-grid">
              <div>
                <div className="race-card-label">Distance</div>
                <div className="race-card-val">{r.dist_km} km</div>
              </div>
              <div>
                <div className="race-card-label">Temps</div>
                <div className="race-card-val">{r.time}</div>
              </div>
              <div>
                <div className="race-card-label">Allure</div>
                <div className="race-card-val">{r.pace}</div>
              </div>
              <div>
                <div className="race-card-label">FC moy.</div>
                <div className="race-card-val">{r.avg_hr != null ? `${r.avg_hr} bpm` : "—"}</div>
              </div>
              <div>
                <div className="race-card-label">D+</div>
                <div className="race-card-val">{r.elev_m} m</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
