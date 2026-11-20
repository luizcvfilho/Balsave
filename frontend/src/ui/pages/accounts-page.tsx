"use client";

import Link from "next/link";
import { BreakdownList } from "../../components/cards/breakdown-list";
import { SectionCard } from "../../components/cards/section-card";
import { LineChart } from "../../components/charts/line-chart";
import { PeriodFields, usePeriod, ReportSelect } from "../../components/details/report-filters";
import { ReportLayout, ReportNavigation } from "../../components/details/report-layout";
import { ReportMetrics } from "../../components/details/report-metrics";
import { Reconciliation } from "../../components/details/reconciliation";
import { useReportQuery } from "../../components/details/report-query";
import { orderedTransactions, TransactionTable } from "../../components/details/transaction-table";
import { accountBalances, type ReportAccount } from "../../data/financial-data";
import { useFinancialReports } from "../../data/financial-reports";
import { bankBalanceImpact, summarizeBalances } from "../../lib/finance";
import { formatAvailableMoney, formatDate, formatMoney, formatMonth, formatSignedMoney } from "../../lib/format";
import { optionValue, reportHref } from "../../lib/report-links";

const flowOptions = [
  { value: "", label: "Entradas e saídas" },
  { value: "in", label: "Somente entradas" },
  { value: "out", label: "Somente saídas" },
];

export function AccountsPage() {
  const { params, href, update } = useReportQuery();
  const { accounts, investments } = useFinancialReports();
  const banks = [...new Set([...accounts, ...investments].map(account => account.bank))];
  const bankOptions = [{ value: "", label: "Todas as instituições" }, ...banks.map(bank => ({ value: bank, label: bank }))];
  const evolution = params.get("aba") === "evolucao";
  const reconciliation = params.get("aba") === "conciliacao";
  const bank = optionValue(params.get("banco"), banks);
  const account = accounts.find(account => account.id === params.get("conta") && (!bank || bank === account.bank));

  return (
    <ReportLayout title={reconciliation ? "Conciliação de movimentações" : evolution
      ? (investments.length ? "Evolução de contas e investimentos" : "Evolução do saldo em contas") : "Saldo em contas"} dashboardMonth={params.get("painelMes")}>
      <ReportNavigation label="Detalhes de contas" options={[
        { label: "Contas", href: href({ aba: undefined }), active: !evolution && !reconciliation },
        { label: "Evolução", href: href({ aba: "evolucao" }), active: evolution },
        { label: "Conciliação", href: href({ aba: "conciliacao" }), active: reconciliation },
      ]} />
      <SectionCard id="filtros-contas" title="Instituições">
        <div className="report-filters">
          <ReportSelect
            label="Instituição"
            value={bank}
            options={bankOptions}
            onChange={value => update({ banco: value, conta: undefined })}
          />
        </div>
      </SectionCard>
      {reconciliation ? <Reconciliation /> : evolution ? <BalanceEvolution bank={bank} /> : (
        <>
          <AccountBalances bank={bank} activeAccount={account?.id} />
          <InvestmentBalances bank={bank} />
          {account && <AccountStatement account={account} />}
        </>
      )}
    </ReportLayout>
  );
}

function InvestmentBalances({ bank }: { bank: string }) {
  const { investments, positions, failedInvestments } = useFinancialReports();
  const visible = investments.filter(position => !bank || position.bank === bank);
  if (!investments.length && !failedInvestments) return null;
  const tracked = positions.filter(position => !bank || position.bank === bank);
  return <SectionCard id="saldos-investimentos" title="Contas e investimentos"
    description="Investimentos indicados como incluídos no saldo da conta são contados uma única vez.">
    <ReportMetrics items={[{ label: "Saldo consolidado acompanhado", value: tracked.every(position => position.balanceCents !== null)
      ? formatMoney(tracked.reduce((sum, position) => sum + (position.balanceCents ?? 0), 0)) : "Indisponível" }]} />
    {failedInvestments ? <p className="report-muted" role="status">Parte dos investimentos está indisponível. O total pode estar incompleto.</p> : null}
    <BreakdownList rows={visible.map(position => ({ key: position.id, label: position.name, value: formatAvailableMoney(position.balanceCents) }))} />
    <Link className="report-link report-action" href="/contas?aba=conciliacao">Revisar composição e transferências</Link>
  </SectionCard>;
}

