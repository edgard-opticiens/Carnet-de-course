import { AthleteZones, StravaActivity, StravaLap } from "./strava";

export interface MonthlyPoint {
  month: string; // YYYY-MM
  runs: number;
  dist_km: number;
  time_h: number;
  avg_pace: number | null; // décimal minutes/km
  elev_m: number;
}

export interface PaceTrendPoint {
  date: string;
  month: string;
  name: string;
  dist_km: number;
  pace: number; // décimal minutes/km
  avg_hr: number;
}

export interface RaceEntry {
  id: number;
  name: string;
  date: string;
  dist_km: number;
  time: string;
  pace: string;
  avg_hr: number | null;
  elev_m: number;
  isPR: boolean;
  isRace: boolean;
}

export interface ZoneBound {
  min: number;
  max: number | null;
}

export type WorkoutKey = "ef" | "sortieLongue" | "fartlek" | "fractionne" | "cotes";

/** Un format de répétitions valide pour la séance de fractionné actuellement proposée
 * (plusieurs formats possibles en phase de progression, ex. 400 m ou 1000 m). */
export interface FractionneTargetOption {
  distanceM: number;
  repsMin: number;
  repsMax: number;
  recoveryM: number | null;
  recoverySecMin: number | null;
  recoverySecMax: number | null;
}

export interface WorkoutCard {
  key: WorkoutKey;
  n: number;
  title: string;
  zoneLabel: "aerobie" | "tempo" | "seuil" | "maximal";
  freq: string;
  duree: string;
  cible: string;
  paceHint: string | null;
  why: string;
  intervalTarget?: FractionneTargetOption[];
}

export interface Recommendations {
  phase: "reconstruction" | "maintien" | "progression";
  phaseLabel: string;
  phaseNote: string;
  workouts: WorkoutCard[];
}

export interface WorkoutPaceHints {
  easyRange: string | null;
  fartlekRange: string | null;
  fractionneRange: string | null;
}

export type WorkoutTypeLabel = "sortie" | "course" | "sortie longue" | "séance";

/**
 * Analyse d'une structure fractionnée détectée dans les tours (laps) de la dernière sortie —
 * reconnue automatiquement à partir des données de la montre, sans dépendre du tag manuel Strava.
 */
export interface IntervalAnalysis {
  repCount: number;
  repDistanceM: number;
  repPaceLabel: string;
  repPaceRangeLabel: string;
  recoveryCount: number;
  recoveryLabel: string;
  targetPaceRange: string | null;
  withinTarget: boolean | null;
  hrDriftBpm: number | null;
  paceTrendKind: "stable" | "progressif" | "fatigue";
  consistencyLabel: string;
  matchesRecommendation: boolean;
  /** Comparaison fine entre la séance réalisée et le format précis actuellement proposé
   * (répétitions/distance/récupération) — null si le fractionné n'est pas dans les sorties du
   * moment, ou si aucun format proposé n'est assez proche de la distance réalisée. */
  targetComparison: {
    distanceM: number;
    repsMin: number;
    repsMax: number;
    recoveryLabel: string | null;
    verdict: "conforme" | "moins" | "plus" | "distance_differente";
  } | null;
  /** Allure des répétitions comparée à une allure 5 km projetée depuis la forme du moment
   * (mêmes sorties récentes que les estimations de temps de course) — un repère "réaliste et
   * motivant" ancré sur le niveau actuel plutôt que sur l'historique complet. */
  fitnessPaceLabel: string | null;
  fitnessComparisonKind: "plus_rapide" | "proche" | "plus_lent" | null;
}

export interface LastRunReview {
  id: number;
  name: string;
  date: string; // YYYY-MM-DD
  distKm: number;
  durationLabel: string;
  paceLabel: string;
  avgHr: number | null;
  hrZoneIdx: number | null;
  elevM: number;
  isPR: boolean;
  typeLabel: WorkoutTypeLabel;
  daysSincePrevious: number | null;
  positives: string[];
  watchouts: string[];
  restAdvice: string;
  nextWorkout: WorkoutCard | null;
  nextWorkoutRationale: string;
  intervalAnalysis: IntervalAnalysis | null;
}

export interface RaceEstimate {
  key: string;
  label: string;
  km: number;
  timeLabel: string;
  paceLabel: string;
}

export interface RaceEstimates {
  estimates: RaceEstimate[];
  basisLabel: string;
  marathonCaveat: string | null;
  refDistKm: number;
  refTimeMin: number;
}

export interface RecordEntry {
  key: string;
  label: string;
  km: number;
  timeLabel: string | null;
  paceLabel: string | null;
  date: string | null;
  sourceLabel: string | null;
  isRace: boolean;
}

export interface DashboardData {
  athleteName: string;
  totalDistKm: number;
  totalRuns: number;
  totalTimeH: number;
  totalElevM: number;
  periodStart: string;
  periodEnd: string;
  monthly: MonthlyPoint[];
  weeks16: { runs: number; km: number }[];
  compare: { prevKm: number; prevRuns: number; currKm: number; currRuns: number };
  currentWeeklyKm: number;
  paceTrend: PaceTrendPoint[];
  races: RaceEntry[];
  zones: ZoneBound[];
  zonePaces: (string | null)[];
  hasHeartRateData: boolean;
  workoutPaceHints: WorkoutPaceHints;
  recommendations: Recommendations;
  lastRun: LastRunReview | null;
  raceEstimates: RaceEstimates | null;
  records: RecordEntry[];
}

const MS_DAY = 86400000;

const STANDARD_RACE_DISTANCES: { key: string; label: string; km: number }[] = [
  { key: "5k", label: "5 km", km: 5 },
  { key: "10k", label: "10 km", km: 10 },
  { key: "half", label: "Semi-marathon", km: 21.0975 },
  { key: "marathon", label: "Marathon", km: 42.195 },
];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function paceFromSpeed(avgSpeedMs: number): number {
  if (!avgSpeedMs || avgSpeedMs <= 0) return 0;
  return 1000 / avgSpeedMs / 60; // décimal minutes/km
}

export function formatPace(decimalMinPerKm: number): string {
  const min = Math.floor(decimalMinPerKm);
  const sec = Math.round((decimalMinPerKm - min) * 60);
  const mm = sec === 60 ? min + 1 : min;
  const ss = sec === 60 ? 0 : sec;
  return `${mm}:${String(ss).padStart(2, "0")}/km`;
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
  return `${m}m${String(s).padStart(2, "0")}s`;
}

function weekStart(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // lundi = 0
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy;
}

