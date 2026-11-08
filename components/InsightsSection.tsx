"use client";
import { useEffect, useState } from "react";
import type { Insights, BestEffortRow, FastKmRun, RunContext } from "@/lib/insights";
import { fmtDeltaSec, fmtDurationSec, fmtPaceSec } from "@/lib/insights";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Insights };

const CONTEXT_LABEL: Record<RunContext, string> = {
  libre: "libre",
  poussette: "poussette",
  canicross: "canicross",
};

const ZONE_COLORS = ["var(--effort5-1)", "var(--effort5-2)", "var(--effort5-3)", "var(--effort5-4)", "var(--effort5-5)"];

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const fr1 = (n: number) => n.toFixed(1).replace(".", ",");

export default function InsightsSection({ refreshKey }: { refreshKey?: number }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    // On ne remet pas l'écran de chargement si des analyses sont déjà affichées (rafraîchissement discret).
    fetch("/api/insights", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok || body.error) {
          setState((s) =>
            s.status === "ready"
              ? s
              : { status: "error", message: body.message ?? "Impossible de calculer les analyses pour le moment." }
          );
          return;
        }
        setState({ status: "ready", data: body.data });
      })
      .catch(() => {
        if (!cancelled)
          setState((s) => (s.status === "ready" ? s : { status: "error", message: "Impossible de contacter le serveur." }));
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <h2 className="section-title display">Ce que disent vraiment tes données</h2>
          {state.status === "ready" && (
            <span className="section-note">
              {state.data.coverage.runsAnalysed} sorties détaillées · {Math.round(state.data.coverage.windowDays / 7)} dernières semaines
            </span>
          )}
        </div>
        <p className="lede">
          Analyse kilomètre par kilomètre : on regarde <b>à l&rsquo;intérieur</b> de chaque sortie, pas seulement son allure
          moyenne. C&rsquo;est ce qui révèle un km rapide ou un meilleur 5&nbsp;km perdu au milieu d&rsquo;une sortie tranquille.
        </p>

        {state.status === "loading" && (
          <div className="card ins-note">Lecture du détail de tes dernières sorties sur Strava… (quelques secondes la première fois)</div>
        )}
        {state.status === "error" && <div className="card ins-note">{state.message}</div>}
        {state.status === "ready" && <Body data={state.data} />}
      </div>
    </section>
  );
}

function Body({ data }: { data: Insights }) {
  const { coverage } = data;
  if (coverage.runsAnalysed === 0) {
    return (
      <div className="card ins-note">
        {coverage.rateLimited
          ? "Strava limite temporairement le nombre de requêtes : réessaie dans quelques minutes."
          : "Pas assez de sorties récentes avec le détail kilomètre par kilomètre pour produire des analyses."}
      </div>
    );
  }
  return (
    <>
      {coverage.rateLimited && (
        <div className="card ins-note" style={{ marginBottom: 16 }}>
          Strava a limité les requêtes : {coverage.runsAnalysed} sorties sur {coverage.runsInWindow} ont pu être détaillées. Recharge dans
          quelques minutes pour compléter.
        </div>
      )}

      <div className="ins-headlines">
        {data.headlines.map((h) => (
          <div className={`card ins-headline tone-${h.tone}`} key={h.title}>
            <div className="ins-headline-title">{h.title}</div>
            <p>{h.text}</p>
          </div>
        ))}
      </div>

      <div className="ins-grid">
        <FastKmCard data={data} />
        <BestEffortsCard rows={data.bestEfforts} />
      </div>
      <div className="ins-grid" style={{ marginTop: 20 }}>
        <LoadCard data={data} />
        <IntensityCard data={data} />
      </div>
      <ContextCard data={data} />
    </>
  );
}

