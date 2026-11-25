import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useId, useSyncExternalStore } from "react";
import { useFinancialReports } from "../../data/financial-reports";
import { optionValue } from "../../lib/report-links";

type Option = { value: string; label: string };

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ReportSelect({ label, value, options, onChange, disabled, variant }: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  variant?: "compact" | "period";
}) {
  const id = useId();
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return (
    <div className={variant ? `balsave-picker balsave-picker-${variant}` : "report-field"}>
      <label className={variant ? "sr-only" : undefined} htmlFor={id}>{label}</label>
      {variant === "period" && (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      )}
      <select id={id} value={value} disabled={disabled || !ready} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option.value} value={option.value}>
          {variant === "period" ? option.label.charAt(0).toLocaleUpperCase("pt-BR") + option.label.slice(1) : option.label}
        </option>)}
      </select>
    </div>
  );
}

export function ReportMultiSelect({ label, placeholder, selectionLabel = label, options, selected, onChange,
  clearLabel = placeholder, description, labeled = false }: {
  label: string;
  placeholder: string;
  selectionLabel?: string;
  options: readonly Option[];
  selected: ReadonlySet<string>;
  onChange: (values: string[]) => void;
  clearLabel?: string;
  description?: string;
  labeled?: boolean;
}) {
  const id = useId();
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const field = (
    <div className="balsave-picker balsave-picker-compact report-multi-picker">
      <Select<string[]>
        variant="standard"
        disableUnderline
        multiple
        displayEmpty
        value={[...selected]}
        disabled={!ready || options.length === 0}
        labelId={labeled ? id : undefined}
        inputProps={{ "aria-label": label }}
        renderValue={value => {
          if (value.length === 0) return placeholder;
          if (value.length === 1) return options.find(option => option.value === value[0])?.label ?? placeholder;
          return `${selectionLabel} (${value.length})`;
        }}
        onChange={event => {
          const value = event.target.value;
          const next = typeof value === "string" ? [value] : value;
          onChange(next.includes("") ? [] : next);
        }}
        MenuProps={{ slotProps: {
          paper: { className: "report-multi-menu" },
          list: { "aria-label": selectionLabel, "aria-description": description },
        } }}
      >
        <MenuItem value="" disabled={selected.size === 0}>{clearLabel}</MenuItem>
        {options.map(option => (
          <MenuItem key={option.value} value={option.value}>
            <span className="report-multi-check" aria-hidden="true">{selected.has(option.value) ? "✓" : ""}</span>
            <span>{option.label}</span>
          </MenuItem>
        ))}
      </Select>
    </div>
  );
  return labeled ? <div className="report-field"><span id={id}>{label}</span>{field}</div> : field;
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

export function PeriodFields({ period, update, compact = false }: {
  period: ReturnType<typeof usePeriod>;
  update: (values: Record<string, string | undefined>) => void;
  compact?: boolean;
}) {
  return (
    <>
      <ReportSelect
        label="Período"
        variant={compact ? "period" : undefined}
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

export function SearchField({ value, onChange, compact = false }: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return (
    <label className={compact ? "balsave-picker-search" : "report-field report-search"}>
      <span className={compact ? "sr-only" : undefined}>Buscar lançamentos</span>
      {compact && (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round">
          <circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4 4" />
        </svg>
      )}
      <input type="search" value={value} disabled={!ready} onChange={event => onChange(event.target.value)} maxLength={120}
        placeholder={compact ? "Buscar" : "Digite uma descrição"} />
    </label>
  );
}

export function matchesSearch(search: string, ...values: (string | undefined)[]) {
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
  return normalize(values.filter(Boolean).join(" ")).includes(normalize(search.trim()));
}
