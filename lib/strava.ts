import { SessionData } from "./session";

const STRAVA_OAUTH_BASE = "https://www.strava.com/oauth";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

export const STRAVA_SCOPES = "read,activity:read_all,profile:read_all";

export function getAuthorizeUrl(appUrl: string): string {
  const redirectUri = `${appUrl}/api/auth/callback`;
  const params = new URLSearchParams({
    client_id: requireClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPES,
  });
  return `${STRAVA_OAUTH_BASE}/authorize?${params.toString()}`;
}

function requireClientId(): string {
  const id = process.env.STRAVA_CLIENT_ID;
  if (!id) throw new Error("STRAVA_CLIENT_ID manquant — voir .env.example");
  return id;
}

function requireClientSecret(): string {
  const secret = process.env.STRAVA_CLIENT_SECRET;
  if (!secret) throw new Error("STRAVA_CLIENT_SECRET manquant — voir .env.example");
  return secret;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireClientId(),
      client_secret: requireClientSecret(),
      code,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Échange du code Strava échoué (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireClientId(),
      client_secret: requireClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Rafraîchissement du token Strava échoué (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Renvoie un access_token valide, en le rafraîchissant si besoin. Ne modifie pas la session elle-même. */
export async function ensureFreshToken(
  session: Pick<SessionData, "accessToken" | "refreshToken" | "expiresAt">
): Promise<{ accessToken: string; refreshed?: TokenResponse }> {
  const now = Math.floor(Date.now() / 1000);
  if (session.accessToken && session.expiresAt && session.expiresAt - now > 60) {
    return { accessToken: session.accessToken };
  }
  if (!session.refreshToken) {
    throw new Error("Session Strava expirée, reconnecte-toi.");
  }
  const refreshed = await refreshAccessToken(session.refreshToken);
  return { accessToken: refreshed.access_token, refreshed };
}

export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  workout_type?: number | null; // 1 = Race (pour les sports course à pied)
  start_date_local: string;
  distance: number; // mètres
  moving_time: number; // secondes
  elapsed_time: number;
  total_elevation_gain: number; // mètres
  average_speed: number; // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  has_heartrate?: boolean;
  achievement_count?: number;
  pr_count?: number;
}

/** Récupère toutes les activités de course/trail entre `afterUnix` et maintenant. */
export async function fetchRunningActivities(
  accessToken: string,
  afterUnix: number
): Promise<StravaActivity[]> {
  const all: StravaActivity[] = [];
  let page = 1;
  const perPage = 200;
  // Garde-fou : jamais plus de 10 pages (2000 activités) sur une seule génération de dashboard.
  while (page <= 10) {
    const params = new URLSearchParams({
      after: String(afterUnix),
      page: String(page),
      per_page: String(perPage),
    });
    const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res.status === 429) {
      throw new Error(
        "Limite de requêtes Strava atteinte (rate limit). Réessaie dans quelques minutes."
      );
    }
    if (!res.ok) {
      throw new Error(`Erreur Strava activities (${res.status}): ${await res.text()}`);
    }
    const batch: StravaActivity[] = await res.json();
    all.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return all.filter((a) => a.sport_type === "Run" || a.sport_type === "TrailRun");
}

export interface HeartRateZoneRange {
  min: number;
  max: number; // -1 côté Strava pour "sans plafond" — converti ici
}

export interface AthleteZones {
  heart_rate?: {
    custom_zones: boolean;
    zones: HeartRateZoneRange[];
  };
}

/** Nécessite le scope profile:read_all ; peut échouer (403) si l'utilisateur ne l'a pas accordé. */
export async function fetchAthleteZones(accessToken: string): Promise<AthleteZones | null> {
  const res = await fetch(`${STRAVA_API_BASE}/athlete/zones`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export interface StravaLap {
  id: number;
  lap_index: number;
  name?: string;
  distance: number; // mètres
  moving_time: number; // secondes
  elapsed_time: number;
  average_speed: number; // m/s
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
}

/**
 * Détail des tours (laps) d'une activité — c'est ce qui permet de repérer une séance fractionnée
 * découpée par la montre (échauffement / répétitions / récupérations / retour au calme), même
 * quand l'activité elle-même n'a pas été taguée manuellement comme "Séance" sur Strava. Appelé
 * uniquement pour la toute dernière sortie, pas pour tout l'historique — un seul appel de plus,
 * dans l'esprit économe en requêtes du reste de l'app. Retourne null en cas d'échec (activité
 * sans laps, scope insuffisant, erreur réseau) plutôt que de faire échouer tout le tableau de bord.
 */
export async function fetchActivityLaps(
  accessToken: string,
  activityId: number
): Promise<StravaLap[] | null> {
  try {
    const res = await fetch(`${STRAVA_API_BASE}/activities/${activityId}/laps`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const laps: StravaLap[] = await res.json();
    return Array.isArray(laps) && laps.length > 0 ? laps : null;
  } catch {
    return null;
  }
}
