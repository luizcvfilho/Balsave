"use client";

import Link from "next/link";
import { BreakdownList } from "../../components/cards/breakdown-list";
import { SectionCard } from "../../components/cards/section-card";
import { LineChart } from "../../components/charts/line-chart";
import { InvestmentDetail } from "../../components/details/investment-detail";
import { PeriodFields, ReportMultiSelect, ReportSelect, usePeriod } from "../../components/details/report-filters";
import { ReportLayout, ReportNavigation } from "../../components/details/report-layout";
import { ReportMetrics } from "../../components/details/report-metrics";
import { useReportQuery } from "../../components/details/report-query";
import { orderedTransactions, TransactionTable } from "../../components/details/transaction-table";
import { accountBalances, type ReportAccount } from "../../data/financial-data";
import { useFinancialReports } from "../../data/financial-reports";
import { bankBalanceImpact, summarizeBalances } from "../../lib/finance";
import { formatAvailableMoney, formatDate, formatMoney, formatMonth, formatSignedMoney } from "../../lib/format";
import { optionValue, optionValues, reportHref } from "../../lib/report-links";

const flowOptions = [
  { value: "in", label: "Entradas" },
  { value: "out", label: "Saídas" },
];

export function AccountsPage() {
  const { params, href, update } = useReportQuery();
  const { accounts, investments } = useFinancialReports();
  const bankOptions = [...new Set([...accounts, ...investments].map(account => account.bank))]
    .map(bank => ({ value: bank, label: bank }));
  const dashboardMonth = params.get("painelMes");
  const investmentId = params.get("investimento");
  const evolution = params.get("aba") === "evolucao";
  const banks = optionValues(params, "banco", bankOptions);
  const account = accounts.find(account => account.id === params.get("conta") && (!banks.size || banks.has(account.bank)));

  if (investmentId) {
    const investment = investments.find(position => position.id === investmentId);
    return (
      <ReportLayout title={investment?.name ?? "Investimento indisponível"} dashboardMonth={dashboardMonth}
        back={{ href: href({ investimento: undefined, aba: undefined }), label: "Voltar às contas" }}>
        {investment ? <InvestmentDetail key={investment.id} investment={investment} /> : (
          <p className="report-muted">Volte às contas para selecionar outro investimento.</p>
        )}
      </ReportLayout>
    );
  }

  return (
    <ReportLayout title={evolution ? "Evolução do saldo" : "Contas"}
      description="Veja seus saldos, investimentos e movimentações." dashboardMonth={dashboardMonth}
      controls={<ReportMultiSelect label="Instituição" placeholder="Todas as instituições" selectionLabel="Instituições"
        selected={banks} options={bankOptions} onChange={values => update({
          banco: values,
          conta: account && (!values.length || values.includes(account.bank)) ? account.id : undefined,
        })} />}>
      <ReportNavigation label="Detalhes de contas" options={[
        { label: "Contas", href: href({ aba: undefined }), active: !evolution },
        { label: "Evolução", href: href({ aba: "evolucao" }), active: evolution },
        { label: "Cartões", href: reportHref("/cartoes", { painelMes: dashboardMonth ?? undefined }), active: false },
        { label: "Conexões", href: "/conexoes", active: false },
      ]} />
      {evolution ? <BalanceEvolution banks={banks} /> : (
        <>
          <div className="report-columns">
            <AccountBalances banks={banks} activeAccount={account?.id} />
            <InvestmentBalances banks={banks} />
          </div>
          {account && <AccountStatement account={account} />}
        </>
      )}
    </ReportLayout>
  );
}

function InvestmentBalances({ banks }: { banks: ReadonlySet<string> }) {
  const { href } = useReportQuery();
  const { investments, positions, failedInvestments } = useFinancialReports();
  const visible = investments.filter(position => !banks.size || banks.has(position.bank));
  if (!investments.length && !failedInvestments) return <SectionCard id="saldos-investimentos" title="Investimentos" highlighted>
    <p className="report-muted">Nenhum investimento acompanhado.</p>
  </SectionCard>;
  const tracked = positions.filter(position => !banks.size || banks.has(position.bank));
  return <SectionCard id="saldos-investimentos" title="Investimentos" highlighted
    description="Investimentos indicados como incluídos no saldo da conta são contados uma única vez.">
    <ReportMetrics items={[{ label: "Saldo consolidado acompanhado", value: tracked.every(position => position.balanceCents !== null)
      ? formatMoney(tracked.reduce((sum, position) => sum + (position.balanceCents ?? 0), 0)) : "Indisponível" }]} />
    {failedInvestments ? <p className="report-muted" role="status">Parte dos investimentos está indisponível. O total pode estar incompleto.</p> : null}
    <BreakdownList rows={visible.map(position => ({
      key: position.id,
      label: <Link className="report-link report-action" href={href({ investimento: position.id, aba: undefined })}>{position.name}</Link>,
      value: formatAvailableMoney(position.balanceCents),
    }))} />
  </SectionCard>;
}

function AccountBalances({ banks, activeAccount }: { banks: ReadonlySet<string>; activeAccount?: string }) {
  const { href } = useReportQuery();
  const { accounts, asOf } = useFinancialReports();
  const visible = accounts.filter(account => !banks.size || banks.has(account.bank));
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
  const directions = optionValues(params, "direcao", flowOptions);
  const movements = reportedTransactions
    .filter(transaction => transaction.accountId === account.id && period.includes(transaction.date))
    .map(transaction => ({ transaction, impact: bankBalanceImpact(transaction) }));
  const incoming = movements.reduce((sum, { impact }) => sum + Math.max(impact, 0), 0);
  const outgoing = movements.reduce((sum, { impact }) => sum - Math.min(impact, 0), 0);
  const rows = orderedTransactions(movements.filter(({ impact }) =>
    !directions.size || (directions.has("in") && impact > 0) || (directions.has("out") && impact < 0),
  ));
  const dashboardMonth = params.get("painelMes") ?? undefined;

  return (
    <SectionCard id="extrato" title="Extrato" description={`${account.bank} · ${account.name}`}>
      <div className="report-filters">
        <PeriodFields period={period} update={update} />
        <ReportMultiSelect label="Movimentação" placeholder="Todas as movimentações" selectionLabel="Movimentações"
          selected={directions} options={flowOptions} onChange={values => update({ direcao: values })} labeled />
      </div>
      <ReportMetrics items={[
        { label: "Entradas no período", value: formatMoney(incoming) },
        { label: "Saídas no período", value: formatMoney(outgoing) },
      ]} />
      <TransactionTable label="Extrato da conta" rows={rows} balanceScope="account" getHref={id => reportHref("/lancamentos", { painelMes: dashboardMonth, lancamento: id })} />
    </SectionCard>
  );
}

function BalanceEvolution({ banks }: { banks: ReadonlySet<string> }) {
  const { params, update } = useReportQuery();
  const { live, balanceHistory, balanceChartPoint } = useFinancialReports();
  const { points: history, partial, description, emptyMessage } = balanceHistory(banks);
  const institution = banks.size === 1 ? [...banks][0] : undefined;
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
          series={[{ label: partial ? "Saldo das contas com histórico" : institution ?? "Saldo consolidado", style: "actual" }]}
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
