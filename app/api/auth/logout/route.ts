import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

function appUrl(): string {
  return (process.env.APP_URL ?? "").replace(/\/$/, "");
}

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(`${appUrl()}/`, { status: 303 });
}
