/**
 * Analyses « profondes » des données Strava.
 *
 * Contrairement à lib/analysis.ts (qui raisonne sur des moyennes par sortie), ce module travaille
 * kilomètre par kilomètre et sur les meilleurs efforts calculés par Strava À L'INTÉRIEUR des
 * sorties : c'est ce qui permet de voir un km rapide ou un 5 km perdu au milieu d'une sortie
 * longue, même si l'allure moyenne de la sortie était tranquille.
 *
 * Tout est déterministe (aucune IA, aucun appel externe) et chaque chiffre affiché peut être
 * retracé jusqu'à une sortie Strava précise.
 */
import type { StravaActivity, StravaActivityDetail } from "./strava";

const MS_DAY = 86400000;

export const WINDOW_DAYS = 91; // fenêtre d'analyse détaillée (13 semaines)
export const RECENT_DAYS = 42; // « récent » vs « avant » pour les comparaisons
/** Un km est « rapide » s'il est au moins ce nombre de secondes/km sous l'allure habituelle. */
export const FAST_GAP_SEC = 20;

// ---------------------------------------------------------------------------------------------
// Données élémentaires (ce qu'on garde en cache pour chaque sortie)
// ---------------------------------------------------------------------------------------------

export interface KmSplit {
  distM: number;
  sec: number;
  hr: number | null;
  elev: number | null;
}

export type BestKey = "1k" | "1mile" | "5k" | "10k" | "15k";

export interface ActivityDigest {
  id: number;
  km: KmSplit[];
  bests: Partial<Record<BestKey, number>>; // secondes
}

const BEST_NAME_TO_KEY: Record<string, BestKey> = {
  "1k": "1k",
  "1 mile": "1mile",
  "5k": "5k",
  "10k": "10k",
  "15k": "15k",
};

export function digestFromDetail(d: StravaActivityDetail): ActivityDigest {
  const km: KmSplit[] = (d.splits_metric ?? [])
    .filter((s) => s.distance > 0 && s.moving_time > 0)
    .map((s) => ({
      distM: s.distance,
      sec: s.moving_time,
      hr: typeof s.average_heartrate === "number" && s.average_heartrate > 0 ? s.average_heartrate : null,
      elev: typeof s.elevation_difference === "number" ? s.elevation_difference : null,
    }));
  const bests: Partial<Record<BestKey, number>> = {};
  for (const b of d.best_efforts ?? []) {
    const key = BEST_NAME_TO_KEY[b.name.trim().toLowerCase()];
    if (key && b.elapsed_time > 0) bests[key] = b.elapsed_time;
  }
  return { id: d.id, km, bests };
}

const isFullKm = (s: KmSplit) => s.distM >= 950 && s.distM <= 1050;

// ---------------------------------------------------------------------------------------------
// Types de sortie
// ---------------------------------------------------------------------------------------------

export type RunKind = "libre" | "séance" | "course";
export type RunContext = "libre" | "poussette" | "canicross";

const PLANNED_RE = /fraction|séance|seance|tempo|fartlek|\bvma\b|côte|cote|interval|seuil|\b\d+\s*[x×*]\s*\d+/i;

export function runKind(a: StravaActivity): RunKind {
  if (a.workout_type === 1) return "course";
  if (a.workout_type === 3 || PLANNED_RE.test(a.name)) return "séance";
  return "libre";
}

/** Contexte déduit du TITRE de la sortie (poussette = plus lent, canicross = tracté = plus rapide). */
export function runContext(a: StravaActivity): RunContext {
  if (/canicross/i.test(a.name)) return "canicross";
  if (/poussette|stroller/i.test(a.name)) return "poussette";
  return "libre";
}

// ---------------------------------------------------------------------------------------------
// Sorties
// ---------------------------------------------------------------------------------------------

export interface FastKmRun {
  activityId: number;
  date: string;
  name: string;
  context: RunContext;
  runKm: number;
  fastKmCount: number;
  bestPaceSec: number;
  avgFastPaceSec: number;
  avgPaceSec: number;
  bestKmHr: number | null;
}

export interface FastKmInsight {
  typicalPaceSec: number | null;
  thresholdSec: number | null;
  gapSec: number;
  runsAnalysed: number;
  freeRuns: number;
  freeRunsWithFast: number;
  freeFastKm: number;
  plannedFastKm: number; // km rapides dans les séances / courses
  runs: FastKmRun[]; // sorties libres contenant au moins un km rapide, récentes d'abord
  weekly: { weekStart: string; free: number; planned: number }[];
}

