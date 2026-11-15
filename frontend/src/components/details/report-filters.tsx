import { useId } from "react";
import { mockAsOf, mockSpendingMonths } from "../../data/mock-data";
import { currentMonth } from "../../data/mock-reports";
import { optionValue } from "../../lib/report-links";
import { monthOptions } from "./report-layout";

type Option = { value: string; label: string };

export function ReportSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="report-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function readDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > mockAsOf) return "";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value) ? value : "";
}

export function readPeriod(params: URLSearchParams, defaultMonth = currentMonth) {
  const month = optionValue(params.get("mes"), [...mockSpendingMonths, "todos", "personalizado"], defaultMonth);
  const from = month === "personalizado" ? readDate(params.get("de")) : "";
  const to = month === "personalizado" ? readDate(params.get("ate")) : "";
  return {
    month,
    from,
    to,
    includes(date: string) {
      if (month === "personalizado") return (!from || date >= from) && (!to || date <= to);
      return month === "todos" || date.startsWith(month);
    },
  };
}

export function PeriodFields({ period, update }: {
  period: ReturnType<typeof readPeriod>;
  update: (values: Record<string, string | undefined>) => void;
}) {
  return (
    <>
      <ReportSelect
        label="Período"
        value={period.month}
        options={[...monthOptions, { value: "todos", label: "Todo o histórico" }, { value: "personalizado", label: "Personalizado" }]}
        onChange={month => update({ mes: month, de: undefined, ate: undefined })}
      />
      {period.month === "personalizado" && (
        <>
          <label className="report-field">
            <span>Data inicial</span>
            <input
              type="date" max={period.to || mockAsOf} value={period.from}
              onChange={event => {
                const date = readDate(event.target.value);
                if (!date || !period.to || date <= period.to) update({ de: date });
              }}
            />
          </label>
          <label className="report-field">
            <span>Data final</span>
            <input
              type="date" min={period.from || undefined} max={mockAsOf} value={period.to}
              onChange={event => {
                const date = readDate(event.target.value);
                if (!date || !period.from || date >= period.from) update({ ate: date });
              }}
            />
          </label>
        </>
      )}
    </>
  );
}

export function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="report-field report-search">
      <span>Buscar lançamentos</span>
      <input type="search" value={value} onChange={event => onChange(event.target.value)} maxLength={120} placeholder="Digite uma descrição" />
    </label>
  );
}

export function matchesSearch(search: string, ...values: (string | undefined)[]) {
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
  return normalize(values.filter(Boolean).join(" ")).includes(normalize(search.trim()));
}
