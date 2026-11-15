"use client";

import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { categoryBreakdown } from "../../lib/finance";
import { formatMonth, formatMoney, formatPercent } from "../../lib/format";
import { SectionCard } from "../cards/section-card";

type Props = {
  periods: ReturnType<typeof categoryBreakdown>[];
  asOf: string;
  month: string;
  onMonthChange: (month: string) => void;
  getHref: (category?: string) => string;
};

const categoryColors: ReadonlyMap<string, string> = new Map([
  ["Moradia", "var(--category-housing)"],
  ["Alimentação", "var(--category-food)"],
  ["Transporte", "var(--category-transport)"],
  ["Saúde", "var(--category-health)"],
  ["Lazer", "var(--category-leisure)"],
  ["Viagem", "var(--category-travel)"],
]);

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function SpendingCategories({ periods, asOf, month, onMonthChange, getHref }: Props) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const currentMonth = asOf.slice(0, 7);
  const period = periods.find(entry => entry.month === month);
  const asOfDay = Number(asOf.slice(8));

  return (
    <SectionCard
      id="categorias"
      title="Gastos por categoria"
      href={getHref()}
      action={
        <TextField
          select
          size="small"
          disabled={!ready}
          value={month}
          onChange={event => onMonthChange(event.target.value)}
          slotProps={{ select: { native: true, inputProps: { "aria-label": "Mês dos gastos por categoria" } } }}
          sx={{
            maxWidth: "100%",
            "& .MuiOutlinedInput-root": { borderRadius: "var(--radius-button)" },
            "& .MuiNativeSelect-select": { boxSizing: "border-box", minHeight: 44, fontSize: "1rem" },
          }}
        >
          {periods.map(entry => (
            <option key={entry.month} value={entry.month}>{formatMonth(entry.month)}</option>
          ))}
        </TextField>
      }
    >
      <div aria-live="polite" aria-atomic="true">
        <Typography color="primary.main" sx={{ fontSize: "1.375rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {formatMoney(period?.totalCents ?? 0)}
        </Typography>
        <Typography variant="body2" color="var(--text-secondary)">
          {month === currentMonth ? `Gasto líquido até dia ${asOfDay}` : "Gasto líquido no mês"}
        </Typography>
        {period && period.categories.length > 0 ? (
          // Keep the explicit list role for Safari when markers are visually hidden.
          <Box component="ul" role="list" sx={{ display: "grid", gap: 1.25, mt: 1.5, mb: 0, pl: 0, listStyle: "none" }}>
            {period.categories.map(({ name, cents }) => {
              const share = cents / period.totalCents;
              return (
                <li key={name}>
                  <Box component={Link} href={getHref(name)} className="report-link report-choice" sx={{ py: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{name}</Typography>
                    <Typography variant="body2" sx={{ marginInlineStart: "auto", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {formatMoney(cents)}{" "}
                      <Typography component="span" variant="caption" color="var(--text-secondary)" sx={{ display: "inline-block", minWidth: "3.375rem", textAlign: "end" }}>
                        {formatPercent(share)}
                      </Typography>
                    </Typography>
                  </Box>
                  <LinearProgress
                    value={share * 100}
                    aria-hidden="true"
                    sx={{
                      mt: 0.5,
                      "& .MuiLinearProgress-bar": {
                        bgcolor: categoryColors.get(name) ?? "var(--category-other)",
                      },
                    }}
                  />
                </li>
              );
            })}
          </Box>
        ) : <Typography variant="body2" color="var(--text-secondary)" sx={{ mt: 1.5 }}>Nenhum gasto neste mês.</Typography>}
      </div>
    </SectionCard>
  );
}
