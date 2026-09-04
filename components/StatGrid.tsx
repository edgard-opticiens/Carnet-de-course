import type { DashboardData } from "@/lib/analysis";

export default function StatGrid({ data }: { data: DashboardData }) {
  const tiles: [string, string][] = [
    [data.totalDistKm.toLocaleString("fr-FR") + " km", "distance cumulée"],
    [String(data.totalRuns), "sorties enregistrées"],
    [data.totalTimeH.toLocaleString("fr-FR") + " h", "temps de course"],
    [data.totalElevM.toLocaleString("fr-FR") + " m", "dénivelé positif"],
  ];
  return (
    <div className="stat-grid">
      {tiles.map(([v, l]) => (
        <div className="stat-tile" key={l}>
          <div className="stat-value display">{v}</div>
          <div className="stat-label">{l}</div>
        </div>
      ))}
    </div>
  );
}
