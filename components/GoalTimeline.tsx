"use client";
import { useEffect, useState } from "react";
import { buildGoalPlan } from "@/lib/analysis";
import type { GoalPlan } from "@/lib/analysis";

const STORAGE_KEY = "carnet-de-course:goal-v2";

interface GoalForm {
  date: string;
  distanceKm: string;
  elevationGainM: string;
  targetTime: string;
  sessionsPerWeek: string;
}

const DEFAULT_FORM: GoalForm = {
  date: "",
  distanceKm: "21.1",
  elevationGainM: "",
  targetTime: "",
  sessionsPerWeek: "4",
};

function parseTimeToSeconds(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const parts = s.split(":").map((p) => Number(p));
  if (parts.some((p) => isNaN(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] * 60;
  return null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

const PHASE_LABEL: Record<GoalPlan["weeks"][number]["phase"], string> = {
  base: "Base aérobie",
  specifique: "Bloc spécifique",
  affutage: "Affûtage",
};

export default function GoalTimeline({
  currentWeeklyKm,
  raceEstimateRef,
}: {
  currentWeeklyKm: number;
  raceEstimateRef: { refDistKm: number; refTimeMin: number } | null;
}) {
  const [form, setForm] = useState<GoalForm>(DEFAULT_FORM);
  const [submitted, setSubmitted] = useState<GoalForm | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as GoalForm;
        setForm(parsed);
        setSubmitted(parsed);
      }
    } catch {
      /* localStorage indisponible ou contenu invalide : formulaire vide, pas bloquant */
    }
  }, []);

  function handleSubmit(e?: React.SyntheticEvent) {
    e?.preventDefault();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* si le stockage échoue, on garde quand même la valeur en mémoire pour cette session */
    }
    setSubmitted(form);
  }

  const eventDate = submitted?.date ? new Date(submitted.date + "T00:00:00") : null;
  const now = new Date();
  const distanceKm = submitted ? Number(submitted.distanceKm) : NaN;
  const valid = eventDate && !isNaN(eventDate.getTime()) && eventDate.getTime() > now.getTime() && distanceKm > 0;

  const plan =
    valid && submitted
      ? buildGoalPlan({
          eventDate: eventDate!,
          distanceKm,
          elevationGainM: Number(submitted.elevationGainM) || 0,
          targetTimeSec: parseTimeToSeconds(submitted.targetTime),
          sessionsPerWeek: Math.min(7, Math.max(1, Math.round(Number(submitted.sessionsPerWeek) || 4))),
          now,
          currentWeeklyKm,
          raceEstimateRef,
        })
      : null;

  return (
    <div>
      <form className="goal-form-grid" onSubmit={handleSubmit}>
        <div className="goal-field">
          <label htmlFor="goal-date">Date de l&rsquo;événement</label>
          <input
            id="goal-date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
        <div className="goal-field">
          <label htmlFor="goal-dist">Distance (km)</label>
          <input
            id="goal-dist"
            type="number"
            step="0.1"
            min="1"
            value={form.distanceKm}
            onChange={(e) => setForm({ ...form, distanceKm: e.target.value })}
          />
        </div>
        <div className="goal-field">
          <label htmlFor="goal-dplus">D+ (m, optionnel)</label>
          <input
            id="goal-dplus"
            type="number"
            min="0"
            value={form.elevationGainM}
            onChange={(e) => setForm({ ...form, elevationGainM: e.target.value })}
          />
        </div>
        <div className="goal-field">
          <label htmlFor="goal-time">Objectif de temps (optionnel)</label>
          <input
            id="goal-time"
            type="text"
            placeholder="hh:mm:ss"
            value={form.targetTime}
            onChange={(e) => setForm({ ...form, targetTime: e.target.value })}
          />
        </div>
        <div className="goal-field">
          <label htmlFor="goal-freq">Sorties / semaine</label>
          <input
            id="goal-freq"
            type="number"
            min="1"
            max="7"
            value={form.sessionsPerWeek}
            onChange={(e) => setForm({ ...form, sessionsPerWeek: e.target.value })}
          />
        </div>
      </form>
      <button type="button" onClick={handleSubmit} className="goal-form-submit">
        Générer mon programme
      </button>
      <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: "10px 0 0" }}>
        Enregistré uniquement dans ton navigateur, jamais envoyé nulle part.
      </p>

      {submitted && !valid && (
        <p style={{ fontSize: 14, color: "var(--critical)", marginTop: 16 }}>
          Indique une date dans le futur et une distance valide pour générer un programme.
        </p>
      )}

      {!submitted && (
        <p style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 20 }}>
          Renseigne ta prochaine course pour obtenir un programme semaine par semaine, adapté à ton
          volume actuel ({currentWeeklyKm} km/semaine en ce moment).
        </p>
      )}

      {plan && (
        <div style={{ marginTop: 24 }}>
          <p className="goal-summary">
            {plan.totalWeeks} semaine{plan.totalWeeks > 1 ? "s" : ""} avant l&rsquo;objectif, volume de
            pic estimé autour de <b>{plan.peakWeeklyKm} km/semaine</b> avant l&rsquo;affûtage.
          </p>
          {plan.feasibility && (
            <div className="goal-feasibility">
              <span className={`pill ${plan.feasibility.verdict === "très ambitieux" ? "critical" : "good"}`}>
                objectif {plan.feasibility.verdict}
              </span>
              <span style={{ color: "var(--ink-2)", fontSize: 13.5 }}>{plan.feasibility.note}</span>
            </div>
          )}
          <GoalPlanWeeks plan={plan} />
          <div className="callout" style={{ marginTop: 20 }}>
            Programme généré par règles simples à partir de ton volume et de ton terrain récents — il
            donne un cadre de progression raisonnable, pas une prescription médicale ou d&rsquo;un
            coach diplômé.
          </div>
        </div>
      )}
    </div>
  );
}

