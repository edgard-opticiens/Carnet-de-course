import { NextResponse } from "next/server";
import { getAuthorizeUrl } from "@/lib/strava";

function requireAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("APP_URL manquant — voir .env.example");
  return url.replace(/\/$/, "");
}

export async function GET() {
  const appUrl = requireAppUrl();
  return NextResponse.redirect(getAuthorizeUrl(appUrl));
}