export interface ContextRow {
  context: RunContext;
  runs: number;
  km: number;
  medianPaceSec: number | null;
  fastKmShare: number | null; // 0..1
}

export interface BestEffortRow {
  key: BestKey;
  label: string;
  distKm: number;
  best: { sec: number; date: string; name: string; runKm: number; buried: boolean; context: RunContext } | null;
  recentSec: number | null;
  prevSec: number | null;
  deltaSec: number | null; // négatif = progression
}

export interface IntensityInsight {
  shares: number[]; // part du temps par zone FC (zone 1..n)
  easyShare: number; // zones 1-2
  grayShare: number; // zone 3
  hardShare: number; // zones 4-5
  zonesEstimated: boolean | null; // true si zones calculées par Strava à partir de l'âge
  hrCoverage: number; // part des km avec FC
  windowDays: number;
}

export interface LoadInsight {
  unit: "effort" | "min";
  weekly: { weekStart: string; load: number; km: number }[];
  acute: number;
  chronicWeekly: number;
  ratio: number | null;
  status: "sous" | "stable" | "montee" | "forte_montee" | null;
  daysSinceLast: number | null;
}

export interface PacingInsight {
  runsAnalysed: number;
  negative: number;
  even: number;
  positive: number;
  medianSplitDeltaPct: number | null; // >0 = 2e moitié plus lente
  decouplingRuns: number;
  medianDecouplingPct: number | null; // >0 = FC qui dérive pour une même vitesse
}

export interface Headline {
  tone: "good" | "warn" | "info";
  title: string;
  text: string;
}

export interface Insights {
  coverage: {
    windowDays: number;
    runsInWindow: number;
    runsAnalysed: number;
    rateLimited: boolean;
  };
  headlines: Headline[];
  fastKm: FastKmInsight;
  byContext: ContextRow[];
  bestEfforts: BestEffortRow[];
  intensity: IntensityInsight | null;
  load: LoadInsight;
  pacing: PacingInsight;
}

// ---------------------------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------------------------

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function weekStartOf(d: Date): Date {
  const c = new Date(d);
  const day = (c.getDay() + 6) % 7;
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - day);
  return c;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Les dates Strava « locales » sont du texte ISO sans fuseau : on les lit comme heure locale. */
function localTime(a: StravaActivity): number {
  return new Date(a.start_date_local.replace("Z", "")).getTime();
}

