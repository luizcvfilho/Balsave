import { useId } from "react";
import { useFinancialReports } from "../../data/financial-reports";
import { optionValue } from "../../lib/report-links";

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

function readDate(value: string | null, asOf: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > asOf) return "";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value) ? value : "";
}

export function usePeriod(params: URLSearchParams, defaultMonth?: string, includePlans = false) {
  const { asOf, currentMonth, monthOptions, planningMonthOptions, planningMaxDate } = useFinancialReports();
  const options = includePlans ? planningMonthOptions : monthOptions;
  const maxDate = includePlans ? planningMaxDate : asOf;
  const month = optionValue(params.get("mes"), [...options.map(option => option.value), "todos", "personalizado"], defaultMonth ?? currentMonth);
  const from = month === "personalizado" ? readDate(params.get("de"), maxDate) : "";
  const to = month === "personalizado" ? readDate(params.get("ate"), maxDate) : "";
  return {
    month,
    from,
    to,
    options,
    maxDate,
    includes(date: string) {
      if (month === "personalizado") return (!from || date >= from) && (!to || date <= to);
      return month === "todos" || date.startsWith(month);
    },
  };
}

export function PeriodFields({ period, update }: {
  period: ReturnType<typeof usePeriod>;
  update: (values: Record<string, string | undefined>) => void;
}) {
  return (
    <>
      <ReportSelect
        label="Período"
        value={period.month}
        options={[...period.options, { value: "todos", label: "Todo o histórico" }, { value: "personalizado", label: "Personalizado" }]}
        onChange={month => update({ mes: month, de: undefined, ate: undefined })}
      />
      {period.month === "personalizado" && (
        <>
          <label className="report-field">
            <span>Data inicial</span>
            <input
              type="date" max={period.to || period.maxDate} value={period.from}
              onChange={event => {
                const date = readDate(event.target.value, period.maxDate);
                if (!date || !period.to || date <= period.to) update({ de: date });
              }}
            />
          </label>
          <label className="report-field">
            <span>Data final</span>
            <input
              type="date" min={period.from || undefined} max={period.maxDate} value={period.to}
              onChange={event => {
                const date = readDate(event.target.value, period.maxDate);
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