export function buildDashboardData(
  activities: StravaActivity[],
  zonesRaw: AthleteZones | null,
  athleteName: string,
  now: Date = new Date(),
  allActivities?: StravaActivity[],
  lastRunLaps?: StravaLap[] | null
): DashboardData {
  const sorted = [...activities].sort(
    (a, b) => new Date(a.start_date_local).getTime() - new Date(b.start_date_local).getTime()
  );

  // Les records (meilleurs temps par distance) doivent chercher dans tout l'historique
  // disponible, pas seulement la fenêtre récente utilisée pour le reste du tableau de bord —
  // sinon un marathon ou un 10 km couru il y a plus de 18 mois n'apparaît jamais. Si l'appelant
  // ne fournit pas cet historique complet, on retombe sur la même fenêtre que le reste.
  const sortedAll = allActivities
    ? [...allActivities].sort(
        (a, b) => new Date(a.start_date_local).getTime() - new Date(b.start_date_local).getTime()
      )
    : sorted;

  const totalDistKm = sorted.reduce((s, a) => s + a.distance / 1000, 0);
  const totalRuns = sorted.length;
  const totalTimeH = sorted.reduce((s, a) => s + a.moving_time / 3600, 0);
  const totalElevM = sorted.reduce((s, a) => s + a.total_elevation_gain, 0);

  // ---- mensuel, zéro-rempli ----
  const monthly: MonthlyPoint[] = [];
  if (sorted.length > 0) {
    const first = new Date(sorted[0].start_date_local);
    const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    const byMonth = new Map<string, StravaActivity[]>();
    for (const a of sorted) {
      const k = monthKey(new Date(a.start_date_local));
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k)!.push(a);
    }
    while (cursor <= end) {
      const k = monthKey(cursor);
      const acts = byMonth.get(k) ?? [];
      const dist_km = acts.reduce((s, a) => s + a.distance / 1000, 0);
      const time_h = acts.reduce((s, a) => s + a.moving_time / 3600, 0);
      const elev_m = acts.reduce((s, a) => s + a.total_elevation_gain, 0);
      monthly.push({
        month: k,
        runs: acts.length,
        dist_km: Math.round(dist_km * 10) / 10,
        time_h: Math.round(time_h * 10) / 10,
        avg_pace: dist_km > 0 ? (time_h * 60) / dist_km : null,
        elev_m: Math.round(elev_m),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  // ---- 16 dernières semaines ----
  const weeks16: { runs: number; km: number }[] = [];
  const currentWeekStart = weekStart(now);
  for (let i = 15; i >= 0; i--) {
    const ws = new Date(currentWeekStart);
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const inWeek = sorted.filter((a) => {
      const t = new Date(a.start_date_local).getTime();
      return t >= ws.getTime() && t < we.getTime();
    });
    weeks16.push({
      runs: inWeek.length,
      km: Math.round(inWeek.reduce((s, a) => s + a.distance / 1000, 0) * 10) / 10,
    });
  }

  // ---- comparaison 8 sem vs 8 sem précédentes ----
  const t0 = now.getTime();
  const in8 = (a: StravaActivity, offsetDays: number) => {
    const t = new Date(a.start_date_local).getTime();
    return t >= t0 - (offsetDays + 56) * MS_DAY && t < t0 - offsetDays * MS_DAY;
  };
  const curr8 = sorted.filter((a) => in8(a, 0));
  const prev8 = sorted.filter((a) => in8(a, 56));
  const compare = {
    currKm: Math.round(curr8.reduce((s, a) => s + a.distance / 1000, 0) * 10) / 10,
    currRuns: curr8.length,
    prevKm: Math.round(prev8.reduce((s, a) => s + a.distance / 1000, 0) * 10) / 10,
    prevRuns: prev8.length,
  };
  const currentWeeklyKm = Math.round((compare.currKm / 8) * 10) / 10;

  // ---- zones FC ----
  const zones: ZoneBound[] = (zonesRaw?.heart_rate?.zones ?? []).map((z) => ({
    min: z.min,
    max: z.max === -1 ? null : z.max,
  }));

  const hasHeartRateData = sorted.some((a) => a.has_heartrate && a.average_heartrate);

  // ---- tendance allure / FC : une sortie représentative par mois, proche de 10 km, avec FC ----
  const paceTrend: PaceTrendPoint[] = [];
  const byMonthAll = new Map<string, StravaActivity[]>();
  for (const a of sorted) {
    const k = monthKey(new Date(a.start_date_local));
    if (!byMonthAll.has(k)) byMonthAll.set(k, []);
    byMonthAll.get(k)!.push(a);
  }
  for (const [month, acts] of byMonthAll) {
    const withHr = acts.filter((a) => a.has_heartrate && a.average_heartrate && a.distance >= 3000);
    if (withHr.length === 0) continue;
    withHr.sort((a, b) => Math.abs(a.distance - 10000) - Math.abs(b.distance - 10000));
    const pick = withHr[0];
    paceTrend.push({
      date: pick.start_date_local.slice(0, 10),
      month,
      name: pick.name,
      dist_km: Math.round((pick.distance / 1000) * 10) / 10,
      pace: paceFromSpeed(pick.average_speed),
      avg_hr: pick.average_heartrate!,
    });
  }
  paceTrend.sort((a, b) => a.date.localeCompare(b.date));

  // ---- courses / sorties marquantes ----
  const flaggedRaces = sorted.filter((a) => a.workout_type === 1);
  let notable: StravaActivity[];
  if (flaggedRaces.length >= 3) {
    notable = flaggedRaces.slice(-10);
  } else {
    const runsOver5k = sorted.filter((a) => a.distance >= 5000);
    const byDistDesc = [...runsOver5k].sort((a, b) => b.distance - a.distance).slice(0, 4);
    const byPaceAsc = [...runsOver5k]
      .sort((a, b) => a.moving_time / a.distance - b.moving_time / b.distance)
      .slice(0, 4);
    const map = new Map<number, StravaActivity>();
    for (const a of [...flaggedRaces, ...byDistDesc, ...byPaceAsc]) map.set(a.id, a);
    notable = [...map.values()].sort(
      (a, b) => new Date(a.start_date_local).getTime() - new Date(b.start_date_local).getTime()
    ).slice(-10);
  }
  const races: RaceEntry[] = notable.map((a) => ({
    id: a.id,
    name: a.name,
    date: a.start_date_local.slice(0, 10),
    dist_km: Math.round((a.distance / 1000) * 10) / 10,
    time: formatDuration(a.moving_time),
    pace: formatPace(paceFromSpeed(a.average_speed)),
    avg_hr: a.has_heartrate && a.average_heartrate ? Math.round(a.average_heartrate) : null,
    elev_m: Math.round(a.total_elevation_gain),
    isPR: (a.pr_count ?? 0) > 0,
    isRace: a.workout_type === 1,
  }));

  // ---- allures réellement tenues par zone de FC ----
  const paceByZone = buildPaceByZone(sorted, zones);
  const zonePaces: (string | null)[] = zones.map((_, i) =>
    formatPaceRange(paceRangeForZones(paceByZone, [i + 1]))
  );
  const workoutPaceHints = buildWorkoutPaceHints(paceByZone);

  // ---- dénivelé récent, pour savoir si le côtes a du sens dans les sorties proposées ----
  const recentForElev = sorted.slice(-12);
  const avgElevPerKmRecent =
    recentForElev.length > 0
      ? recentForElev.reduce(
          (s, a) => s + a.total_elevation_gain / Math.max(a.distance / 1000, 0.1),
          0
        ) / recentForElev.length
      : 0;

  // ---- recommandations générées par règles ----
  const recommendations = buildRecommendations(compare, zones, workoutPaceHints, avgElevPerKmRecent);

  // ---- estimations de temps de course (forme récente), calculées avant le compte rendu de la
  // dernière sortie pour pouvoir y situer l'allure de fractionné par rapport au niveau actuel ----
  const raceEstimates = buildRaceEstimates(sorted, now);

  // ---- compte rendu de la toute dernière sortie ----
  const lastRun = buildLastRunReview(sorted, zones, recommendations, paceByZone, lastRunLaps, raceEstimates);

  const records = buildRecords(sortedAll);

  return {
    athleteName,
    totalDistKm: Math.round(totalDistKm),
    totalRuns,
    totalTimeH: Math.round(totalTimeH),
    totalElevM: Math.round(totalElevM),
    periodStart: sorted[0]?.start_date_local.slice(0, 10) ?? now.toISOString().slice(0, 10),
    periodEnd: now.toISOString().slice(0, 10),
    monthly,
    weeks16,
    compare,
    currentWeeklyKm,
    paceTrend,
    races,
    zones,
    zonePaces,
    hasHeartRateData,
    workoutPaceHints,
    recommendations,
    lastRun,
    raceEstimates,
    records,
  };
}

function zoneIndexForHr(hr: number, zones: ZoneBound[]): number | null {
  if (!zones.length) return null;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (hr >= z.min && (z.max === null || hr < z.max)) return i + 1;
  }
  return hr < zones[0].min ? 1 : zones.length;
}

function workoutTypeLabel(wt: number | null | undefined): WorkoutTypeLabel {
  if (wt === 1) return "course";
  if (wt === 2) return "sortie longue";
  if (wt === 3) return "séance";
  return "sortie";
}

/**
 * Analyse la toute dernière sortie enregistrée par rapport aux habitudes récentes de l'athlète :
 * ce qui était bien, les points de vigilance, un conseil de repos et une proposition pour la
 * sortie suivante — le tout par règles déterministes, sans IA, à partir des seules données Strava.
 */
function buildLastRunReview(
  sorted: StravaActivity[],
  zones: ZoneBound[],
  recommendations: Recommendations,
  paceByZone: Map<number, number[]>,
  lastRunLaps?: StravaLap[] | null,
  raceEstimates?: RaceEstimates | null
): LastRunReview | null {
  if (sorted.length === 0) return null;
  const last = sorted[sorted.length - 1];
  const prevRuns = sorted.slice(0, -1);
  const lastDistKm = last.distance / 1000;
  const lastPace = paceFromSpeed(last.average_speed);

  // Reconnaissance d'une séance fractionnée à partir des tours (laps) de la montre, indépendamment
  // du tag manuel Strava (workout_type). Si détectée, on traite la sortie comme une "séance" pour
  // le reste de l'analyse (repos conseillé, prochaine sortie...), même si Strava dit autre chose.
  const fractionneCard = recommendations.workouts.find((w) => w.key === "fractionne") ?? null;
  const fitnessRef = raceEstimates ? { refDistKm: raceEstimates.refDistKm, refTimeMin: raceEstimates.refTimeMin } : null;
  const intervalAnalysis = lastRunLaps
    ? analyzeIntervalStructure(lastRunLaps, paceByZone, fractionneCard?.intervalTarget ?? null, fitnessRef)
    : null;
  if (intervalAnalysis) {
    intervalAnalysis.matchesRecommendation = fractionneCard !== null;
  }
  const typeLabel: WorkoutTypeLabel = intervalAnalysis ? "séance" : workoutTypeLabel(last.workout_type);
  const isEasyContext = typeLabel === "sortie" || typeLabel === "sortie longue";

  // Bassin de comparaison : sorties de distance comparable parmi les 20 précédentes,
  // sinon repli sur les 8 dernières sorties toutes distances confondues.
  const recentPool = prevRuns.slice(-20);
  let baseline = recentPool.filter(
    (a) => a.distance >= last.distance * 0.6 && a.distance <= last.distance * 1.4
  );
  if (baseline.length < 3) baseline = recentPool.slice(-8);

  const avgBaselinePace =
    baseline.length > 0
      ? baseline.reduce((s, a) => s + paceFromSpeed(a.average_speed), 0) / baseline.length
      : null;
  const avgBaselineElevPerKm =
    baseline.length > 0
      ? baseline.reduce((s, a) => s + a.total_elevation_gain / Math.max(a.distance / 1000, 0.1), 0) /
        baseline.length
      : null;
  const lastElevPerKm = last.total_elevation_gain / Math.max(lastDistKm, 0.1);

  const last8 = prevRuns.slice(-8);
  const typicalDistanceKm =
    last8.length > 0 ? last8.reduce((s, a) => s + a.distance / 1000, 0) / last8.length : null;
  const maxRecentDistanceKm =
    last8.length > 0 ? Math.max(...last8.map((a) => a.distance / 1000)) : null;

  const daysSincePrevious =
    prevRuns.length > 0
      ? (new Date(last.start_date_local).getTime() -
          new Date(prevRuns[prevRuns.length - 1].start_date_local).getTime()) /
        MS_DAY
      : null;

  const hasHr = !!(last.has_heartrate && last.average_heartrate);
  const hrZoneIdx = hasHr && zones.length >= 4 ? zoneIndexForHr(last.average_heartrate!, zones) : null;

  const positives: string[] = [];
  const watchouts: string[] = [];

  if ((last.pr_count ?? 0) > 0) {
    positives.push("Nouveau record personnel enregistré sur cette sortie.");
  }

  if (intervalAnalysis) {
    positives.push(
      `Séance fractionnée reconnue à partir des données de la montre : ${intervalAnalysis.repCount} × ${intervalAnalysis.repDistanceM} m à ${intervalAnalysis.repPaceLabel} (entre ${intervalAnalysis.repPaceRangeLabel}), récupération ${intervalAnalysis.recoveryLabel}.`
    );
    if (intervalAnalysis.targetPaceRange && intervalAnalysis.withinTarget) {
      positives.push(
        `Allure des répétitions cohérente avec ta zone d'allure fractionné habituelle (${intervalAnalysis.targetPaceRange}).`
      );
    } else if (intervalAnalysis.targetPaceRange && intervalAnalysis.withinTarget === false) {
      watchouts.push(
        `Allure des répétitions (${intervalAnalysis.repPaceLabel}) en dehors de ta zone fractionné habituelle (${intervalAnalysis.targetPaceRange}) — à surveiller si ce n'est pas volontaire.`
      );
    }
    if (intervalAnalysis.paceTrendKind === "fatigue") {
      watchouts.push(
        `Allure ${intervalAnalysis.consistencyLabel} — souvent le signe d'un départ trop rapide ou d'une fatigue qui s'installe.`
      );
    } else if (intervalAnalysis.paceTrendKind === "progressif") {
      positives.push(`Séance ${intervalAnalysis.consistencyLabel} : bon signe de gestion de l'effort.`);
    } else {
      positives.push(`Allure ${intervalAnalysis.consistencyLabel} sur l'ensemble des répétitions.`);
    }
    if (intervalAnalysis.hrDriftBpm !== null) {
      if (intervalAnalysis.hrDriftBpm >= 8) {
        watchouts.push(
          `FC en hausse de ${intervalAnalysis.hrDriftBpm} bpm entre les premières et les dernières répétitions : dérive assez marquée, normal en fin de séance mais à garder à l'œil si ça s'accentue.`
        );
      } else {
        positives.push(
          `FC restée stable entre le début et la fin de la séance (+${intervalAnalysis.hrDriftBpm} bpm) : bonne gestion de l'effort.`
        );
      }
    }
    if (intervalAnalysis.targetComparison) {
      const tc = intervalAnalysis.targetComparison;
      const repsLabel = tc.repsMin === tc.repsMax ? `${tc.repsMin}` : `${tc.repsMin} à ${tc.repsMax}`;
      const targetLabel = `${repsLabel} x ${tc.distanceM} m${tc.recoveryLabel ? ` (récup. ${tc.recoveryLabel})` : ""}`;
      const doneLabel = `${intervalAnalysis.repCount} x ${intervalAnalysis.repDistanceM} m`;
      if (tc.verdict === "conforme") {
        positives.push(
          `Format conforme à la séance actuellement proposée (${targetLabel}) : tu as fait ${doneLabel} — belle mise en application du programme.`
        );
      } else if (tc.verdict === "moins") {
        positives.push(
          `Un peu en dessous du format proposé (${targetLabel}), tu as fait ${doneLabel} : reste cohérent si tu gérais ta charge ce jour-là, sinon vise le haut de la fourchette la prochaine fois.`
        );
      } else if (tc.verdict === "plus") {
        positives.push(
          `Au-dessus du format proposé (${targetLabel}), tu as fait ${doneLabel} : beau volume, à condition que l'allure soit restée tenue jusqu'au bout des dernières répétitions.`
        );
      } else {
        positives.push(
          `Format différent de la séance proposée (${targetLabel}) : tu as travaillé sur du ${intervalAnalysis.repDistanceM} m — pas un souci en soi, juste un format différent de la suggestion du moment.`
        );
      }
    } else if (intervalAnalysis.matchesRecommendation) {
      positives.push(
        "Le fractionné fait partie des sorties actuellement proposées dans « Sorties pour progresser » — belle mise en application du programme."
      );
    }
    if (intervalAnalysis.fitnessComparisonKind && intervalAnalysis.fitnessPaceLabel) {
      if (intervalAnalysis.fitnessComparisonKind === "plus_rapide") {
        positives.push(
          `Allure des répétitions nettement plus rapide que ton allure 5 km actuelle estimée (${intervalAnalysis.fitnessPaceLabel}) : un vrai travail de vitesse, cohérent avec ta forme du moment.`
        );
      } else if (intervalAnalysis.fitnessComparisonKind === "proche") {
        positives.push(
          `Allure des répétitions proche de ton allure 5 km actuelle estimée (${intervalAnalysis.fitnessPaceLabel}) : correct, mais vu ta forme du moment tu as sans doute encore de la marge pour aller plus vite sur un format aussi court.`
        );
      } else {
        watchouts.push(
          `Allure des répétitions plus lente que ton allure 5 km actuelle estimée (${intervalAnalysis.fitnessPaceLabel}) : pas assez soutenu pour un vrai stimulus de vitesse au vu de ta forme du moment.`
        );
      }
    }
  } else if (avgBaselinePace !== null && avgBaselinePace > 0) {
    const paceDeltaPct = ((lastPace - avgBaselinePace) / avgBaselinePace) * 100;
    const climbedMore =
      avgBaselineElevPerKm !== null && lastElevPerKm > avgBaselineElevPerKm * 1.5;
    const tooHardForEasy = isEasyContext && hrZoneIdx !== null && hrZoneIdx >= 3;
    if (paceDeltaPct <= -3 && tooHardForEasy) {
      watchouts.push(
        `Allure ${formatPace(lastPace)} : plus rapide que ta moyenne récente, mais avec une FC en zone ${hrZoneIdx} — sur une sortie censée rester facile, mieux vaut ralentir pour garder la FC basse plutôt que gagner quelques secondes au kilomètre.`
      );
    } else if (paceDeltaPct <= -3) {
      positives.push(
        `Allure ${formatPace(lastPace)} : plus rapide que ta moyenne récente sur une distance comparable (${formatPace(
          avgBaselinePace
        )}).`
      );
    } else if (paceDeltaPct >= 5 && climbedMore) {
      positives.push(
        `Allure plus lente qu'habituellement, mais cohérent avec le dénivelé de cette sortie (${Math.round(
          lastElevPerKm
        )} m/km contre ${Math.round(avgBaselineElevPerKm!)} m/km en moyenne).`
      );
    } else if (paceDeltaPct >= 5) {
      watchouts.push(
        `Allure ${formatPace(lastPace)} : environ ${Math.round(
          paceDeltaPct
        )} % plus lent que ta moyenne récente sur une distance comparable (${formatPace(avgBaselinePace)}). Si ce n'est pas expliqué par la fatigue ou le terrain, garde un œil dessus la prochaine fois.`
      );
    }
  }

  if (!intervalAnalysis && typicalDistanceKm !== null) {
    if (lastDistKm >= typicalDistanceKm * 1.15) {
      positives.push(
        `Sortie plus longue que ta moyenne récente (${lastDistKm.toFixed(1)} km contre ${typicalDistanceKm.toFixed(
          1
        )} km) — bon travail d'endurance.`
      );
    }
    if (maxRecentDistanceKm !== null && lastDistKm > maxRecentDistanceKm * 1.3) {
      watchouts.push(
        `Hausse nette de distance par rapport à tes sorties récentes (jusqu'ici ${maxRecentDistanceKm.toFixed(
          1
        )} km max) : mieux vaut progresser par paliers pour limiter le risque de blessure.`
      );
    }
  }

  if (hrZoneIdx !== null) {
    if (isEasyContext && hrZoneIdx >= 4) {
      watchouts.push(
        `FC moyenne de ${Math.round(
          last.average_heartrate!
        )} bpm, en zone ${hrZoneIdx} : plutôt soutenu pour ce type de sortie — les sorties de fond gagnent à rester en zone 1-2.`
      );
    } else if (isEasyContext && hrZoneIdx <= 2) {
      positives.push(
        `FC moyenne de ${Math.round(
          last.average_heartrate!
        )} bpm, bien contenue en zone ${hrZoneIdx} : exactement l'effort recherché sur ce type de sortie.`
      );
    } else if (typeLabel === "séance" && hrZoneIdx >= 3) {
      positives.push(`FC moyenne en zone ${hrZoneIdx} : cohérent avec une séance à intensité.`);
    }
  }

  if (daysSincePrevious !== null && daysSincePrevious < 0.85 && (hrZoneIdx ?? 0) >= 4) {
    watchouts.push(
      "Moins d'un jour depuis ta sortie précédente, pour un effort plutôt soutenu : surveille que la récupération suit."
    );
  }

  if (positives.length === 0) {
    positives.push("Sortie enregistrée dans la continuité de ton volume habituel.");
  }
  if (watchouts.length === 0) {
    watchouts.push("Rien de particulier à signaler sur cette sortie — poursuis sur cette lancée.");
  }

  // ---- conseil de repos ----
  let restAdvice: string;
  if (typeLabel === "course") {
    const days = Math.min(10, Math.max(1, Math.round(lastDistKm / 5)));
    restAdvice = `Après une course de ${lastDistKm.toFixed(1)} km, compte ${days} à ${
      days + 1
    } jour${days > 1 ? "s" : ""} de récupération active (footing très facile ou repos) avant de reprendre les séances exigeantes.`;
  } else if (hrZoneIdx !== null && hrZoneIdx >= 4) {
    restAdvice =
      "Effort soutenu : ajoute une journée de récupération facile (ou de repos complet) avant ta prochaine séance intense.";
  } else if (typeLabel === "séance") {
    restAdvice =
      "Après cette séance, une sortie facile ou un jour de repos suffit avant de repartir sur de l'intensité.";
  } else if (
    typeLabel === "sortie longue" ||
    (maxRecentDistanceKm !== null && lastDistKm >= maxRecentDistanceKm)
  ) {
    restAdvice = "Une sortie très facile ou un repos demain suffit à encaisser cette sortie longue.";
  } else {
    restAdvice = "Effort modéré : tu peux enchaîner normalement, pas de repos particulier nécessaire.";
  }

  // ---- proposition pour la sortie suivante, choisie dans les formats actuellement adaptés ----
  const lastQuality = [...prevRuns].reverse().find((a) => a.workout_type === 3);
  const daysSinceQuality = lastQuality
    ? (new Date(last.start_date_local).getTime() - new Date(lastQuality.start_date_local).getTime()) /
      MS_DAY
    : null;

  let desiredKey: WorkoutKey;
  let nextWorkoutRationale: string;
  if (typeLabel === "course") {
    desiredKey = "ef";
    nextWorkoutRationale =
      "Après une course, on repart doucement : une sortie fondamentale bien facile avant de retrouver du rythme.";
  } else if (hrZoneIdx !== null && hrZoneIdx >= 4) {
    desiredKey = "ef";
    nextWorkoutRationale =
      "Cette sortie était soutenue : la prochaine gagne à rester très facile pour encaisser l'effort.";
  } else if (
    typeLabel === "sortie longue" ||
    (maxRecentDistanceKm !== null && lastDistKm > maxRecentDistanceKm * 1.2)
  ) {
    desiredKey = "ef";
    nextWorkoutRationale =
      "Après cette sortie longue, priorité à la récupération avant la prochaine séance de qualité.";
  } else if (typeLabel === "séance") {
    desiredKey = "sortieLongue";
    nextWorkoutRationale =
      "Après une séance, la sortie longue reste l'occasion de construire de l'endurance à effort contrôlé.";
  } else if (daysSinceQuality === null || daysSinceQuality > 9) {
    desiredKey = "fractionne";
    nextWorkoutRationale =
      "Pas de séance structurée depuis un moment : cette sortie facile est une bonne base pour réintroduire du fractionné.";
  } else {
    desiredKey = "fartlek";
    nextWorkoutRationale =
      "Cette sortie facile est une bonne base pour varier le stimulus avec un fartlek avant la prochaine séance structurée.";
  }
  const nextWorkout =
    recommendations.workouts.find((w) => w.key === desiredKey) ?? recommendations.workouts[0] ?? null;

  return {
    id: last.id,
    name: last.name,
    date: last.start_date_local.slice(0, 10),
    distKm: Math.round(lastDistKm * 10) / 10,
    durationLabel: formatDuration(last.moving_time),
    paceLabel: formatPace(lastPace),
    avgHr: hasHr ? Math.round(last.average_heartrate!) : null,
    hrZoneIdx,
    elevM: Math.round(last.total_elevation_gain),
    isPR: (last.pr_count ?? 0) > 0,
    typeLabel,
    daysSincePrevious: daysSincePrevious !== null ? Math.round(daysSincePrevious * 10) / 10 : null,
    positives,
    watchouts,
    restAdvice,
    nextWorkout,
    nextWorkoutRationale,
    intervalAnalysis,
  };
}

/**
 * Regroupe les allures réellement courues (min/km) par zone de FC atteinte, à partir de
 * l'historique complet des sorties — la base empirique qui permet de proposer des allures
 * personnalisées plutôt qu'une formule générique.
 */
function buildPaceByZone(sorted: StravaActivity[], zones: ZoneBound[]): Map<number, number[]> {
  const byZone = new Map<number, number[]>();
  if (zones.length < 4) return byZone;
  for (const a of sorted) {
    if (!a.has_heartrate || !a.average_heartrate || !a.average_speed) continue;
    if (a.distance < 1500) continue; // trop court pour être représentatif
    const z = zoneIndexForHr(a.average_heartrate, zones);
    if (z === null) continue;
    const pace = paceFromSpeed(a.average_speed);
    if (pace <= 0) continue;
    if (!byZone.has(z)) byZone.set(z, []);
    byZone.get(z)!.push(pace);
  }
  return byZone;
}

/** Fourchette d'allure (20e-80e percentile, pour ignorer les valeurs extrêmes) sur un groupe de zones. */
function paceRangeForZones(
  byZone: Map<number, number[]>,
  zoneNums: number[]
): { lo: number; hi: number; n: number } | null {
  const paces = zoneNums.flatMap((z) => byZone.get(z) ?? []);
  if (paces.length < 3) return null;
  const asc = [...paces].sort((a, b) => a - b);
  const pct = (p: number) => asc[Math.min(asc.length - 1, Math.floor(p * (asc.length - 1)))];
  return { lo: pct(0.2), hi: pct(0.8), n: paces.length };
}

function fmtPaceValue(decimalMinPerKm: number): string {
  const min = Math.floor(decimalMinPerKm);
  const sec = Math.round((decimalMinPerKm - min) * 60);
  const mm = sec === 60 ? min + 1 : min;
  const ss = sec === 60 ? 0 : sec;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function formatPaceRange(range: { lo: number; hi: number } | null): string | null {
  if (!range) return null;
  return `${fmtPaceValue(range.lo)} à ${fmtPaceValue(range.hi)}/km`;
}

/** Essaie d'abord une zone précise, puis élargit si l'échantillon est trop faible pour être fiable. */
function bestPaceRange(byZone: Map<number, number[]>, primary: number[], fallback: number[]): string | null {
  return formatPaceRange(paceRangeForZones(byZone, primary)) ?? formatPaceRange(paceRangeForZones(byZone, fallback));
}

interface LapWork {
  index: number;
  distance: number;
  time: number;
  pace: number; // décimal minutes/km
  hr: number | null;
}

/**
 * Reconnaît une structure fractionnée (répétitions + récupérations) dans les tours (laps)
 * enregistrés par la montre, sans dépendre du tag manuel Strava. Heuristique validée à la main sur
 * une vraie séance de l'athlète (échauffement 20', 8 × 400 m / 200 m récup, retour au calme) :
 * - un tour "travail" est nettement plus rapide que l'allure médiane de la sortie (≤ 92 %) et fait
 *   entre 100 m et 2 km — ce qui exclut d'emblée l'échauffement et le retour au calme ;
 * - on regroupe ces tours par distance arrondie au 50 m le plus proche pour isoler la distance de
 *   répétition dominante (8 × 400 m plutôt qu'un mélange de fragments) ; il en faut au moins 3 pour
 *   parler de séance structurée plutôt que de simples accélérations isolées ;
 * - un tour "récupération" est un tour non-travail directement adjacent (index ± 1) à un tour de
 *   travail, et pas trop long (≤ max(600 m, 1,5 × distance de répétition)) — ce qui exclut à nouveau
 *   l'échauffement et le retour au calme, qui sont adjacents mais bien plus longs.
 */
function analyzeIntervalStructure(
  laps: StravaLap[],
  paceByZone: Map<number, number[]>,
  targetOptions: FractionneTargetOption[] | null,
  fitnessRef: { refDistKm: number; refTimeMin: number } | null
): IntervalAnalysis | null {
  if (!laps || laps.length < 5) return null;

  const items: LapWork[] = laps
    .map((l, i) => ({
      index: i,
      distance: l.distance,
      time: l.moving_time || l.elapsed_time,
      pace: paceFromSpeed(l.average_speed),
      hr: typeof l.average_heartrate === "number" ? l.average_heartrate : null,
    }))
    .filter((l) => l.pace > 0 && l.distance > 0);
  if (items.length < 5) return null;

  const medianPace = median(items.map((l) => l.pace));
  const workCandidates = items.filter(
    (l) => l.pace <= medianPace * 0.92 && l.distance >= 100 && l.distance <= 2000
  );
  if (workCandidates.length < 3) return null;

  const roundTo50 = (d: number) => Math.round(d / 50) * 50;
  const groups = new Map<number, LapWork[]>();
  for (const w of workCandidates) {
    const key = roundTo50(w.distance);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(w);
  }
  let bestGroup: LapWork[] = [];
  for (const group of groups.values()) {
    if (group.length > bestGroup.length) bestGroup = group;
  }
  if (bestGroup.length < 3) return null;

  const workIndexes = new Set(bestGroup.map((w) => w.index));
  const avgRepDistance = bestGroup.reduce((s, w) => s + w.distance, 0) / bestGroup.length;
  const recoveryLimit = Math.max(600, avgRepDistance * 1.5);

  const recoveryIndexes = new Set<number>();
  for (const idx of workIndexes) {
    for (const adjIdx of [idx - 1, idx + 1]) {
      if (workIndexes.has(adjIdx)) continue;
      const cand = items.find((l) => l.index === adjIdx);
      if (cand && cand.distance <= recoveryLimit) recoveryIndexes.add(adjIdx);
    }
  }
  const recoveryLaps = items.filter((l) => recoveryIndexes.has(l.index));

  const repPacesAsc = bestGroup.map((w) => w.pace).sort((a, b) => a - b);
  const avgRepPace = repPacesAsc.reduce((s, p) => s + p, 0) / repPacesAsc.length;
  const fastest = repPacesAsc[0];
  const slowest = repPacesAsc[repPacesAsc.length - 1];

  // Tendance d'allure entre le début et la fin de la séance : une accélération progressive
  // (répétitions de plus en plus rapides) est un bon signe de gestion de l'effort, alors qu'un
  // ralentissement en fin de séance signale plutôt un départ trop rapide ou de la fatigue —
  // l'écart-type seul ne fait pas cette distinction, d'où un calcul basé sur la tendance.
  const sortedByIndex = [...bestGroup].sort((a, b) => a.index - b.index);
  const firstTwoPace = sortedByIndex.slice(0, 2);
  const lastTwoPace = sortedByIndex.slice(-2);
  const avgFirstPace = firstTwoPace.reduce((s, l) => s + l.pace, 0) / firstTwoPace.length;
  const avgLastPace = lastTwoPace.reduce((s, l) => s + l.pace, 0) / lastTwoPace.length;
  const paceDriftSecPerKm = (avgLastPace - avgFirstPace) * 60;

  let paceTrendKind: IntervalAnalysis["paceTrendKind"];
  let consistencyLabel: string;
  if (paceDriftSecPerKm >= 5) {
    paceTrendKind = "fatigue";
    consistencyLabel = "en perte de vitesse sur la fin de la séance";
  } else if (paceDriftSecPerKm <= -5) {
    paceTrendKind = "progressif";
    consistencyLabel = "progressive : les dernières répétitions plus rapides que les premières";
  } else {
    paceTrendKind = "stable";
    consistencyLabel = "régulière d'une répétition à l'autre";
  }

  let hrDriftBpm: number | null = null;
  const withHr = sortedByIndex.filter((l) => l.hr !== null) as (LapWork & { hr: number })[];
  if (withHr.length >= 4) {
    const firstTwo = withHr.slice(0, 2);
    const lastTwo = withHr.slice(-2);
    const avgFirst = firstTwo.reduce((s, l) => s + l.hr, 0) / firstTwo.length;
    const avgLast = lastTwo.reduce((s, l) => s + l.hr, 0) / lastTwo.length;
    hrDriftBpm = Math.round(avgLast - avgFirst);
  }

  const targetRange = paceRangeForZones(paceByZone, [4]) ?? paceRangeForZones(paceByZone, [3, 4]);
  const targetPaceRange = formatPaceRange(targetRange);
  const withinTarget = targetRange
    ? avgRepPace <= targetRange.hi * 1.05 && avgRepPace >= targetRange.lo * 0.85
    : null;

  const avgRecoveryTime =
    recoveryLaps.length > 0 ? recoveryLaps.reduce((s, l) => s + l.time, 0) / recoveryLaps.length : null;
  const avgRecoveryDist =
    recoveryLaps.length > 0
      ? recoveryLaps.reduce((s, l) => s + l.distance, 0) / recoveryLaps.length
      : null;
  const recoveryLabel =
    avgRecoveryTime !== null && avgRecoveryDist !== null
      ? `≈ ${Math.round(avgRecoveryDist)} m en ${formatDuration(Math.round(avgRecoveryTime))}`
      : "non détaillée";

  const repDistanceM = Math.round(avgRepDistance / 50) * 50;

  // ---- comparaison fine avec le format précis de la séance actuellement proposée ----
  // On choisit, parmi les formats possibles (400 m et/ou 1000 m selon la phase), celui dont la
  // distance est la plus proche de ce qui a été réellement couru ; au-delà de 25 % d'écart, on
  // considère qu'il ne s'agit pas du même format plutôt que de forcer un rapprochement trompeur.
  let targetComparison: IntervalAnalysis["targetComparison"] = null;
  if (targetOptions && targetOptions.length > 0) {
    let closest = targetOptions[0];
    let closestDelta = Math.abs(repDistanceM - closest.distanceM) / closest.distanceM;
    for (const opt of targetOptions.slice(1)) {
      const delta = Math.abs(repDistanceM - opt.distanceM) / opt.distanceM;
      if (delta < closestDelta) {
        closest = opt;
        closestDelta = delta;
      }
    }
    const recoveryTargetLabel =
      closest.recoveryM !== null
        ? `${closest.recoveryM} m`
        : closest.recoverySecMin !== null && closest.recoverySecMax !== null
        ? `${Math.round(closest.recoverySecMin / 60)} à ${Math.round(closest.recoverySecMax / 60)} min`
        : null;
    if (closestDelta > 0.25) {
      targetComparison = {
        distanceM: closest.distanceM,
        repsMin: closest.repsMin,
        repsMax: closest.repsMax,
        recoveryLabel: recoveryTargetLabel,
        verdict: "distance_differente",
      };
    } else {
      const verdict: "conforme" | "moins" | "plus" =
        bestGroup.length < closest.repsMin ? "moins" : bestGroup.length > closest.repsMax ? "plus" : "conforme";
      targetComparison = {
        distanceM: closest.distanceM,
        repsMin: closest.repsMin,
        repsMax: closest.repsMax,
        recoveryLabel: recoveryTargetLabel,
        verdict,
      };
    }
  }

  // ---- allure des répétitions replacée par rapport à la forme du moment (pas l'historique
  // complet) : on projette une allure 5 km depuis la même référence que les estimations de temps
  // de course, pour un repère réaliste et motivant ancré sur le niveau actuel de l'athlète ----
  let fitnessPaceLabel: string | null = null;
  let fitnessComparisonKind: IntervalAnalysis["fitnessComparisonKind"] = null;
  if (fitnessRef && fitnessRef.refTimeMin > 0) {
    const proj5kTimeMin = riegelProjectTime(fitnessRef.refDistKm, fitnessRef.refTimeMin, 5);
    const proj5kPace = proj5kTimeMin / 5;
    if (proj5kPace > 0) {
      fitnessPaceLabel = formatPace(proj5kPace);
      if (avgRepPace <= proj5kPace * 0.95) fitnessComparisonKind = "plus_rapide";
      else if (avgRepPace >= proj5kPace * 1.02) fitnessComparisonKind = "plus_lent";
      else fitnessComparisonKind = "proche";
    }
  }

  return {
    repCount: bestGroup.length,
    repDistanceM,
    repPaceLabel: formatPace(avgRepPace),
    repPaceRangeLabel: `${fmtPaceValue(fastest)} à ${fmtPaceValue(slowest)}/km`,
    recoveryCount: recoveryLaps.length,
    recoveryLabel,
    targetPaceRange,
    withinTarget,
    hrDriftBpm,
    paceTrendKind,
    consistencyLabel,
    matchesRecommendation: false,
    targetComparison,
    fitnessPaceLabel,
    fitnessComparisonKind,
  };
}

/**
 * Allures indicatives par type de séance, déduites empiriquement des sorties passées dans les
 * zones de FC correspondantes. Calculé une seule fois et partagé entre les "Sorties pour
 * progresser" (recommandations du moment) et le générateur de programme (Trajectoire vers un
 * objectif), pour que les deux se basent sur la même lecture des données.
 */
function buildWorkoutPaceHints(paceByZone: Map<number, number[]>): WorkoutPaceHints {
  return {
    easyRange: bestPaceRange(paceByZone, [1, 2], [1, 2]),
    fartlekRange: bestPaceRange(paceByZone, [3], [3, 4]),
    fractionneRange: bestPaceRange(paceByZone, [4], [3, 4]),
  };
}

/** Formats de fractionné valides pour une phase donnée — la même logique que le texte `duree` de
 * la carte "Fractionné", mais sous forme structurée pour pouvoir comparer précisément une séance
 * réalisée (reps × distance) au format effectivement proposé. */
function fractionneIntervalTargets(phase: Recommendations["phase"]): FractionneTargetOption[] {
  if (phase === "progression") {
    return [
      { distanceM: 400, repsMin: 8, repsMax: 12, recoveryM: 200, recoverySecMin: null, recoverySecMax: null },
      { distanceM: 1000, repsMin: 5, repsMax: 6, recoveryM: null, recoverySecMin: 120, recoverySecMax: 180 },
    ];
  }
  return [{ distanceM: 400, repsMin: 6, repsMax: 8, recoveryM: 200, recoverySecMin: null, recoverySecMax: null }];
}

function buildRecommendations(
  compare: { prevKm: number; currKm: number },
  zones: ZoneBound[],
  paceHints: WorkoutPaceHints,
  avgElevPerKmRecent: number
): Recommendations {
  const prevWeekly = compare.prevKm / 8;
  const currWeekly = compare.currKm / 8;

  let phase: Recommendations["phase"] = "maintien";
  if (prevWeekly > 1 && currWeekly < prevWeekly * 0.5) phase = "reconstruction";
  else if (currWeekly > prevWeekly * 1.2) phase = "progression";

  const phaseLabel =
    phase === "reconstruction"
      ? "Phase de reconstruction"
      : phase === "progression"
      ? "Phase de progression"
      : "Phase de maintien";

  const phaseNote =
    phase === "reconstruction"
      ? "Le volume récent est nettement en dessous de la période précédente : on se concentre sur l'endurance de base, l'intensité attendra que le volume soit reconstruit."
      : phase === "progression"
      ? "Le volume est déjà en hausse : la palette de sorties s'élargit, mais reste mesurée pour ne pas accumuler la fatigue trop vite."
      : "Le volume est stable : c'est le bon moment pour travailler toutes les allures, du fondamental à la vitesse.";

  const zoneHint = zones.length >= 4;
  const { easyRange, fartlekRange, fractionneRange } = paceHints;

  const pool: WorkoutCard[] = [
    {
      key: "ef",
      n: 0,
      title: "Sortie fondamentale",
      zoneLabel: "aerobie",
      freq: "2 à 3 fois / semaine",
      duree: "25 à 40 min, aucune contrainte d'allure",
      cible: zoneHint
        ? `Z1-Z2 (FC < ${zones[2]?.min ?? "..."} bpm environ)`
        : "Z1-Z2 : allure conversation, sans forcer",
      paceHint: easyRange,
      why: "Le socle de toute reprise ou progression : construire le volume aérobie sans stress supplémentaire.",
    },
    {
      key: "sortieLongue",
      n: 0,
      title: "Sortie longue progressive",
      zoneLabel: "aerobie",
      freq: "1 fois / semaine, la plus longue",
      duree: "part de ta distance actuelle, +1 km environ toutes les 1 à 2 semaines",
      cible: "Z1-Z2 strict, aucune pression d'allure",
      paceHint: easyRange,
      why: "Le levier n°1 pour bâtir un plancher aérobie avant tout travail de dénivelé ou de vitesse.",
    },
    {
      key: "fartlek",
      n: 0,
      title: "Fartlek",
      zoneLabel: "tempo",
      freq: "1 fois / semaine",
      duree: "25 à 30 min dont 6 à 8 x 1 min plus soutenu / 2 min très facile",
      cible: "Portions rapides en Z3, à la sensation plutôt qu'au chrono",
      paceHint: fartlekRange ? `portions rapides : ${fartlekRange}` : null,
      why: "Un format simple pour réintroduire du rythme sans le choc d'un fractionné classique.",
    },
    {
      key: "fractionne",
      n: 0,
      title: "Fractionné",
      zoneLabel: "seuil",
      freq: "1 fois / semaine",
      duree:
        phase === "progression"
          ? "8 à 12 x 400 m (récup. 200 m trot), ou 5 à 6 x 1000 m (récup. 2-3 min)"
          : "6 à 8 x 400 m (récup. 200 m trot)",
      cible: "Z4, allure nettement plus rapide que le fartlek, cette fois au chrono",
      paceHint: fractionneRange ? `répétitions : ${fractionneRange}` : null,
      why: "Un stimulus plus précis que le fartlek pour développer la VMA et l'économie de course.",
      intervalTarget: fractionneIntervalTargets(phase),
    },
    {
      key: "cotes",
      n: 0,
      title: "Côtes / dénivelé",
      zoneLabel: "maximal",
      freq: "1 fois / semaine",
      duree: "6 à 10 répétitions de côtes de 200 à 400 m, retour en footing",
      cible: "Montée en Z4-Z5, récupération complète en descente",
      paceHint: "non pertinent en côtes — vise l'effort et la FC, pas le chrono",
      why: "Tes sorties récentes contiennent du dénivelé : ce format prépare spécifiquement la capacité à grimper.",
    },
  ];

  // Le choix des sorties proposées s'adapte à la phase de forme actuelle : on ne propose pas de
  // travail de vitesse tant que le volume de base n'est pas reconstruit, et les côtes n'ont
  // d'intérêt que si le terrain récent en comporte déjà.
  let selectedKeys: WorkoutKey[];
  if (phase === "reconstruction") {
    selectedKeys = ["ef", "sortieLongue"];
  } else {
    selectedKeys = ["ef", "sortieLongue", "fartlek", "fractionne"];
  }
  if (phase !== "reconstruction" && avgElevPerKmRecent >= 12) {
    selectedKeys.push("cotes");
  }

  const workouts = pool
    .filter((w) => selectedKeys.includes(w.key))
    .map((w, i) => ({ ...w, n: i + 1 }));

  return { phase, phaseLabel, phaseNote, workouts };
}

export function riegelProjectTime(
  refDistKm: number,
  refTimeMin: number,
  targetDistKm: number,
  exponent = 1.06
): number {
  if (refDistKm <= 0 || refTimeMin <= 0 || targetDistKm <= 0) return 0;
  return refTimeMin * Math.pow(targetDistKm / refDistKm, exponent);
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/**
 * Estime les temps sur 5, 10, semi et marathon à partir de la forme du moment (formule de
 * Riegel), avec une prudence explicite sur le marathon quand aucune sortie longue ne vient
 * étayer l'extrapolation.
 *
 * Pour refléter la forme « du moment » plutôt qu'une seule sortie qui pourrait être un coup
 * isolé (bon ou mauvais), on regarde les sorties des ~2 derniers mois (repli à 4 mois si les
 * données récentes sont trop rares), on ramène chacune à un temps équivalent sur 10 km, et on
 * prend la médiane des meilleures d'entre elles comme référence.
 */
function buildRaceEstimates(sorted: StravaActivity[], now: Date): RaceEstimates | null {
  const inWindow = (days: number) => {
    const cutoff = now.getTime() - days * MS_DAY;
    return sorted.filter(
      (a) => a.distance >= 3000 && a.moving_time > 0 && new Date(a.start_date_local).getTime() >= cutoff
    );
  };

  let windowDays = 60;
  let candidates = inWindow(windowDays);
  if (candidates.length < 3) {
    const wider = inWindow(120);
    if (wider.length > candidates.length) {
      candidates = wider;
      windowDays = 120;
    }
  }
  if (candidates.length === 0) return null;

  // Chaque sortie ramenée à un temps équivalent sur 10 km ; on garde les meilleures (jusqu'à 3)
  // et on en prend la médiane, pour lisser un coup isolé sans diluer vers l'allure des sorties
  // faciles, très majoritaires dans le volume d'entraînement.
  const projected = candidates
    .map((a) => ({ a, predicted10k: riegelProjectTime(a.distance / 1000, a.moving_time / 60, 10) }))
    .sort((x, y) => x.predicted10k - y.predicted10k);
  const sample = projected.slice(0, Math.min(3, projected.length));

  const refDistKm = 10;
  const refTimeMin = median(sample.map((s) => s.predicted10k));
  const longestRecentKm = Math.max(...candidates.map((a) => a.distance / 1000));

  const estimates: RaceEstimate[] = STANDARD_RACE_DISTANCES.map((d) => {
    let timeMin = riegelProjectTime(refDistKm, refTimeMin, d.km);
    if (d.key === "marathon" && longestRecentKm < 15) {
      timeMin *= 1.04; // pénalité de prudence : pas de sortie longue récente pour valider l'endurance spécifique
    }
    return {
      key: d.key,
      label: d.label,
      km: d.km,
      timeLabel: formatDuration(Math.round(timeMin * 60)),
      paceLabel: formatPace(timeMin / d.km),
    };
  });

  const marathonCaveat =
    longestRecentKm < 15
      ? `Estimation prudente : ta sortie la plus longue récemment fait ${longestRecentKm.toFixed(
          1
        )} km — sans sortie longue proche de la distance marathon, cette projection reste théorique.`
      : longestRecentKm < 25
      ? "Estimation à confirmer par quelques sorties longues supplémentaires à l'approche de l'objectif."
      : null;

  const basisLabel =
    sample.length >= 2
      ? `Basé sur tes ${sample.length} meilleures sorties des ${windowDays} derniers jours (équivalent 10 km ≈ ${formatDuration(
          Math.round(refTimeMin * 60)
        )}).`
      : `Basé sur ta seule sortie récente exploitable, le ${new Date(
          sample[0].a.start_date_local
        ).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })} (${(
          sample[0].a.distance / 1000
        ).toFixed(1)} km) — quelques sorties de plus affineront cette estimation.`;

  return {
    estimates,
    basisLabel,
    marathonCaveat,
    refDistKm,
    refTimeMin,
  };
}

export interface GoalPlanInput {
  eventDate: Date;
  distanceKm: number;
  elevationGainM: number;
  targetTimeSec: number | null;
  sessionsPerWeek: number;
  now: Date;
  currentWeeklyKm: number;
  raceEstimateRef: { refDistKm: number; refTimeMin: number } | null;
  paceHints: WorkoutPaceHints;
  zones: ZoneBound[];
}

export interface GoalPlanSession {
  label: string;
  zoneLabel: "aerobie" | "tempo" | "seuil" | "maximal";
  detail: string;
}

export interface GoalPlanWeek {
  weekIndex: number;
  startDate: string;
  km: number;
  sessions: GoalPlanSession[];
  phase: "base" | "specifique" | "affutage";
}

export interface GoalFeasibility {
  verdict: string;
  note: string;
}

export interface GoalPlan {
  totalWeeks: number;
  weeks: GoalPlanWeek[];
  feasibility: GoalFeasibility | null;
  peakWeeklyKm: number;
}

// ---- description détaillée de chaque type de séance, pour le programme semaine par semaine ----
// Reprend la même logique/allures que les cartes "Sorties pour progresser", adaptée au contexte
// d'un programme (distance de la sortie longue calée sur le volume de la semaine, densité du
// fractionné selon la proximité de l'objectif).

function sessionSortieLongue(weekKm: number, paceHints: WorkoutPaceHints): GoalPlanSession {
  const longKm = Math.max(6, Math.round(Math.min(weekKm * 0.32, weekKm - 4) * 2) / 2);
  return {
    label: "Sortie longue",
    zoneLabel: "aerobie",
    detail: `≈ ${longKm} km à allure ${paceHints.easyRange ?? "facile, à la sensation"} (Z1-Z2 strict, aucune pression d'allure).`,
  };
}

function sessionEF(paceHints: WorkoutPaceHints, zones: ZoneBound[]): GoalPlanSession {
  const cible = zones.length >= 4 ? `Z1-Z2, FC < ${zones[2]?.min ?? "..."} bpm environ` : "Z1-Z2, allure conversation";
  return {
    label: "EF",
    zoneLabel: "aerobie",
    detail: `25 à 40 min à allure ${paceHints.easyRange ?? "facile, à la sensation"} (${cible}).`,
  };
}

function sessionEfVive(paceHints: WorkoutPaceHints): GoalPlanSession {
  return {
    label: "EF vive",
    zoneLabel: "tempo",
    detail: `20 à 30 min à allure ${
      paceHints.easyRange ?? "facile"
    }, terminée par 4 à 6 accélérations progressives de 20 à 30 s — on garde les jambes vives sans créer de fatigue.`,
  };
}

function sessionFartlek(paceHints: WorkoutPaceHints): GoalPlanSession {
  return {
    label: "Fartlek",
    zoneLabel: "tempo",
    detail: `25 à 30 min dont 6 à 8 x 1 min plus soutenu / 2 min très facile${
      paceHints.fartlekRange ? `, portions rapides à ${paceHints.fartlekRange}` : ""
    }.`,
  };
}

function sessionFractionne(paceHints: WorkoutPaceHints, dense: boolean): GoalPlanSession {
  const duree = dense
    ? "8 à 12 x 400 m (récup. 200 m trot), ou 5 à 6 x 1000 m (récup. 2-3 min)"
    : "6 à 8 x 400 m (récup. 200 m trot)";
  return {
    label: "Fractionné",
    zoneLabel: "seuil",
    detail: `${duree}${paceHints.fractionneRange ? `, répétitions à ${paceHints.fractionneRange}` : ""}.`,
  };
}

function sessionCotes(): GoalPlanSession {
  return {
    label: "Côtes",
    zoneLabel: "maximal",
    detail: "6 à 10 répétitions de côtes de 200 à 400 m, effort en Z4-Z5, retour en footing en récupération complète.",
  };
}

function buildWeekSessions(
  n: number,
  phase: GoalPlanWeek["phase"],
  hilly: boolean,
  weekKm: number,
  paceHints: WorkoutPaceHints,
  zones: ZoneBound[]
): GoalPlanSession[] {
  const sessions: GoalPlanSession[] = [];
  if (n <= 0) return sessions;
  sessions.push(sessionSortieLongue(weekKm, paceHints));
  if (n >= 2) sessions.push(sessionEF(paceHints, zones));
  if (n >= 3) {
    if (phase === "base") sessions.push(sessionFartlek(paceHints));
    else if (phase === "specifique") sessions.push(hilly ? sessionCotes() : sessionFractionne(paceHints, true));
    else sessions.push(sessionEfVive(paceHints));
  }
  if (n >= 4) sessions.push(sessionEF(paceHints, zones));
  if (n >= 5) {
    sessions.push(phase === "specifique" && hilly ? sessionFractionne(paceHints, true) : sessionEF(paceHints, zones));
  }
  if (n >= 6) sessions.push(sessionEF(paceHints, zones));
  return sessions.slice(0, n);
}

/**
 * Génère un programme semaine par semaine jusqu'à la date de l'objectif, à partir du volume
 * hebdomadaire actuel : montée progressive plafonnée, bloc spécifique (côtes ou fractionné selon
 * le terrain), affûtage sur les deux dernières semaines. Une estimation de faisabilité de
 * l'objectif de temps est ajoutée quand une performance de référence récente est disponible.
 */
export function buildGoalPlan(input: GoalPlanInput): GoalPlan | null {
  const {
    eventDate,
    distanceKm,
    elevationGainM,
    targetTimeSec,
    sessionsPerWeek,
    now,
    currentWeeklyKm,
    raceEstimateRef,
    paceHints,
    zones,
  } = input;
  if (distanceKm <= 0 || sessionsPerWeek <= 0) return null;
  const msPerWeek = 7 * MS_DAY;
  const totalWeeksRaw = (eventDate.getTime() - now.getTime()) / msPerWeek;
  if (totalWeeksRaw < 1) return null;
  const totalWeeks = Math.min(78, Math.max(1, Math.floor(totalWeeksRaw)));

  // Volume de pic avant affûtage : repère empirique courant, fonction de la distance visée.
  const peakFactor = distanceKm >= 35 ? 2.4 : distanceKm >= 18 ? 2.6 : distanceKm >= 8 ? 3.2 : 4;
  const peakWeeklyKm = Math.max(currentWeeklyKm * 1.15, distanceKm * peakFactor, 15);

  const taperWeeks = totalWeeks <= 3 ? 0 : Math.min(2, Math.max(1, Math.floor(totalWeeks * 0.12)));
  const buildWeeks = Math.max(1, totalWeeks - taperWeeks);

  const startKm = Math.max(Math.min(currentWeeklyKm, peakWeeklyKm), distanceKm * 0.6 * 0.5, 8);
  let growth = buildWeeks > 1 ? Math.pow(peakWeeklyKm / startKm, 1 / (buildWeeks - 1)) - 1 : 0;
  growth = Math.min(Math.max(growth, 0), 0.08);

  const specificStartWeek = Math.max(1, buildWeeks - Math.round(buildWeeks * 0.35));
  const hilly = elevationGainM > 0 && elevationGainM / distanceKm >= 12;

  const weeks: GoalPlanWeek[] = [];
  let km = startKm;
  for (let i = 1; i <= totalWeeks; i++) {
    const weekStartDate = new Date(now);
    weekStartDate.setDate(weekStartDate.getDate() + (i - 1) * 7);
    let phase: GoalPlanWeek["phase"];
    let weekKm: number;
    if (i > buildWeeks) {
      phase = "affutage";
      const taperIdx = i - buildWeeks;
      const frac = 1 - (taperIdx / Math.max(taperWeeks, 1)) * 0.55;
      weekKm = peakWeeklyKm * Math.max(0.4, frac);
    } else {
      phase = i >= specificStartWeek ? "specifique" : "base";
      weekKm = km;
      km *= 1 + growth;
    }
    weeks.push({
      weekIndex: i,
      startDate: weekStartDate.toISOString().slice(0, 10),
      km: Math.round(weekKm * 2) / 2,
      sessions: buildWeekSessions(sessionsPerWeek, phase, hilly, weekKm, paceHints, zones),
      phase,
    });
  }

  let feasibility: GoalFeasibility | null = null;
  if (targetTimeSec && raceEstimateRef) {
    const projectedMin = riegelProjectTime(raceEstimateRef.refDistKm, raceEstimateRef.refTimeMin, distanceKm);
    const ratio = targetTimeSec / 60 / projectedMin;
    if (ratio < 0.97) {
      feasibility = {
        verdict: "très ambitieux",
        note: `À ton niveau actuel, plutôt ${formatDuration(
          Math.round(projectedMin * 60)
        )} sur ${distanceKm} km — vise cet objectif si la préparation se passe vraiment bien, avec un plan B plus prudent.`,
      };
    } else if (ratio <= 1.03) {
      feasibility = {
        verdict: "réaliste",
        note: "Cohérent avec ta forme actuelle, dans la continuité d'une préparation sérieuse.",
      };
    } else if (ratio <= 1.15) {
      feasibility = {
        verdict: "prudent",
        note: "Cet objectif laisse une marge confortable par rapport à ton niveau actuel.",
      };
    } else {
      feasibility = {
        verdict: "très prudent",
        note: "Objectif nettement en retrait de ta forme actuelle — parfait pour viser une arrivée tranquille.",
      };
    }
  }

  return { totalWeeks, weeks, feasibility, peakWeeklyKm: Math.round(peakWeeklyKm * 2) / 2 };
}

/**
 * Meilleur temps « équivalent » sur les distances de référence, à partir des sorties dont la
 * distance en est proche (±15 %), ramené à la distance exacte par la même formule de Riegel.
 * Ce n'est pas un chrono officiel : chaque record précise sa source.
 */
function buildRecords(sorted: StravaActivity[]): RecordEntry[] {
  return STANDARD_RACE_DISTANCES.map((d) => {
    const qualifying = sorted.filter(
      (a) => a.distance >= d.km * 1000 * 0.85 && a.distance <= d.km * 1000 * 1.15 && a.moving_time > 0
    );
    if (qualifying.length === 0) {
      return {
        key: d.key,
        label: d.label,
        km: d.km,
        timeLabel: null,
        paceLabel: null,
        date: null,
        sourceLabel: null,
        isRace: false,
      };
    }
    let best: { a: StravaActivity; equivMin: number } | null = null;
    for (const a of qualifying) {
      const distKm = a.distance / 1000;
      const timeMin = a.moving_time / 60;
      const equivMin = riegelProjectTime(distKm, timeMin, d.km);
      if (!best || equivMin < best.equivMin) best = { a, equivMin };
    }
    const chosen = best!.a;
    const isExact = Math.abs(chosen.distance / 1000 - d.km) <= d.km * 0.03;
    const isRace = chosen.workout_type === 1;
    return {
      key: d.key,
      label: d.label,
      km: d.km,
      timeLabel: formatDuration(Math.round(best!.equivMin * 60)),
      paceLabel: formatPace(best!.equivMin / d.km),
      date: chosen.start_date_local.slice(0, 10),
      sourceLabel: isRace
        ? "chrono de course"
        : isExact
        ? "sortie à cette distance"
        : `estimé depuis une sortie de ${(chosen.distance / 1000).toFixed(1)} km`,
      isRace,
    };
  });
}
