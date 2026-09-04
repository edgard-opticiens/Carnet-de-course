import type { DashboardData } from "@/lib/analysis";
import LastRunCard from "./LastRunCard";
import StatGrid from "./StatGrid";
import CompareCard from "./CompareCard";
import MonthlyChart from "./charts/MonthlyChart";
import PaceChart from "./charts/PaceChart";
import ZonesChart from "./charts/ZonesChart";
import RacesTable from "./RacesTable";
import WorkoutCards from "./WorkoutCards";
import RampChart from "./RampChart";
import GoalTimeline from "./GoalTimeline";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function Dashboard({
  data,
  updatedAt,
}: {
  data: DashboardData;
  updatedAt?: Date | null;
}) {
  const weeklyDelta =
    data.compare.prevKm > 0
      ? Math.round(((data.compare.currKm - data.compare.prevKm) / data.compare.prevKm) * 100)
      : null;

  return (
    <>
      <header className="top">
        <div className="wrap">
          <p className="eyebrow">Carnet de course · données Strava</p>
          <h1 className="hero-title display">
            Ta progression,
            <br />
            lue en un coup d&rsquo;œil.
          </h1>
          <p className="hero-sub">
            Voici ce que tes {data.totalRuns} sorties enregistrées entre le {formatDate(data.periodStart)}{" "}
            et le {formatDate(data.periodEnd)} racontent de ta progression, {data.athleteName}.
          </p>
          <div className="meta-row">
            <span>
              <span className="dot" />
              Période analysée : {formatDate(data.periodStart)} → {formatDate(data.periodEnd)}
            </span>
            <span>{data.totalRuns} sorties course/trail</span>
            {updatedAt && (
              <span>
                actualisé à{" "}
                {updatedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <form action="/api/auth/logout" method="post" style={{ display: "inline" }}>
              <button
                type="submit"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-muted)",
                  textDecoration: "underline",
                  cursor: "pointer",
                  font: "inherit",
                  padding: 0,
                }}
              >
                se déconnecter
              </button>
            </form>
          </div>
        </div>
      </header>

      {data.lastRun && <LastRunCard run={data.lastRun} />}

      <div className="wrap">
        <StatGrid data={data} />
      </div>

      <CompareCard data={data} />

      <section>
        <div className="wrap">
          <div className="section-head">
            <h2 className="section-title display">Le volume, mois après mois</h2>
            <span className="section-note">18 derniers mois</span>
          </div>
          <p className="lede">
            Les barres grisées marquent les mois sans sortie enregistrée — utile pour repérer les
            coupures et leur longueur.
          </p>
          <div className="card">
            <MonthlyChart monthly={data.monthly} />
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <h2 className="section-title display">Allure & fréquence cardiaque</h2>
            <span className="section-note">une sortie représentative par mois</span>
          </div>
          <p className="lede">
            Chaque point est l&rsquo;allure moyenne d&rsquo;une sortie proche de 10 km ce mois-là,
            colorée selon la zone de fréquence cardiaque atteinte. Plus le point est haut, plus
            l&rsquo;allure est rapide.
          </p>
          <div className="card">
            <PaceChart paceTrend={data.paceTrend} zones={data.zones} />
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <h2 className="section-title display">Courses & sorties marquantes</h2>
            <span className="section-note">jusqu&rsquo;à 10 temps forts</span>
          </div>
          <p className="lede">
            Les courses que tu as marquées comme telles sur Strava, ou à défaut tes sorties les
            plus longues et les plus rapides sur la période.
          </p>
          <RacesTable races={data.races} />
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <h2 className="section-title display">Zones cardiaques de référence</h2>
            <span className="section-note">telles que configurées sur Strava</span>
          </div>
          <div className="zones-wrap">
            <div className="card">
              <ZonesChart zones={data.zones} />
            </div>
            <div className="card">
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6 }}>
                {data.hasHeartRateData
                  ? "Ces zones servent de repère pour situer tes sorties sur le graphique d'allure ci-dessus et pour les cibles de FC des sorties proposées plus bas."
                  : "Aucune fréquence cardiaque détectée sur tes sorties récentes — les graphiques et propositions ci-dessous se basent alors uniquement sur l'allure et le volume."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2 className="section-title display" style={{ marginBottom: 20 }}>
            Constat
          </h2>
          <div className="card conseils">
            <p>
              <b>{data.recommendations.phaseLabel}.</b> {data.recommendations.phaseNote} Sur les
              huit dernières semaines : {data.compare.currKm} km ({data.compare.currRuns} sorties),
              contre {data.compare.prevKm} km ({data.compare.prevRuns} sorties) sur les huit
              précédentes{weeklyDelta !== null ? ` (${weeklyDelta >= 0 ? "+" : ""}${weeklyDelta} %)` : ""}.
            </p>
            <div className="callout">
              Ces observations sont générées automatiquement à partir des seules données Strava
              disponibles (activités, zones de FC quand elles existent) et ne remplacent pas
              l&rsquo;avis d&rsquo;un coach ou d&rsquo;un professionnel de santé.
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <h2 className="section-title display">Quatre sorties pour progresser</h2>
            <span className="section-note">à introduire dans cet ordre</span>
          </div>
          <p className="lede">
            Des formats concrets calés sur tes propres zones de fréquence cardiaque, avec une
            allure indicative déduite de tes sorties passées quand les données sont suffisantes.
          </p>
          <WorkoutCards workouts={data.recommendations.workouts} />
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <h2 className="section-title display">Reconstruire le volume, 8 semaines</h2>
            <span className="section-note">
              départ ≈ {data.recommendations.rampWeeks[0]} km/semaine
            </span>
          </div>
          <p className="lede">
            Une progression calculée à partir de ton rythme actuel, sans retour brutal à un pic
            passé.
          </p>
          <div className="card">
            <RampChart
              weeks={data.recommendations.rampWeeks}
              fartlekFromWeek={data.recommendations.fartlekFromWeek}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <h2 className="section-title display">Trajectoire vers un objectif</h2>
          </div>
          <div className="card">
            <GoalTimeline />
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          Données issues de ton compte Strava (activités et zones de fréquence cardiaque),
          récupérées à chaque chargement de cette page — rien n&rsquo;est stocké sur le serveur en
          dehors de ta session de connexion.
        </div>
      </footer>
    </>
  );
}
