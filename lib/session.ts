import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  athleteId?: number;
  athleteName?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number; // unix seconds
}

function requireSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET manquant ou trop court (32 caractères minimum). Vois .env.example."
    );
  }
  return secret;
}

export function sessionOptions(): SessionOptions {
  return {
    password: requireSecret(),
    cookieName: "carnet_de_course_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 jours ; les tokens Strava eux-mêmes sont rafraîchis avant expiration
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  // Next.js 15+ : cookies() est asynchrone (Server Components / Route Handlers).
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions());
}
