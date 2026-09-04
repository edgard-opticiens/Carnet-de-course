import type { RecordEntry } from "@/lib/analysis";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function RecordsGrid({ records }: { records: RecordEntry[] }) {
  return (
    <div className="records-grid">
      {records.map((r) => (
        <div className="card record-tile" key={r.key}>
          <div className="record-label">{r.label}</div>
          {r.timeLabel ? (
            <>
              <div className="record-time display">{r.timeLabel}</div>
              <div className="record-pace">{r.paceLabel}</div>
              <div className="record-meta">
                {r.sourceLabel}
                {r.date ? ` · ${formatDate(r.date)}` : ""}
                {r.isRace && <span className="race-badge badge-race">course</span>}
              </div>
            </>
          ) : (
            <div className="record-empty">Pas encore de sortie sur cette distance</div>
          )}
        </div>
      ))}
    </div>
  );
}
