"use client";
import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import { TooltipProvider } from "./TooltipContext";
import type { DashboardData } from "@/lib/analysis";

type LoadState =
  | { status: "loading" }
  | { status: "error"; kind: string; message?: string }
  | { status: "empty" }
  | { status: "ready"; data: DashboardData };

export default function DashboardShell() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard-data")
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok || body.error === "unauthenticated" || body.error === "session_expired") {
          setState({ status: "error", kind: "auth" });
          return;
        }
        if (body.error === "no_activities") {
          setState({ status: "empty" });
          return;
        }
        if (body.error) {
          setState({ status: "error", kind: body.error, message: body.message });
          return;
        }
        setState({ status: "ready", data: body.data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", kind: "network" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <p className="eyebrow">Carnet de course</p>
          <p className="hero-sub">Récupération de tes activités Strava en cours…</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <p className="eyebrow">Carnet de course</p>
          <h1 className="hero-title display" style={{ fontSize: "clamp(28px, 6vw, 40px)" }}>
            Un problème est survenu
          </h1>
          <div className="error-box">
            {state.kind === "auth" &&
              "Ta session Strava a expiré ou n'est plus valide. Reconnecte-toi."}
            {state.kind === "network" && "Impossible de contacter le serveur. Réessaie."}
            {state.kind === "strava_error" &&
              (state.message ?? "Erreur lors de la récupération des données Strava.")}
          </div>
          <a className="strava-btn" href="/api/auth/login">
            Se reconnecter avec Strava
          </a>
        </div>
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <p className="eyebrow">Carnet de course</p>
          <h1 className="hero-title display" style={{ fontSize: "clamp(28px, 6vw, 40px)" }}>
            Pas encore de sorties
          </h1>
          <p className="hero-sub" style={{ margin: "0 auto" }}>
            Aucune activité de course à pied trouvée sur les 18 derniers mois de ton compte
            Strava. Enregistre quelques sorties puis reviens ici.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Dashboard data={state.data} />
    </TooltipProvider>
  );
}