export function fmtPaceSec(sec: number): string {
  const total = Math.round(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function fmtDurationSec(sec: number): string {
  const t = Math.round(sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** Écart de temps lisible : « 28 s » sous la minute, « 1:12 » au-delà. */
export function fmtDeltaSec(sec: number): string {
  const t = Math.round(Math.abs(sec));
  return t < 60 ? `${t} s` : fmtDurationSec(t);
}

const fr1 = (n: number) => String(n).replace(".", ",");

function fmtDateFr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

const BEST_DEFS: { key: BestKey; label: string; km: number }[] = [
  { key: "1k", label: "1 km", km: 1 },
  { key: "1mile", label: "1 mile", km: 1.609344 },
  { key: "5k", label: "5 km", km: 5 },
  { key: "10k", label: "10 km", km: 10 },
  { key: "15k", label: "15 km", km: 15 },
];

function zoneIndex(hr: number, zones: { min: number; max: number | null }[]): number {
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (hr >= z.min && (z.max === null || hr <= z.max)) return i;
  }
  return hr < zones[0].min ? 0 : zones.length - 1;
}

// ---------------------------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------------------------

export interface InsightsInput {
  runs: StravaActivity[]; // sorties de course de la fenêtre, tri indifférent
  digests: Map<number, ActivityDigest>;
  zones: { min: number; max: number | null }[] | null;
  zonesCustom: boolean | null;
  now: Date;
  rateLimited: boolean;
}

export function buildInsights(input: InsightsInput): Insights {
  const { digests, zones, zonesCustom, now, rateLimited } = input;
  const nowMs = now.getTime();
  const windowStart = nowMs - WINDOW_DAYS * MS_DAY;
  const recentStart = nowMs - RECENT_DAYS * MS_DAY;

  const runs = input.runs
    .filter((a) => localTime(a) >= windowStart && a.distance >= 1000)
    .sort((a, b) => localTime(a) - localTime(b));
  const analysed = runs.filter((a) => digests.has(a.id) && digests.get(a.id)!.km.length > 0);

  // --- allure habituelle = médiane de tous les km complets analysés -------------------------
  const allKmPaces: number[] = [];
  for (const a of analysed) for (const s of digests.get(a.id)!.km) if (isFullKm(s)) allKmPaces.push(s.sec / (s.distM / 1000));
  const typical = median(allKmPaces);
  const threshold = typical !== null ? typical - FAST_GAP_SEC : null;

  // --- km rapides ---------------------------------------------------------------------------
  const fastRuns: FastKmRun[] = [];
  let freeRuns = 0;
  let freeFastKm = 0;
  let plannedFastKm = 0;
  const weeklyMap = new Map<string, { free: number; planned: number }>();
  for (let i = 12; i >= 0; i--) {
    const ws = weekStartOf(new Date(nowMs - i * 7 * MS_DAY));
    weeklyMap.set(isoDay(ws), { free: 0, planned: 0 });
  }

  for (const a of analysed) {
    const kind = runKind(a);
    const full = digests.get(a.id)!.km.filter(isFullKm);
    if (kind === "libre") freeRuns++;
    if (threshold === null || full.length === 0) continue;
    const fast = full.filter((s) => s.sec / (s.distM / 1000) <= threshold);
    if (fast.length === 0) continue;
    const wk = weeklyMap.get(isoDay(weekStartOf(new Date(localTime(a)))));
    if (kind === "libre") {
      freeFastKm += fast.length;
      if (wk) wk.free += fast.length;
      const paces = fast.map((s) => s.sec / (s.distM / 1000));
      const bestIdx = paces.indexOf(Math.min(...paces));
      fastRuns.push({
        activityId: a.id,
        date: a.start_date_local.slice(0, 10),
        name: a.name,
        context: runContext(a),
        runKm: Math.round((a.distance / 1000) * 10) / 10,
        fastKmCount: fast.length,
        bestPaceSec: paces[bestIdx],
        avgFastPaceSec: paces.reduce((x, y) => x + y, 0) / paces.length,
        avgPaceSec: a.moving_time / (a.distance / 1000),
        bestKmHr: fast[bestIdx].hr,
      });
    } else {
      plannedFastKm += fast.length;
      if (wk) wk.planned += fast.length;
    }
  }
  fastRuns.sort((a, b) => b.date.localeCompare(a.date));

  const fastKm: FastKmInsight = {
    typicalPaceSec: typical,
    thresholdSec: threshold,
    gapSec: FAST_GAP_SEC,
    runsAnalysed: analysed.length,
    freeRuns,
    freeRunsWithFast: fastRuns.length,
    freeFastKm,
    plannedFastKm,
    runs: fastRuns.slice(0, 10),
    weekly: [...weeklyMap.entries()].map(([weekStart, v]) => ({ weekStart, ...v })),
  };

  // --- par contexte (libre / poussette / canicross) -----------------------------------------
  const byContext: ContextRow[] = (["libre", "poussette", "canicross"] as RunContext[])
    .map((context) => {
      const rs = analysed.filter((a) => runContext(a) === context);
      const paces: number[] = [];
      let fastCount = 0;
      for (const a of rs)
        for (const s of digests.get(a.id)!.km.filter(isFullKm)) {
          const p = s.sec / (s.distM / 1000);
          paces.push(p);
          if (threshold !== null && p <= threshold) fastCount++;
        }
      return {
        context,
        runs: rs.length,
        km: Math.round(rs.reduce((x, a) => x + a.distance / 1000, 0)),
        medianPaceSec: median(paces),
        fastKmShare: paces.length > 0 ? fastCount / paces.length : null,
      };
    })
    .filter((r) => r.runs > 0);

  // --- vrais meilleurs efforts --------------------------------------------------------------
  const bestEfforts: BestEffortRow[] = BEST_DEFS.map((def) => {
    let best: BestEffortRow["best"] = null;
    let recentSec: number | null = null;
    let prevSec: number | null = null;
    for (const a of analysed) {
      const sec = digests.get(a.id)!.bests[def.key];
      if (sec === undefined) continue;
      const t = localTime(a);
      const runKm = Math.round((a.distance / 1000) * 10) / 10;
      if (!best || sec < best.sec) {
        best = {
          sec,
          date: a.start_date_local.slice(0, 10),
          name: a.name,
          runKm,
          buried: a.distance / 1000 > def.km * 1.5,
          context: runContext(a),
        };
      }
      if (t >= recentStart) recentSec = recentSec === null ? sec : Math.min(recentSec, sec);
      else prevSec = prevSec === null ? sec : Math.min(prevSec, sec);
    }
    return {
      key: def.key,
      label: def.label,
      distKm: def.km,
      best,
      recentSec,
      prevSec,
      deltaSec: recentSec !== null && prevSec !== null ? recentSec - prevSec : null,
    };
  });

  // --- intensité (FC) sur la période récente ------------------------------------------------
  let intensity: IntensityInsight | null = null;
  if (zones && zones.length >= 4) {
    const secByZone = new Array(zones.length).fill(0);
    let totalSec = 0;
    let hrSec = 0;
    for (const a of analysed) {
      if (localTime(a) < recentStart) continue;
      for (const s of digests.get(a.id)!.km) {
        totalSec += s.sec;
        if (s.hr !== null) {
          secByZone[zoneIndex(s.hr, zones)] += s.sec;
          hrSec += s.sec;
        }
      }
    }
    if (hrSec > 0) {
      const shares = secByZone.map((v) => v / hrSec);
      intensity = {
        shares,
        easyShare: shares[0] + shares[1],
        grayShare: shares[2],
        hardShare: shares.slice(3).reduce((x, y) => x + y, 0),
        zonesEstimated: zonesCustom === null ? null : !zonesCustom,
        hrCoverage: totalSec > 0 ? hrSec / totalSec : 0,
        windowDays: RECENT_DAYS,
      };
    }
  }

  // --- charge d'entraînement ----------------------------------------------------------------
  const withEffort = runs.filter((a) => typeof a.suffer_score === "number" && a.suffer_score! > 0).length;
  const useEffort = runs.length > 0 && withEffort / runs.length >= 0.8;
  const loadOf = (a: StravaActivity) => (useEffort ? a.suffer_score ?? 0 : a.moving_time / 60);
  const weeklyLoad = new Map<string, { load: number; km: number }>();
  for (let i = 12; i >= 0; i--) weeklyLoad.set(isoDay(weekStartOf(new Date(nowMs - i * 7 * MS_DAY))), { load: 0, km: 0 });
  let acute = 0;
  let load28 = 0;
  for (const a of runs) {
    const t = localTime(a);
    const w = weeklyLoad.get(isoDay(weekStartOf(new Date(t))));
    if (w) {
      w.load += loadOf(a);
      w.km += a.distance / 1000;
    }
    if (t >= nowMs - 7 * MS_DAY) acute += loadOf(a);
    if (t >= nowMs - 28 * MS_DAY) load28 += loadOf(a);
  }
  const chronicWeekly = load28 / 4;
  const ratio = chronicWeekly > 0 ? acute / chronicWeekly : null;
  const lastRun = runs.length > 0 ? runs[runs.length - 1] : null;
  const load: LoadInsight = {
    unit: useEffort ? "effort" : "min",
    weekly: [...weeklyLoad.entries()].map(([weekStart, v]) => ({
      weekStart,
      load: Math.round(v.load),
      km: Math.round(v.km * 10) / 10,
    })),
    acute: Math.round(acute),
    chronicWeekly: Math.round(chronicWeekly),
    ratio: ratio !== null ? Math.round(ratio * 100) / 100 : null,
    status:
      ratio === null ? null : ratio < 0.8 ? "sous" : ratio <= 1.3 ? "stable" : ratio <= 1.5 ? "montee" : "forte_montee",
    daysSinceLast: lastRun ? Math.floor((nowMs - localTime(lastRun)) / MS_DAY) : null,
  };

  // --- régularité & dérive cardiaque --------------------------------------------------------
  let negative = 0;
  let even = 0;
  let positive = 0;
  const deltas: number[] = [];
  const decouplings: number[] = [];
  let pacingRuns = 0;
  for (const a of analysed) {
    if (runKind(a) !== "libre") continue; // une séance fractionnée n'a pas de « profil d'allure » à juger
    const full = digests.get(a.id)!.km.filter(isFullKm);
    if (full.length < 8) continue;
    pacingRuns++;
    const h = Math.floor(full.length / 2);
    const first = full.slice(0, h);
    const second = full.slice(full.length - h);
    const pace = (arr: KmSplit[]) => arr.reduce((x, s) => x + s.sec, 0) / arr.reduce((x, s) => x + s.distM / 1000, 0);
    const p1 = pace(first);
    const p2 = pace(second);
    const delta = ((p2 - p1) / p1) * 100;
    deltas.push(delta);
    if (delta <= -2) negative++;
    else if (delta >= 2) positive++;
    else even++;
    if (full.every((s) => s.hr !== null)) {
      const ef = (arr: KmSplit[]) => {
        const speed = arr.reduce((x, s) => x + s.distM, 0) / arr.reduce((x, s) => x + s.sec, 0);
        const hr = arr.reduce((x, s) => x + s.hr! * s.sec, 0) / arr.reduce((x, s) => x + s.sec, 0);
        return speed / hr;
      };
      const e1 = ef(first);
      const e2 = ef(second);
      decouplings.push(((e1 - e2) / e1) * 100);
    }
  }
  const pacing: PacingInsight = {
    runsAnalysed: pacingRuns,
    negative,
    even,
    positive,
    medianSplitDeltaPct: median(deltas) !== null ? Math.round(median(deltas)! * 10) / 10 : null,
    decouplingRuns: decouplings.length,
    medianDecouplingPct: median(decouplings) !== null ? Math.round(median(decouplings)! * 10) / 10 : null,
  };

  const insights: Insights = {
    coverage: {
      windowDays: WINDOW_DAYS,
      runsInWindow: runs.length,
      runsAnalysed: analysed.length,
      rateLimited,
    },
    headlines: [],
    fastKm,
    byContext,
    bestEfforts,
    intensity,
    load,
    pacing,
  };
  insights.headlines = buildHeadlines(insights);
  return insights;
}

// ---------------------------------------------------------------------------------------------
// Constats en clair (tous chiffrés, tous issus des calculs ci-dessus)
// ---------------------------------------------------------------------------------------------

function buildHeadlines(ins: Insights): Headline[] {
  const out: Headline[] = [];
  const { fastKm, bestEfforts, load, intensity, pacing } = ins;

  // 1. Km rapides hors séance — le point soulevé par l'utilisateur
  if (fastKm.typicalPaceSec !== null && fastKm.freeRuns > 0) {
    if (fastKm.freeRunsWithFast > 0) {
      const fastest = [...fastKm.runs].sort((a, b) => a.bestPaceSec - b.bestPaceSec)[0];
      const canicross = fastKm.runs.filter((r) => r.context === "canicross").length;
      out.push({
        tone: "info",
        title: "Des km rapides, sans séance prévue",
        text:
          `${fastKm.freeRunsWithFast} sortie${fastKm.freeRunsWithFast > 1 ? "s" : ""} libre${fastKm.freeRunsWithFast > 1 ? "s" : ""} sur ${fastKm.freeRuns} ` +
          `contiennent des km plus rapides que ${fmtPaceSec(fastKm.thresholdSec!)}/km ` +
          `(${fastKm.gapSec} s sous ton allure habituelle de ${fmtPaceSec(fastKm.typicalPaceSec)}/km), ` +
          `soit ${fastKm.freeFastKm} km au total. Le plus rapide : ${fmtPaceSec(fastest.bestPaceSec)}/km ` +
          `le ${fmtDateFr(fastest.date)} (« ${fastest.name} »).` +
          (canicross > 0
            ? ` ${canicross === 1 ? "Une de ces sorties est un canicross" : `${canicross} de ces sorties sont des canicross`} (tracté par le chien).`
            : ""),
      });
    } else {
      out.push({
        tone: "info",
        title: "Pas de km rapide hors séance",
        text: `Sur ${fastKm.freeRuns} sorties libres, aucun km n'est passé sous ${fmtPaceSec(fastKm.thresholdSec!)}/km (allure habituelle ${fmtPaceSec(fastKm.typicalPaceSec)}/km).`,
      });
    }
  }

  // 2. Meilleurs efforts cachés dans des sorties longues, et leur évolution
  const buried = bestEfforts.filter((b) => b.best?.buried && b.key !== "1k" && b.key !== "1mile");
  const picked = buried.sort((a, b) => b.distKm - a.distKm)[0] ?? buried[0];
  if (picked && picked.best) {
    const b = picked.best;
    let evo = "";
    const weeksBefore = Math.round((WINDOW_DAYS - RECENT_DAYS) / 7);
    if (picked.deltaSec !== null && Math.abs(picked.deltaSec) >= 3) {
      evo =
        picked.deltaSec < 0
          ? ` C'est ${fmtDeltaSec(picked.deltaSec)} de mieux que sur les ${weeksBefore} semaines d'avant.`
          : ` C'est ${fmtDeltaSec(picked.deltaSec)} de moins bien que sur les ${weeksBefore} semaines d'avant.`;
    }
    const ctx =
      b.context === "canicross"
        ? " Cette sortie était en canicross : l'allure est aidée par le chien."
        : b.context === "poussette"
        ? " Cette sortie était avec la poussette."
        : "";
    out.push({
      tone: picked.deltaSec !== null && picked.deltaSec < -3 ? "good" : "info",
      title: `Ton meilleur ${picked.label} est caché dans une sortie plus longue`,
      text:
        `${fmtDurationSec(b.sec)} sur ${picked.label} (${fmtPaceSec(b.sec / picked.distKm)}/km), couru le ${fmtDateFr(b.date)} ` +
        `au sein d'une sortie de ${fr1(b.runKm)} km (« ${b.name} »). L'allure moyenne de cette sortie ne le montre pas.` +
        evo +
        ctx,
    });
  }

  // 3. Charge
  if (load.ratio !== null && load.status) {
    const txt: Record<NonNullable<LoadInsight["status"]>, [Headline["tone"], string]> = {
      sous: ["info", "en dessous de ton rythme des 4 dernières semaines"],
      stable: ["good", "dans ta zone habituelle"],
      montee: ["warn", "en montée rapide par rapport à tes 4 dernières semaines"],
      forte_montee: ["warn", "en très forte montée par rapport à tes 4 dernières semaines"],
    };
    const [tone, label] = txt[load.status];
    out.push({
      tone,
      title: "Charge des 7 derniers jours",
      text:
        `${load.acute} ${load.unit === "effort" ? "points d'effort Strava" : "min de course"} sur 7 jours contre ${load.chronicWeekly} ` +
        `en moyenne par semaine sur 28 jours (ratio ${String(load.ratio).replace(".", ",")}) : ${label}. ` +
        `Repères usuels : 0,8 à 1,3 = stable, au-delà de 1,5 = montée très rapide (indicatif, pas un seuil médical).`,
    });
  }

  // 4. Intensité
  if (intensity) {
    const pct = (v: number) => Math.round(v * 100);
    const caveat = intensity.zonesEstimated
      ? " Tes zones FC sont estimées par Strava à partir de ton âge ; recale-les dans Strava pour une lecture plus fiable."
      : "";
    if (intensity.grayShare >= 0.4) {
      out.push({
        tone: "warn",
        title: "Beaucoup de temps en zone 3",
        text: `${pct(intensity.grayShare)} % de ton temps de course (${intensity.windowDays} derniers jours) est en zone 3, ${pct(intensity.easyShare)} % en zones 1-2 et ${pct(intensity.hardShare)} % en zones 4-5. Repère courant : l'essentiel des sorties d'endurance se court en zones 1-2, avec quelques séances vraiment dures ; la zone 3, entre les deux, est souvent considérée comme la moins rentable.${caveat}`,
      });
    } else {
      out.push({
        tone: "info",
        title: "Répartition de l'intensité",
        text: `${pct(intensity.easyShare)} % de ton temps en zones 1-2, ${pct(intensity.grayShare)} % en zone 3, ${pct(intensity.hardShare)} % en zones 4-5 sur les ${intensity.windowDays} derniers jours.${caveat}`,
      });
    }
  }

  // 5. Régularité & dérive
  if (pacing.runsAnalysed >= 3) {
    const parts = [
      `Sur ${pacing.runsAnalysed} sorties libres d'au moins 8 km (hors séances) : ${pacing.negative} en accélérant (seconde moitié plus rapide d'au moins 2 %), ${pacing.even} à allure régulière, ${pacing.positive} en ralentissant (seconde moitié plus lente d'au moins 2 %).`,
    ];
    if (pacing.medianDecouplingPct !== null)
      parts.push(
        `Dérive cardiaque médiane : ${String(pacing.medianDecouplingPct).replace(".", ",")} % ` +
          (pacing.medianDecouplingPct > 5
            ? "(au-dessus de 5 %, ton cœur travaille plus en fin de sortie pour la même vitesse)."
            : "(sous 5 %, bon signe d'endurance de base).")
      );
    out.push({ tone: pacing.positive > pacing.negative + pacing.even ? "warn" : "info", title: "Gestion de l'allure", text: parts.join(" ") });
  }

  return out;
}
