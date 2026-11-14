const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const signedCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", signDisplay: "exceptZero" });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const compactMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const fullDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" });
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
export const formatSignedMoney = (cents: number) => signedCurrency.format(cents / 100);
export const formatPercent = (share: number) => percent.format(share);
export const formatCompactMoney = (cents: number) => compactMoney.format(cents / 100);
export const formatDate = (date: string) => fullDate.format(new Date(date));
export const formatShortDate = (date: string) => shortDate.format(new Date(date));
export const formatMonth = (month: string) => fullMonth.format(new Date(month));
export const formatMonthName = (month: string) => monthName.format(new Date(month));
export const formatShortMonth = (month: string) => monthAbbreviation.format(new Date(month)).replace(/\.$/, "");