function GoalPlanWeeks({ plan }: { plan: GoalPlan }) {
  // Au-delà de 14 semaines, la phase de base est condensée par mois pour rester lisible ; le
  // détail semaine par semaine est conservé pour le bloc spécifique et l'affûtage, la partie qui
  // compte le plus à l'approche de l'objectif.
  const condense = plan.weeks.length > 14;
  const specificStartIdx = plan.weeks.findIndex((w) => w.phase !== "base");
  const detailStart = specificStartIdx === -1 ? 0 : specificStartIdx;

  if (!condense) {
    return (
      <div className="goal-phase">
        {plan.weeks.map((w) => (
          <GoalWeekRow key={w.weekIndex} week={w} />
        ))}
      </div>
    );
  }

  const baseWeeks = plan.weeks.slice(0, detailStart);
  const detailWeeks = plan.weeks.slice(detailStart);

  const byMonth = new Map<string, typeof baseWeeks>();
  for (const w of baseWeeks) {
    const k = w.startDate.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(w);
  }

  return (
    <div>
      <div className="goal-phase">
        <div className="goal-phase-head">
          <span className="goal-phase-title">Base aérobie</span>
          <span className="goal-phase-range">
            {fmtDate(baseWeeks[0]?.startDate)} → {fmtDate(baseWeeks[baseWeeks.length - 1]?.startDate)}
          </span>
        </div>
        {[...byMonth.entries()].map(([month, ws]) => {
          const avgKm = Math.round((ws.reduce((s, w) => s + w.km, 0) / ws.length) * 2) / 2;
          const label = new Date(month + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
          return (
            <div className="goal-week-row" key={month}>
              <div className="goal-week-date" style={{ textTransform: "capitalize" }}>
                {label}
              </div>
              <div className="goal-week-km">≈ {avgKm} km/sem.</div>
              <div className="goal-week-sessions">
                {ws.length} semaine{ws.length > 1 ? "s" : ""} de montée progressive du volume
              </div>
            </div>
          );
        })}
      </div>
      <div className="goal-phase" style={{ marginTop: 22 }}>
        <div className="goal-phase-head">
          <span className="goal-phase-title">Bloc spécifique &amp; affûtage</span>
          <span className="goal-phase-range">
            {fmtDate(detailWeeks[0]?.startDate)} → {fmtDate(detailWeeks[detailWeeks.length - 1]?.startDate)}
          </span>
        </div>
        {detailWeeks.map((w) => (
          <GoalWeekRow key={w.weekIndex} week={w} />
        ))}
      </div>
    </div>
  );
}

function GoalWeekRow({ week }: { week: GoalPlan["weeks"][number] }) {
  return (
    <div className="goal-week-row">
      <div className="goal-week-date">
        {fmtDate(week.startDate)} · {PHASE_LABEL[week.phase]}
      </div>
      <div className="goal-week-km">{week.km} km</div>
      <div className="goal-week-sessions">{week.sessions.join(" · ")}</div>
    </div>
  );
}
