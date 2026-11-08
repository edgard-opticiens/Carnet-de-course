import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ensureFreshToken, fetchAthleteZones, fetchRunningActivities } from "@/lib/strava";
import { buildInsights, WINDOW_DAYS } from "@/lib/insights";
import { loadDigests } from "@/lib/digestCache";

// Lit une session par cookie et interroge Strava en direct : jamais de cache CDN/navigateur.
export const dynamic = "force-dynamic";
// Le premier chargement lit une trentaine de sorties une par une ; les suivants passent par le cache.
export const maxDuration = 30;

/** On ne détaille que les sorties les plus récentes pour rester loin de la limite Strava. */
const MAX_DETAILED_RUNS = 45;

export async function GET() {
  const session = await getSession();
  if (!session.accessToken || !session.refreshToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let accessToken: string;
  try {
    const result = await ensureFreshToken(session);
    accessToken = result.accessToken;
    if (result.refreshed) {
      session.accessToken = result.refreshed.access_token;
      session.refreshToken = result.refreshed.refresh_token;
      session.expiresAt = result.refreshed.expires_at;
      await session.save();
    }
  } catch {
    session.destroy();
    return NextResponse.json({ error: "session_expired" }, { status: 401 });
  }

  try {
    const after = Math.floor((Date.now() - (WINDOW_DAYS + 2) * 86400000) / 1000);
    const [runs, zonesRaw] = await Promise.all([
      fetchRunningActivities(accessToken, after),
      fetchAthleteZones(accessToken).catch(() => null),
    ]);

    const newestFirst = [...runs]
      .filter((a) => a.distance >= 1000)
      .sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))
      .slice(0, MAX_DETAILED_RUNS);

    const { digests, rateLimited } = await loadDigests(accessToken, newestFirst);

    const hr = zonesRaw?.heart_rate;
    const zones = hr?.zones?.length
      ? hr.zones.map((z) => ({ min: z.min, max: z.max === -1 ? null : z.max }))
      : null;

    const data = buildInsights({
      runs: newestFirst,
      digests,
      zones,
      zonesCustom: hr ? hr.custom_zones : null,
      now: new Date(),
      rateLimited,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    const message = e?.message ?? "Erreur inconnue lors du calcul des analyses.";
    return NextResponse.json(
      { error: "strava_error", message },
      { status: message.includes("rate limit") ? 429 : 502 }
    );
  }
}
