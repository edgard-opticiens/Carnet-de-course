"use client";
import { useEffect, useRef, useState } from "react";
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
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    function load(silent: boolean) {
      // Évite deux requêtes en parallèle si plusieurs événements (focus + visibilitychange)
      // se déclenchent au même instant.
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      if (!silent) setState({ status: "loading" });

      fetch("/api/dashboard-data", { cache: "no-store" })
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
          setUpdatedAt(new Date());
        })
        .catch(() => {
          if (cancelled) return;
          // Un rafraîchissement silencieux qui échoue (ex. réseau coupé un instant) ne doit
          // pas effacer un tableau de bord déjà affiché — on ne bascule sur l'écran d'erreur
          // que si on n'avait encore rien à montrer.
          setState((s) => (s.status === "ready" ? s : { status: "error", kind: "network" }));
        })
        .finally(() => {
          fetchingRef.current = false;
        });
    }

    load(false);

    // Sur iPhone, une appli ajoutée à l'écran d'accueil est souvent simplement "réveillée"
    // par iOS depuis la mémoire au lieu d'être rechargée depuis le réseau : le useEffect
    // ci-dessus ne se redéclenche donc pas tout seul. On force un nouveau chargement des
    // données à chaque fois que l'appli redevient visible (retour au premier plan).
    function onResume() {
      if (document.visibilityState === "visible") load(true);
    }
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    window.addEventListener("focus", onResume);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
      window.removeEventListener("focus", onResume);
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
      <Dashboard data={state.data} updatedAt={updatedAt} />
    </TooltipProvider>
  );
}
