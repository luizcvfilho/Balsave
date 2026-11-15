const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const signedCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", signDisplay: "exceptZero" });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const compactMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const compactUnits = [
  { cents: 100_000_000_000_000, suffix: "tri" },
  { cents: 100_000_000_000, suffix: "bi" },
  { cents: 100_000_000, suffix: "mi" },
  { cents: 100_000, suffix: "mil" },
];
const fullDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" });
const numericDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fullMonth = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const monthAbbreviation = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

// ISO date strings represent calendar dates in the reporting timezone.
export const formatMoney = (cents: number) => currency.format(cents / 100);
export const formatAvailableMoney = (cents: number | null) => cents === null ? "Indisponível" : formatMoney(cents);
export const formatSignedMoney = (cents: number) => signedCurrency.format(cents / 100);
export const formatPercent = (share: number) => percent.format(share);
export function formatCompactMoney(cents: number) {
  // Use explicit scales because compact currency notation differs across ICU versions.
  const unit = compactUnits.find(({ cents: threshold }) => Math.abs(cents) >= threshold);
  return unit ? `${compactMoney.format(cents / unit.cents)} ${unit.suffix}` : compactMoney.format(cents / 100);
}
export const formatDate = (date: string) => fullDate.format(new Date(date));
export const formatNumericDate = (date: string) => numericDate.format(new Date(date));
export const formatShortDate = (date: string) => shortDate.format(new Date(date));
export const formatMonth = (month: string) => fullMonth.format(new Date(month));
export const formatMonthName = (month: string) => monthName.format(new Date(month));
export const formatShortMonth = (month: string) => monthAbbreviation.format(new Date(month)).replace(/\.$/, "");
