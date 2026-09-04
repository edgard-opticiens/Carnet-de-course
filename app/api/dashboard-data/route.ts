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

  try {
    // On récupère tout l'historique en un seul passage (borné à 2000 activités par le
    // garde-fou de fetchRunningActivities) : les records doivent pouvoir remonter à un
    // marathon ou un 10 km couru il y a plusieurs années, pas seulement aux 18 derniers mois
    // utilisés pour le reste du tableau de bord (tendances, volume, phase de forme). On dérive
    // ensuite la fenêtre récente par un simple filtre, plutôt que de refaire un appel Strava.
    const [allActivities, zones] = await Promise.all([
      fetchRunningActivities(accessToken, 0),
      fetchAthleteZones(accessToken).catch(() => null),
    ]);

    if (allActivities.length === 0) {
      return NextResponse.json({ error: "no_activities" }, { status: 200 });
    }

    const recentCutoff = new Date();
    recentCutoff.setMonth(recentCutoff.getMonth() - MONTHS_BACK);
    const recentCutoffMs = recentCutoff.getTime();
    const recentActivities = allActivities.filter(
      (a) => new Date(a.start_date_local).getTime() >= recentCutoffMs
    );
    // Si l'athlète n'a rien couru depuis plus de MONTHS_BACK mois, on affiche quand même le
    // tableau de bord (records compris) à partir de ses sorties les plus récentes plutôt que
    // d'afficher un écran vide.
    const activitiesForDashboard = recentActivities.length > 0 ? recentActivities : allActivities.slice(-30);

    const data = buildDashboardData(
      activitiesForDashboard,
      zones,
      session.athleteName ?? "Athlète",
      new Date(),
      allActivities
    );
    return NextResponse.json({ data });
  } catch (e: any) {
    const message = e?.message ?? "Erreur inconnue lors de la récupération des données Strava.";
    const status = message.includes("rate limit") ? 429 : 502;
    return NextResponse.json({ error: "strava_error", message }, { status });
  }
}