function AccountBalances({ bank, activeAccount }: { bank: string; activeAccount?: string }) {
  const { href } = useReportQuery();
  const { accounts, asOf } = useFinancialReports();
  const visible = accounts.filter(account => !bank || account.bank === bank);
  const balances = summarizeBalances(accountBalances(visible));
  const bankNames = [...new Set([...balances.banks.map(row => row.bank), ...visible.map(account => account.bank)])];

  if (!visible.length) {
    return <SectionCard id="saldos-individuais" title="Saldos por conta"><p className="report-muted">Nenhuma conta em reais disponível.</p></SectionCard>;
  }

  return (
    <SectionCard id="saldos-individuais" title="Saldos por conta" description={`Saldo em ${formatDate(asOf)}`}>
      <ReportMetrics items={[{ label: "Saldo consolidado", value: visible.length && visible.every(account => account.balanceCents !== null)
        ? formatMoney(balances.totalCents) : "Indisponível" }]} />
      {/* biome-ignore lint/a11y/noRedundantRoles: Safari can omit the list role when markers are hidden. */}
      <ul className="report-list" role="list">
        {bankNames.map(bankName => (
          <li key={bankName} className="report-list-item">
            <div className="report-group">
              <h3 className="report-strong">{bankName}</h3>
              <span className="report-strong">{formatAvailableMoney(visible.some(account => account.bank === bankName && account.balanceCents === null)
                ? null : balances.banks.find(row => row.bank === bankName)?.balanceCents ?? null)}</span>
            </div>
            <BreakdownList rows={visible.filter(account => account.bank === bankName).map(account => ({
              key: account.id,
              label: (
                <Link
                  className="report-link report-action"
                  href={`${href({ conta: account.id })}#extrato`}
                  aria-label={`Ver extrato de ${bankName} · ${account.name}`}
                  aria-current={activeAccount === account.id ? "true" : undefined}
                >{account.name}</Link>
              ),
              value: formatAvailableMoney(account.balanceCents),
            }))} />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function AccountStatement({ account }: { account: ReportAccount }) {
  const { params, update } = useReportQuery();
  const { reportedTransactions } = useFinancialReports();
  const period = usePeriod(params);
  const direction = optionValue(params.get("direcao"), ["in", "out"]);
  const movements = reportedTransactions
    .filter(transaction => transaction.accountId === account.id && period.includes(transaction.date))
    .map(transaction => ({ transaction, impact: bankBalanceImpact(transaction) }));
  const incoming = movements.reduce((sum, { impact }) => sum + Math.max(impact, 0), 0);
  const outgoing = movements.reduce((sum, { impact }) => sum - Math.min(impact, 0), 0);
  const rows = orderedTransactions(movements.filter(({ impact }) => !direction || (direction === "in" ? impact > 0 : impact < 0)));
  const dashboardMonth = params.get("painelMes") ?? undefined;

  return (
    <SectionCard id="extrato" title="Extrato" description={`${account.bank} · ${account.name}`}>
      <div className="report-filters">
        <PeriodFields period={period} update={update} />
        <ReportSelect label="Movimentação" value={direction} options={flowOptions} onChange={value => update({ direcao: value })} />
      </div>
      <ReportMetrics items={[
        { label: "Entradas no período", value: formatMoney(incoming) },
        { label: "Saídas no período", value: formatMoney(outgoing) },
      ]} />
      <TransactionTable label="Extrato da conta" rows={rows} balanceScope="account" getHref={id => reportHref("/lancamentos", { painelMes: dashboardMonth, lancamento: id })} />
    </SectionCard>
  );
}

function BalanceEvolution({ bank }: { bank: string }) {
  const { params, update } = useReportQuery();
  const { live, balanceHistory, balanceChartPoint } = useFinancialReports();
  const { points: history, partial, description, emptyMessage } = balanceHistory(bank);
  if (history.length < 2) {
    return <SectionCard id="historico" title="Histórico de saldos"><p className="report-muted">{emptyMessage}</p></SectionCard>;
  }
  const months = history.slice(1).map(({ month }) => month);
  const from = optionValue(params.get("inicio"), months, months[0]);
  const to = optionValue(params.get("fim"), months.filter(month => month >= from), months[months.length - 1]);
  const opening = history[history.findIndex(({ month }) => month === from) - 1];
  const points = history.filter(({ month }) => month >= (live ? opening.month : from) && month <= to);
  const closing = points[points.length - 1];
  const selected = optionValue(params.get("ponto"), points.map(point => point.month), closing.month);
  const selectedIndex = points.findIndex(point => point.month === selected);
  const monthChoices = (choices: string[]) => choices.map(month => ({ value: month, label: formatMonth(month) }));

  return (
    <SectionCard id="historico" title="Histórico de saldos" description={description}>
      <div className="report-filters">
        <ReportSelect label="Mês inicial" value={from} options={monthChoices(months.filter(month => month <= to))} onChange={value => update({ inicio: value })} />
        <ReportSelect label="Mês final" value={to} options={monthChoices(months.filter(month => month >= from))} onChange={value => update({ fim: value })} />
      </div>
      <ReportMetrics items={[
        { label: "Saldo inicial", value: formatMoney(opening.cents) },
        { label: "Saldo final", value: formatMoney(closing.cents) },
        { label: "Variação", value: formatSignedMoney(closing.cents - opening.cents) },
      ]} />
      <p className="report-muted">
        Do fechamento de {formatMonth(opening.month)} ao fechamento de {formatMonth(closing.month)}.
      </p>
      {points.length > 1 && (
        <LineChart
          points={points.map(balanceChartPoint)}
          series={[{ label: partial ? "Saldo das contas com histórico" : bank || "Saldo consolidado", style: "actual" }]}
          axisIndices={points.flatMap((_, index) => points.length <= 7 || index % 2 === 0 || index === points.length - 1 ? [index] : [])}
          initialIndex={selectedIndex}
          selectedIndex={selectedIndex}
          onSelect={index => update({ ponto: points[index].month })}
          axisLabel="Mês no gráfico de evolução do saldo"
        />
      )}
    </SectionCard>
  );
}
