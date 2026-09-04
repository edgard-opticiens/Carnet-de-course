import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/strava";
import { getSession } from "@/lib/session";

function appUrl(): string {
  return (process.env.APP_URL ?? "").replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const error = searchParams.get("error");
  const code = searchParams.get("code");

  if (error || !code) {
    return NextResponse.redirect(`${appUrl()}/?error=denied`);
  }

  try {
    const token = await exchangeCodeForToken(code);
    const session = await getSession();
    session.accessToken = token.access_token;
    session.refreshToken = token.refresh_token;
    session.expiresAt = token.expires_at;
    session.athleteId = token.athlete?.id;
    session.athleteName = [token.athlete?.firstname, token.athlete?.lastname]
      .filter(Boolean)
      .join(" ") || "Athlète";
    await session.save();
    return NextResponse.redirect(`${appUrl()}/dashboard`);
  } catch (e) {
    console.error("Erreur callback Strava:", e);
    return NextResponse.redirect(`${appUrl()}/?error=exchange_failed`);
  }
}
