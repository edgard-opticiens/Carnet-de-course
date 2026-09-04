export default function RampChart({
  weeks,
  fartlekFromWeek,
}: {
  weeks: number[];
  fartlekFromWeek: number;
}) {
  const max = Math.max(...weeks, 1);
  return (
    <div>
      {weeks.map((km, i) => (
        <div className="ramp-row" key={i}>
          <div className="ramp-label">
            Sem. {i + 1}
            {i + 1 === fartlekFromWeek ? " · fartlek" : ""}
          </div>
          <div className="ramp-track">
            <div className="ramp-fill" style={{ width: `${(km / max) * 100}%` }} />
          </div>
          <div className="ramp-val">{km} km</div>
        </div>
      ))}
    </div>
  );
}