function FastKmCard({ data }: { data: Insights }) {
  const f = data.fastKm;
  const max = Math.max(1, ...f.weekly.map((w) => w.free + w.planned));
  return (
    <div className="card">
      <div className="ins-card-title">Km rapides, par semaine</div>
      <p className="ins-sub">
        {f.typicalPaceSec !== null
          ? `Un km est « rapide » s'il passe sous ${fmtPaceSec(f.thresholdSec!)}/km, soit ${f.gapSec} s sous ton allure habituelle (${fmtPaceSec(f.typicalPaceSec)}/km, médiane de tous tes km).`
          : "Pas assez de km pour définir ton allure habituelle."}
      </p>
      <div className="ins-bars" role="img" aria-label="Nombre de km rapides par semaine">
        {f.weekly.map((w) => (
          <div className="ins-bar-col" key={w.weekStart} title={`Semaine du ${fmtDay(w.weekStart)} : ${w.free} km rapides hors séance, ${w.planned} en séance/course`}>
            <div className="ins-bar-stack">
              <div style={{ height: `${(w.planned / max) * 100}%`, background: "var(--blue)" }} />
              <div style={{ height: `${(w.free / max) * 100}%`, background: "var(--accent)" }} />
            </div>
          </div>
        ))}
      </div>
      <div className="legend">
        <div className="legend-item"><span className="legend-swatch" style={{ background: "var(--accent)" }} />hors séance ({f.freeFastKm} km)</div>
        <div className="legend-item"><span className="legend-swatch" style={{ background: "var(--blue)" }} />séance / course ({f.plannedFastKm} km)</div>
      </div>
      {f.runs.length > 0 && (
        <div className="races-scroll" style={{ marginTop: 16 }}>
          <table className="races ins-table">
            <thead>
              <tr><th>Sortie</th><th>Km rapides</th><th>Meilleur km</th></tr>
            </thead>
            <tbody>
              {f.runs.slice(0, 6).map((r) => <FastRow key={r.activityId} r={r} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FastRow({ r }: { r: FastKmRun }) {
  return (
    <tr>
      <td>
        <div className="race-name">{r.name}{r.context !== "libre" && <span className="race-badge badge-race">{CONTEXT_LABEL[r.context]}</span>}</div>
        <div className="ins-meta">{fmtDay(r.date)} · {fr1(r.runKm)} km · moy. {fmtPaceSec(r.avgPaceSec)}/km</div>
      </td>
      <td className="num">{r.fastKmCount} km à {fmtPaceSec(r.avgFastPaceSec)}</td>
      <td className="num">{fmtPaceSec(r.bestPaceSec)}/km{r.bestKmHr ? ` · ${Math.round(r.bestKmHr)} bpm` : ""}</td>
    </tr>
  );
}

function BestEffortsCard({ rows }: { rows: BestEffortRow[] }) {
  return (
    <div className="card">
      <div className="ins-card-title">Tes vrais meilleurs efforts</div>
      <p className="ins-sub">
        Le plus rapide chronométré <b>à l&rsquo;intérieur</b> d&rsquo;une sortie (calcul Strava), même si elle était plus longue. Variation : 6 dernières semaines
        contre les 7 d&rsquo;avant.
      </p>
      <div className="races-scroll">
        <table className="races ins-table">
          <thead>
            <tr><th>Distance</th><th>Meilleur (13 sem.)</th><th>Où</th><th>Évolution</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="race-name">{r.label}</td>
                <td className="num">
                  {r.best ? (<><b>{fmtDurationSec(r.best.sec)}</b><div className="ins-meta">{fmtPaceSec(r.best.sec / r.distKm)}/km</div></>) : "—"}
                </td>
                <td>
                  {r.best ? (<>{fmtDay(r.best.date)}<div className="ins-meta">sortie de {fr1(r.best.runKm)} km{r.best.context !== "libre" ? ` · ${CONTEXT_LABEL[r.best.context]}` : ""}</div></>) : "—"}
                </td>
                <td className="num">
                  {r.deltaSec === null ? <span className="ins-meta">—</span> : Math.abs(r.deltaSec) < 3 ? <span className="ins-meta">stable</span> : (
                    <span style={{ color: r.deltaSec < 0 ? "var(--good)" : "var(--critical)", fontWeight: 600 }}>
                      {r.deltaSec < 0 ? "−" : "+"}{fmtDeltaSec(r.deltaSec)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoadCard({ data }: { data: Insights }) {
  const l = data.load;
  const max = Math.max(1, ...l.weekly.map((w) => w.load));
  const unit = l.unit === "effort" ? "pts d'effort" : "min";
  const statusLabel = { sous: "sous ton rythme", stable: "stable", montee: "montée rapide", forte_montee: "montée très rapide" } as const;
  const tone = l.status === "montee" || l.status === "forte_montee" ? "critical" : l.status === "stable" ? "good" : "";
  return (
    <div className="card">
      <div className="ins-card-title">
        Charge d&rsquo;entraînement {l.status && <span className={`pill ${tone}`} style={{ marginLeft: 8 }}>{statusLabel[l.status]}</span>}
      </div>
      <p className="ins-sub">
        7 derniers jours : <b>{l.acute} {unit}</b> · moyenne hebdo sur 28 jours : <b>{l.chronicWeekly} {unit}</b>
        {l.ratio !== null && <> · ratio <b>{String(l.ratio).replace(".", ",")}</b></>}
        {l.unit === "min" && " (mesurée en minutes de course : pas d'effort relatif Strava disponible)"}.
      </p>
      <div className="ins-bars" role="img" aria-label="Charge hebdomadaire">
        {l.weekly.map((w, i) => (
          <div className="ins-bar-col" key={w.weekStart} title={`Semaine du ${fmtDay(w.weekStart)} : ${w.load} ${unit}, ${fr1(w.km)} km`}>
            <div className="ins-bar-stack">
              <div style={{ height: `${(w.load / max) * 100}%`, background: i === l.weekly.length - 1 ? "var(--accent)" : "var(--effort5-2)" }} />
            </div>
          </div>
        ))}
      </div>
      <div className="ins-meta" style={{ marginTop: 8 }}>13 dernières semaines (la plus récente à droite)</div>
    </div>
  );
}

function IntensityCard({ data }: { data: Insights }) {
  const it = data.intensity;
  const pct = (v: number) => Math.round(v * 100);
  return (
    <div className="card">
      <div className="ins-card-title">Intensité : où passes-tu ton temps ?</div>
      {!it ? (
        <p className="ins-sub">Pas de fréquence cardiaque exploitable sur tes sorties récentes : impossible de répartir l&rsquo;effort par zone.</p>
      ) : (
        <>
          <p className="ins-sub">
            Part du temps de course par zone de FC sur les {it.windowDays} derniers jours.
            {it.zonesEstimated && " Tes zones sont estimées par Strava à partir de ton âge, donc à prendre comme un ordre de grandeur."}
          </p>
          <div className="ins-stack" role="img" aria-label="Répartition par zone cardiaque">
            {it.shares.map((s, i) => s > 0 && (
              <div key={i} style={{ width: `${s * 100}%`, background: ZONE_COLORS[i] ?? ZONE_COLORS[4] }} title={`Zone ${i + 1} : ${pct(s)} %`}>
                {s >= 0.08 ? `${pct(s)} %` : ""}
              </div>
            ))}
          </div>
          <div className="legend">
            {it.shares.map((s, i) => (
              <div className="legend-item" key={i}>
                <span className="legend-swatch" style={{ background: ZONE_COLORS[i] ?? ZONE_COLORS[4] }} />Z{i + 1} · {pct(s)} %
              </div>
            ))}
          </div>
          <div className="ins-meta" style={{ marginTop: 10 }}>
            Facile (Z1-2) {pct(it.easyShare)} % · zone 3 {pct(it.grayShare)} % · dur (Z4-5) {pct(it.hardShare)} %
          </div>
        </>
      )}
      {data.pacing.runsAnalysed >= 3 && (
        <div className="ins-pacing">
          <div className="ins-card-title" style={{ fontSize: 14, marginTop: 18 }}>Gestion de l&rsquo;allure</div>
          <div className="ins-pacing-grid">
            <div><div className="display ins-big">{data.pacing.negative}</div><div className="ins-meta">en accélérant</div></div>
            <div><div className="display ins-big">{data.pacing.even}</div><div className="ins-meta">régulières</div></div>
            <div><div className="display ins-big">{data.pacing.positive}</div><div className="ins-meta">en ralentissant</div></div>
            {data.pacing.medianDecouplingPct !== null && (
              <div>
                <div className="display ins-big">{String(data.pacing.medianDecouplingPct).replace(".", ",")} %</div>
                <div className="ins-meta">dérive cardiaque</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ContextCard({ data }: { data: Insights }) {
  if (data.byContext.length < 2) return null;
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="ins-card-title">Selon le type de sortie</div>
      <p className="ins-sub">
        Déduit du titre de tes sorties (« poussette », « canicross ») : l&rsquo;allure n&rsquo;a pas la même signification d&rsquo;une sortie à l&rsquo;autre.
      </p>
      <div className="races-scroll">
        <table className="races ins-table" style={{ minWidth: 420 }}>
          <thead><tr><th>Type</th><th>Sorties</th><th>Km</th><th>Allure médiane</th><th>Km rapides</th></tr></thead>
          <tbody>
            {data.byContext.map((c) => (
              <tr key={c.context}>
                <td className="race-name">{CONTEXT_LABEL[c.context]}</td>
                <td className="num">{c.runs}</td>
                <td className="num">{c.km}</td>
                <td className="num">{c.medianPaceSec !== null ? `${fmtPaceSec(c.medianPaceSec)}/km` : "—"}</td>
                <td className="num">{c.fastKmShare !== null ? `${Math.round(c.fastKmShare * 100)} %` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
