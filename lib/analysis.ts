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

export interface WorkoutCard {
  n: number;
  title: string;
  zoneLabel: "aerobie" | "tempo" | "seuil" | "maximal";
  freq: string;
  duree: string;
  cible: string;
  why: string;
}

export interface Recommendations {
  phase: "reconstruction" | "maintien" | "progression";
  phaseLabel: string;
  phaseNote: string;
  rampWeeks: number[];
  fartlekFromWeek: number;
  workouts: WorkoutCard[];
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
  paceTrend: PaceTrendPoint[];
  races: RaceEntry[];
  zones: ZoneBound[];
  hasHeartRateData: boolean;
  recommendations: Recommendations;
}

const MS_DAY = 86400000;

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

  // ---- recommandations générées par règles ----
  const recommendations = buildRecommendations(compare, paceTrend, zones);

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
    paceTrend,
    races,
    zones,
    hasHeartRateData,
    recommendations,
  };
}

function buildRecommendations(
  compare: { prevKm: number; currKm: number },
  paceTrend: PaceTrendPoint[],
  zones: ZoneBound[]
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
      ? "Le volume récent est nettement en dessous de la période précédente : mieux vaut reconstruire par paliers plutôt que revenir directement au rythme d'avant."
      : phase === "progression"
      ? "Le volume est déjà en hausse : la progression proposée reste mesurée pour ne pas accumuler la fatigue trop vite."
      : "Le volume est stable : une progression douce suffit pour continuer à avancer sans se blesser.";

  const growth = phase === "reconstruction" ? 0.1 : phase === "progression" ? 0.05 : 0.07;
  const start = Math.max(currWeekly, 6);
  const rampWeeks: number[] = [];
  let w = start;
  for (let i = 0; i < 8; i++) {
    rampWeeks.push(Math.round(w * 2) / 2);
    w *= 1 + growth;
  }
  const fartlekFromWeek = phase === "reconstruction" ? 3 : 1;

  // Allures grossièrement calées sur les zones réelles, si suffisamment de points.
  const zoneHint = zones.length >= 4 && paceTrend.length >= 4;

  const workouts: WorkoutCard[] = [
    {
      n: 1,
      title: "Sortie fondamentale",
      zoneLabel: "aerobie",
      freq: "2 à 3 fois / semaine",
      duree: "25 à 40 min, aucune contrainte d'allure",
      cible: zoneHint
        ? `Z1-Z2 (FC < ${zones[2]?.min ?? "..."} bpm environ)`
        : "Z1-Z2 : allure conversation, sans forcer",
      why: "Le socle de toute reprise ou progression : construire le volume aérobie sans stress supplémentaire.",
    },
    {
      n: 2,
      title: "Fartlek",
      zoneLabel: "seuil",
      freq: `1 fois / semaine${phase === "reconstruction" ? ", à partir de la semaine 3-4" : ""}`,
      duree: "25 à 30 min dont 6 à 8 x 1 min plus soutenu / 2 min très facile",
      cible: "Portions rapides en Z3-Z4, à la sensation plutôt qu'au chrono",
      why: "Un format simple pour réintroduire du rythme sans le choc d'un fractionné classique.",
    },
    {
      n: 3,
      title: "Sortie longue progressive",
      zoneLabel: "aerobie",
      freq: "1 fois / semaine, la plus longue",
      duree: "part de ta distance actuelle, +1 km environ toutes les 1 à 2 semaines",
      cible: "Z1-Z2 strict, aucune pression d'allure",
      why: "Le levier n°1 pour bâtir un plancher aérobie avant tout travail de dénivelé ou de vitesse.",
    },
    {
      n: 4,
      title: "Côtes / dénivelé",
      zoneLabel: "maximal",
      freq: "1 fois / semaine dans le bloc spécifique avant un objectif",
      duree: "6 à 10 répétitions de côtes de 200 à 400 m, retour en footing",
      cible: "Montée en Z4-Z5, récupération complète en descente",
      why: "Prépare spécifiquement le dénivelé si un objectif trail ou une course vallonnée approche.",
    },
  ];

  return { phase, phaseLabel, phaseNote, rampWeeks, fartlekFromWeek, workouts };
}
