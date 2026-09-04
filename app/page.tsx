import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session.accessToken) {
    redirect("/dashboard");
  }
  const { error } = await searchParams;

  return (
    <div className="login-wrap">
      <div className="login-card">
        <p className="eyebrow">Carnet de course</p>
        <h1 className="hero-title display" style={{ fontSize: "clamp(36px, 8vw, 56px)" }}>
          Ta course,
          <br />
          lue en un coup d&rsquo;œil.
        </h1>
        <p className="hero-sub" style={{ margin: "0 auto" }}>
          Connecte ton compte Strava pour voir ton volume, ton allure, ta fréquence cardiaque et
          des propositions de sorties concrètes pour progresser — calculés à partir de tes
          propres sorties, rien d&rsquo;autre.
        </p>
        <a className="strava-btn" href="/api/auth/login">
          Se connecter avec Strava
        </a>
        {error && (
          <div className="error-box">
            {error === "denied"
              ? "Connexion annulée : tu dois autoriser l'accès à tes données Strava pour utiliser le dashboard."
              : "Une erreur est survenue pendant la connexion à Strava. Réessaie."}
          </div>
        )}
        <p style={{ marginTop: 28, fontSize: 12.5, color: "var(--ink-muted)" }}>
          Rien n&rsquo;est partagé avec qui que ce soit : tes données restent dans ta propre
          session, chiffrées dans un cookie sur cet appareil.
        </p>
      </div>
    </div>
  );
}
