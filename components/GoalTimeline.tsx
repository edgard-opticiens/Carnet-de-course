"use client";
import { useEffect, useMemo, useState } from "react";
import { buildGoalPlan } from "@/lib/analysis";
import type { GoalPlan, GoalPlanSession, WorkoutPaceHints, ZoneBound } from "@/lib/analysis";

const STORAGE_KEY = "carnet-de-course:goal-v2";

const ZONE_COLOR_VAR: Record<GoalPlanSession["zoneLabel"], string> = {
  aerobie: "var(--effort4-1)",
  tempo: "var(--effort4-2)",
  seuil: "var(--effort4-3)",
  maximal: "var(--effort4-4)",
};

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

function fmtDateFull(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const PHASE_LABEL: Record<GoalPlan["weeks"][number]["phase"], string> = {
  base: "Base aérobie",
  specifique: "Bloc spécifique",
  affutage: "Affûtage",
};

// Limite prudente pour la longueur d'un lien mailto: — au-delà, certains clients mail (Outlook
// desktop en particulier) tronquent silencieusement le corps du message. On bascule alors sur un
// résumé condensé (une ligne par semaine, sans le détail des allures) plutôt que de couper le
// texte n'importe où.
const MAILTO_SAFE_LENGTH = 1800;

function planHeaderLines(plan: GoalPlan, meta: { distanceKm: number; eventDate: string; athleteName?: string }): string[] {
  const lines: string[] = [];
  lines.push(`Programme d'entraînement — ${meta.distanceKm} km le ${fmtDateFull(meta.eventDate)}`);
  if (meta.athleteName) lines.push(`Pour ${meta.athleteName}`);
  lines.push(`Généré par Carnet de Course le ${fmtDateFull(new Date().toISOString())}`);
  lines.push("");
  lines.push(
    `${plan.totalWeeks} semaine${plan.totalWeeks > 1 ? "s" : ""} avant l'objectif, volume de pic estimé à ${
      plan.peakWeeklyKm
    } km/semaine avant l'affûtage.`
  );
  if (plan.feasibility) {
    lines.push(`Objectif ${plan.feasibility.verdict} : ${plan.feasibility.note}`);
  }
  lines.push("");
  return lines;
}

function weekBlockLines(w: GoalPlan["weeks"][number], detailed: boolean): string[] {
  const lines: string[] = [];
  lines.push(`Semaine du ${fmtDateFull(w.startDate)} — ${PHASE_LABEL[w.phase]} — ${w.km} km`);
  if (detailed) {
    for (const s of w.sessions) lines.push(`  - ${s.label} : ${s.detail}`);
  } else {
    lines.push(`  ${w.sessions.map((s) => s.label).join(" · ")}`);
  }
  lines.push("");
  return lines;
}

const PLAN_FOOTER =
  "Programme généré automatiquement par Carnet de Course à partir des données Strava — ne remplace pas l'avis d'un coach ou d'un professionnel de santé.";

function buildPlanText(
  plan: GoalPlan,
  meta: { distanceKm: number; eventDate: string; athleteName?: string },
  detailed: boolean
): string {
  const lines = [...planHeaderLines(plan, meta)];
  for (const w of plan.weeks) lines.push(...weekBlockLines(w, detailed));
  lines.push(PLAN_FOOTER);
  return lines.join("\n");
}

/**
 * Variante condensée et tronquée proprement (semaine par semaine, jamais en plein milieu d'une
 * phrase) pour tenir dans la limite prudente d'un lien mailto:. Si même le résumé condensé ne
 * tient pas en entier, on n'inclut que les premières semaines et on renvoie vers le bouton
 * "Copier le programme" pour le détail complet.
 */
function buildMailtoBody(plan: GoalPlan, meta: { distanceKm: number; eventDate: string; athleteName?: string }): string {
  const header = planHeaderLines(plan, meta).join("\n");
  const footer = PLAN_FOOTER;
  const copyHint = 'Programme complet (avec le détail de chaque séance) : utilise le bouton "Copier le programme" sur le site.';

  const fits = (body: string) => encodeURIComponent(body).length <= MAILTO_SAFE_LENGTH;

  const fullDetailed = buildPlanText(plan, meta, true);
  if (fits(fullDetailed)) return fullDetailed;

  const allCondensedWeeks = plan.weeks.map((w) => weekBlockLines(w, false).join("\n"));
  const fullCondensed = [header, ...allCondensedWeeks, footer].join("\n");
  if (fits(fullCondensed)) return fullCondensed;

  // Même condensé, ça ne tient pas : on ajoute les semaines une à une tant que ça passe, avec le
  // renvoi vers "Copier le programme" toujours présent et jamais coupé.
  let included = 0;
  for (let i = 0; i < allCondensedWeeks.length; i++) {
    const candidate = [
      header,
      ...allCondensedWeeks.slice(0, i + 1),
      `… (+${plan.weeks.length - (i + 1)} semaine${plan.weeks.length - (i + 1) > 1 ? "s" : ""} de plus)`,
      "",
      copyHint,
    ].join("\n");
    if (!fits(candidate)) break;
    included = i + 1;
  }
  const remaining = plan.weeks.length - included;
  return [
    header,
    ...allCondensedWeeks.slice(0, included),
    remaining > 0 ? `… (+${remaining} semaine${remaining > 1 ? "s" : ""} de plus)\n` : "",
    copyHint,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function GoalTimeline({
  currentWeeklyKm,
  raceEstimateRef,
  paceHints,
  zones,
  athleteName,
}: {
  currentWeeklyKm: number;
  raceEstimateRef: { refDistKm: number; refTimeMin: number } | null;
  paceHints: WorkoutPaceHints;
  zones: ZoneBound[];
  athleteName?: string;
}) {
  const [form, setForm] = useState<GoalForm>(DEFAULT_FORM);
  const [submitted, setSubmitted] = useState<GoalForm | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

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
    setCopyState("idle");
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
          paceHints,
          zones,
        })
      : null;

  const { mailtoHref, fullText } = useMemo(() => {
    if (!plan || !submitted) return { mailtoHref: null as string | null, fullText: "" };
    const meta = { distanceKm, eventDate: submitted.date, athleteName };
    const detailed = buildPlanText(plan, meta, true);
    const body = buildMailtoBody(plan, meta);
    const subject = `Programme d'entraînement — ${distanceKm} km le ${fmtDateFull(submitted.date)}`;
    return {
      mailtoHref: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      fullText: detailed,
    };
  }, [plan, submitted, distanceKm, athleteName]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 3000);
    }
  }

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

          <div className="goal-actions">
            <a className="goal-action-btn" href={mailtoHref ?? undefined}>
              Envoyer par e-mail
            </a>
            <button type="button" className="goal-action-btn" onClick={handleCopy}>
              {copyState === "copied" ? "Copié !" : copyState === "error" ? "Copie impossible" : "Copier le programme"}
            </button>
          </div>

          <GoalPlanWeeks plan={plan} />
          <div className="callout" style={{ marginTop: 20 }}>
            Programme généré par règles simples à partir de ton volume, de tes allures récentes par
            zone et de ton terrain — il donne un cadre de progression raisonnable, pas une
            prescription médicale ou d&rsquo;un coach diplômé.
          </div>
        </div>
      )}
    </div>
  );
}

function GoalPlanWeeks({ plan }: { plan: GoalPlan }) {
  // Au-delà de 14 semaines, la phase de base est condensée par mois pour rester lisible ; le
  // détail semaine par semaine (avec le détail de chaque séance) est conservé pour le bloc
  // spécifique et l'affûtage, la partie qui compte le plus à l'approche de l'objectif.
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
                {ws.length} semaine{ws.length > 1 ? "s" : ""} de montée progressive du volume — voir le
                détail des séances une fois dans le bloc spécifique.
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
      <div className="goal-week-sessions">
        {week.sessions.map((s, i) => (
          <div className="goal-session" key={i}>
            <span className="legend-swatch goal-session-dot" style={{ background: ZONE_COLOR_VAR[s.zoneLabel] }} />
            <span>
              <span className="goal-session-label">{s.label}</span>
              <span className="goal-session-detail"> — {s.detail}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
