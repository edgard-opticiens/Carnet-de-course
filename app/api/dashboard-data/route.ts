import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ensureFreshToken, fetchAthleteZones, fetchRunningActivities } from "@/lib/strava";
import { buildDashboardData } from "@/lib/analysis";

// Toujours ré-exécuter côté serveur : cette route lit une session par cookie et interroge
// Strava en direct, elle ne doit jamais être servie depuis un cache (CDN ou navigateur).
export const dynamic = "force-dynamic";

const MONTHS_BACK = 18;

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
  } catch (e) {
    session.destroy();
    return NextResponse.json({ error: "session_expired" }, { status: 401 });
  }

  const after = new Date();
  after.setMonth(after.getMonth() - MONTHS_BACK);
  const afterUnix = Math.floor(after.getTime() / 1000);

  try {
    const [activities, zones] = await Promise.all([
      fetchRunningActivities(accessToken, afterUnix),
      fetchAthleteZones(accessToken).catch(() => null),
    ]);

    if (activities.length === 0) {
      return NextResponse.json({ error: "no_activities" }, { status: 200 });
    }

    const data = buildDashboardData(activities, zones, session.athleteName ?? "Athlète");
    return NextResponse.json({ data });
  } catch (e: any) {
    const message = e?.message ?? "Erreur inconnue lors de la récupération des données Strava.";
    const status = message.includes("rate limit") ? 429 : 502;
    return NextResponse.json({ error: "strava_error", message }, { status });
  }
}
