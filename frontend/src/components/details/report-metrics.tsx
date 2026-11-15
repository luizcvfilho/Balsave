export function ReportMetrics({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="report-metrics">
      {items.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
  );
}
