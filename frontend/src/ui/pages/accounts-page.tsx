"use client";

import Link from "next/link";
import { BreakdownList } from "../../components/cards/breakdown-list";
import { SectionCard } from "../../components/cards/section-card";
import { LineChart } from "../../components/charts/line-chart";
import { PeriodFields, usePeriod, ReportSelect } from "../../components/details/report-filters";
import { ReportLayout, ReportNavigation } from "../../components/details/report-layout";
import { ReportMetrics } from "../../components/details/report-metrics";
import { useReportQuery } from "../../components/details/report-query";
import { orderedTransactions, TransactionTable } from "../../components/details/transaction-table";
import { accountBalances, type ReportAccount } from "../../data/financial-data";
import { useFinancialReports } from "../../data/financial-reports";
import { isIncoming, summarizeBalances } from "../../lib/finance";
import { formatAvailableMoney, formatDate, formatMoney, formatMonth, formatSignedMoney } from "../../lib/format";
import { optionValue, reportHref } from "../../lib/report-links";

const flowOptions = [
  { value: "", label: "Entradas e saídas" },
  { value: "in", label: "Somente entradas" },
  { value: "out", label: "Somente saídas" },
];

export function AccountsPage() {
  const { params, href, update } = useReportQuery();
  const { accounts } = useFinancialReports();
  const banks = [...new Set(accounts.map(account => account.bank))];
  const bankOptions = [{ value: "", label: "Todas as instituições" }, ...banks.map(bank => ({ value: bank, label: bank }))];
  const evolution = params.get("aba") === "evolucao";
  const bank = optionValue(params.get("banco"), banks);
  const account = accounts.find(account => account.id === params.get("conta") && (!bank || bank === account.bank));

  return (
    <ReportLayout title={evolution ? "Evolução do saldo em contas" : "Saldo em contas"} dashboardMonth={params.get("painelMes")}>
      <ReportNavigation label="Detalhes de contas" options={[
        { label: "Contas", href: href({ aba: undefined }), active: !evolution },
        { label: "Evolução", href: href({ aba: "evolucao" }), active: evolution },
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
      {evolution ? <BalanceEvolution bank={bank} /> : (
        <>
          <AccountBalances bank={bank} activeAccount={account?.id} />
          {account && <AccountStatement account={account} />}
        </>
      )}
    </ReportLayout>
  );
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
  const transactions = reportedTransactions.filter(transaction => transaction.accountId === account.id && period.includes(transaction.date));
  const incoming = transactions.reduce((sum, transaction) => sum + (isIncoming(transaction) ? transaction.amountCents : 0), 0);
  const outgoing = transactions.reduce((sum, transaction) => sum + (isIncoming(transaction) ? 0 : transaction.amountCents), 0);
  const rows = orderedTransactions(transactions
    .filter(transaction => !direction || (isIncoming(transaction) ? "in" : "out") === direction)
    .map(transaction => ({ transaction })));
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
      <TransactionTable label="Extrato da conta" rows={rows} getHref={id => reportHref("/lancamentos", { painelMes: dashboardMonth, lancamento: id })} />
    </SectionCard>
  );
}

function BalanceEvolution({ bank }: { bank: string }) {
  const { params, update } = useReportQuery();
  const { asOf, currentMonth, balanceHistory, balanceChartPoint } = useFinancialReports();
  const history = balanceHistory(bank);
  if (history.length < 2) {
    return <SectionCard id="historico" title="Histórico de saldos"><p className="report-muted">Histórico de saldos mensais indisponível para estas conexões.</p></SectionCard>;
  }
  const months = history.slice(1).map(({ month }) => month);
  const from = optionValue(params.get("inicio"), months, months[0]);
  const to = optionValue(params.get("fim"), months.filter(month => month >= from), currentMonth);
  const points = history.filter(({ month }) => month >= from && month <= to);
  const opening = history[history.findIndex(({ month }) => month === from) - 1];
  const closing = points[points.length - 1];
  const selected = optionValue(params.get("ponto"), points.map(point => point.month), closing.month);
  const selectedIndex = points.findIndex(point => point.month === selected);
  const monthChoices = (choices: string[]) => choices.map(month => ({ value: month, label: formatMonth(month) }));

  return (
    <SectionCard id="historico" title="Histórico de saldos">
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
        {closing.month === currentMonth
          ? `Do fechamento de ${formatMonth(opening.month)} até ${formatDate(asOf)}.`
          : `Do fechamento de ${formatMonth(opening.month)} ao fechamento de ${formatMonth(closing.month)}.`}
      </p>
      {points.length > 1 && (
        <LineChart
          points={points.map(balanceChartPoint)}
          series={[{ label: bank || "Saldo consolidado", style: "actual" }]}
          axisIndices={points.map((_, index) => index)}
          initialIndex={selectedIndex}
          selectedIndex={selectedIndex}
          onSelect={index => update({ ponto: points[index].month })}
          axisLabel="Mês no gráfico de evolução do saldo"
          partialLastPoint={closing.month === currentMonth}
        />
      )}
    </SectionCard>
  );
}
