import { accountBalances, type FinancialData } from "../../data/financial-data";
import { summarizeBalances } from "../../lib/finance";

export const maxMoney = 999_999_999;

export function simulatorSources(data: Pick<FinancialData, "asOf" | "accounts" | "investments" | "failedConnections">) {
  const banksWithMissingBalances = new Set(data.accounts.flatMap(account => account.balanceCents === null ? [account.bank] : []));
  const balances = accountBalances(data.accounts);
  const { banks, totalCents } = summarizeBalances(balances);
  const isUsableCash = (cents: number) => Number.isSafeInteger(cents) && cents >= 0 && cents <= maxMoney;
  return {
    asOf: data.asOf,
    totalCents: balances.length && !data.failedConnections && !banksWithMissingBalances.size && isUsableCash(totalCents)
      ? totalCents : null,
    banks: banks.filter(({ bank, balanceCents }) => !banksWithMissingBalances.has(bank) && isUsableCash(balanceCents)),
    funds: (data.investments ?? []).flatMap(({ id, name, bank, asOf, fund }) => fund ? [
      { id, name, bank, asOf, lastTwelveMonthsRateBps: fund.lastTwelveMonthsRateBps },
    ] : []),
  };
}

export type SimulatorSources = ReturnType<typeof simulatorSources>;
