import { AthleteZones, StravaActivity } from "./strava";

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
}

export interface Recommendations {
  phase: "reconstruction" | "maintien" | "progression";
  phaseLabel: string;
  phaseNote: string;
  workouts: WorkoutCard[];
}

export type WorkoutTypeLabel = "sortie" | "course" | "sortie longue" | "séance";

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
  now: Date = new Date()
): DashboardData {
  const sorted = [...activities].sort(
    (a, b) => new Date(a.start_date_local).getTime() - new Date(b.start_date_local).getTime()
  );

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
  const recommendations = buildRecommendations(compare, zones, paceByZone, avgElevPerKmRecent);

  // ---- compte rendu de la toute dernière sortie ----
  const lastRun = buildLastRunReview(sorted, zones, recommendations);

  // ---- estimations de temps de course et records ----
  const raceEstimates = buildRaceEstimates(sorted, now);
  const records = buildRecords(sorted);

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
  recommendations: Recommendations
): LastRunReview | null {
  if (sorted.length === 0) return null;
  const last = sorted[sorted.length - 1];
  const prevRuns = sorted.slice(0, -1);
  const lastDistKm = last.distance / 1000;
  const lastPace = paceFromSpeed(last.average_speed);
  const typeLabel = workoutTypeLabel(last.workout_type);
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

  if (avgBaselinePace !== null && avgBaselinePace > 0) {
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

  if (typicalDistanceKm !== null) {
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

function buildRecommendations(
  compare: { prevKm: number; currKm: number },
  zones: ZoneBound[],
  paceByZone: Map<number, number[]>,
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
  const easyRange = bestPaceRange(paceByZone, [1, 2], [1, 2]);
  const fartlekRange = bestPaceRange(paceByZone, [3], [3, 4]);
  const fractionneRange = bestPaceRange(paceByZone, [4], [3, 4]);

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

/**
 * Estime les temps sur 5, 10, semi et marathon à partir de la meilleure performance récente
 * (formule de Riegel), avec une prudence explicite sur le marathon quand aucune sortie longue
 * ne vient étayer l'extrapolation.
 */
function buildRaceEstimates(sorted: StravaActivity[], now: Date): RaceEstimates | null {
  const cutoff = now.getTime() - 120 * MS_DAY;
  const candidates = sorted.filter(
    (a) => a.distance >= 3000 && a.moving_time > 0 && new Date(a.start_date_local).getTime() >= cutoff
  );
  if (candidates.length === 0) return null;

  let best: { a: StravaActivity; predicted10k: number } | null = null;
  for (const a of candidates) {
    const distKm = a.distance / 1000;
    const timeMin = a.moving_time / 60;
    const predicted10k = riegelProjectTime(distKm, timeMin, 10);
    if (!best || predicted10k < best.predicted10k) best = { a, predicted10k };
  }
  if (!best) return null;

  const refDistKm = best.a.distance / 1000;
  const refTimeMin = best.a.moving_time / 60;
  const refDate = best.a.start_date_local.slice(0, 10);
  const refPace = refTimeMin / refDistKm;
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

  return {
    estimates,
    basisLabel: `Basé sur ta sortie du ${new Date(refDate).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
    })} (${refDistKm.toFixed(1)} km à ${formatPace(refPace)}).`,
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
}

export interface GoalPlanWeek {
  weekIndex: number;
  startDate: string;
  km: number;
  sessions: string[];
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

function buildWeekSessions(n: number, phase: GoalPlanWeek["phase"], hilly: boolean): string[] {
  const sessions: string[] = [];
  if (n <= 0) return sessions;
  sessions.push("Sortie longue");
  if (n >= 2) sessions.push("EF");
  if (n >= 3) {
    if (phase === "base") sessions.push("Fartlek");
    else if (phase === "specifique") sessions.push(hilly ? "Côtes" : "Fractionné");
    else sessions.push("EF vive");
  }
  if (n >= 4) sessions.push("EF");
  if (n >= 5) sessions.push(phase === "specifique" && hilly ? "Fractionné" : "EF");
  if (n >= 6) sessions.push("EF");
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
      sessions: buildWeekSessions(sessionsPerWeek, phase, hilly),
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
