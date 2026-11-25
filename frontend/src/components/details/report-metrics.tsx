import type { ReactNode } from "react";

export function ReportMetrics({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="report-metrics">
      {items.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
  );
}
