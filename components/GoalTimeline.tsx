"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "carnet-de-course:goal-date";

function phasesFor(raceDate: Date, now: Date) {
  const specificStart = new Date(raceDate);
  specificStart.setDate(specificStart.getDate() - 70); // ~10 semaines avant
  const taperStart = new Date(raceDate);
  taperStart.setDate(taperStart.getDate() - 14); // ~2 semaines avant

  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  return [
    { tag: `${fmt(now)} → ${fmt(specificStart)}`, label: "Base aérobie : volume et sortie longue qui grossissent régulièrement" },
    { tag: `${fmt(specificStart)} → ${fmt(taperStart)}`, label: "Bloc spécifique : côtes ou vitesse selon l'objectif, une séance qualité par semaine" },
    { tag: `${fmt(taperStart)} → ${fmt(raceDate)}`, label: "Affûtage : volume en baisse, sorties courtes et vives" },
    { tag: fmt(raceDate), label: "Jour J" },
  ];
}

export default function GoalTimeline() {
  const [dateStr, setDateStr] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setDateStr(stored);
        setSaved(stored);
      }
    } catch {
      /* localStorage indisponible : formulaire vide, pas bloquant */
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      window.localStorage.setItem(STORAGE_KEY, dateStr);
    } catch {
      /* si le stockage échoue, on garde quand même la valeur en mémoire pour cette session */
    }
    setSaved(dateStr);
  }

  const raceDate = saved ? new Date(saved + "T00:00:00") : null;
  const now = new Date();
  const valid = raceDate && !isNaN(raceDate.getTime()) && raceDate.getTime() > now.getTime();

  return (
    <div>
      <form className="goal-form" onSubmit={handleSubmit}>
        <input
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          aria-label="Date de ton prochain objectif"
        />
        <button type="submit">Calculer ma trajectoire</button>
      </form>
      <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: "0 0 16px" }}>
        Enregistrée uniquement dans ton navigateur, jamais envoyée nulle part.
      </p>
      {valid && raceDate ? (
        <div>
          {phasesFor(raceDate, now).map((p, i) => (
            <div className="event-row" style={{ marginTop: 10 }} key={i}>
              <span className="event-tag">{p.tag}</span>
              <span>{p.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
          Indique la date d&rsquo;une course ou d&rsquo;un objectif à venir pour voir une
          trajectoire d&rsquo;entraînement générique (base, bloc spécifique, affûtage).
        </p>
      )}
    </div>
  );
}
