"use client";

import Link from "next/link";
import { BreakdownList } from "../../components/cards/breakdown-list";
import { SectionCard } from "../../components/cards/section-card";
import { ReportLayout } from "../../components/details/report-layout";
import { ReportMetrics } from "../../components/details/report-metrics";
import { useReportQuery } from "../../components/details/report-query";
import { orderedTransactions, TransactionTable } from "../../components/details/transaction-table";
import { cardLabel, type ReportCard } from "../../data/financial-data";
import { useFinancialReports } from "../../data/financial-reports";
import { summarizeCards } from "../../lib/finance";
import { formatAvailableMoney, formatDate, formatMoney, formatMonth } from "../../lib/format";
import { reportHref } from "../../lib/report-links";

function limitMetrics({ limitCents, usedCents, availableCents }: Pick<ReportCard, "limitCents" | "usedCents" | "availableCents">) {
  const available = availableCents ?? (limitCents === null || usedCents === null ? null : limitCents - usedCents);
  return [
    { label: "Limite total", value: formatAvailableMoney(limitCents) },
    { label: "Limite usado", value: formatAvailableMoney(usedCents) },
    { label: "Limite disponível", value: formatAvailableMoney(available) },
  ];
}

export function CardsPage() {
  const { params, href } = useReportQuery();
  const { cards, live, reportedTransactions } = useFinancialReports();
  const totals = summarizeCards(cards);
  const activeCard = cards.find(card => card.id === params.get("cartao"));
  const dashboardMonth = params.get("painelMes");
  const cardEntries = activeCard ? reportedTransactions.filter(transaction => transaction.cardId === activeCard.id) : [];
  const openInvoice = activeCard?.openInvoice;
  const charges = openInvoice ? cardEntries.filter(transaction =>
    transaction.kind === "expense" && openInvoice.transactionIds.includes(transaction.id),
  ) : [];
  const invoice = charges.reduce((sum, charge) => sum + charge.amountCents, 0);

  return (
    <ReportLayout title="Cartões" dashboardMonth={dashboardMonth}>
      <SectionCard id="limites" title="Limites dos cartões">
        {cards.length ? <ReportMetrics items={limitMetrics(totals)} /> : (
          <p className="report-muted">Nenhum cartão em reais disponível.</p>
        )}
        {/* biome-ignore lint/a11y/noRedundantRoles: Safari can omit the list role when markers are hidden. */}
        <ul className="report-list" role="list">
          {cards.map(card => (
            <li key={card.id} className="report-list-item">
              <Link className="report-link report-action" href={`${href({ cartao: card.id })}#fatura`} aria-current={activeCard?.id === card.id ? "true" : undefined}>
                {cardLabel(card)}
              </Link>
              <ReportMetrics items={limitMetrics(card)} />
            </li>
          ))}
        </ul>
      </SectionCard>
      {activeCard && openInvoice && (
        <>
          <SectionCard id="fatura" title="Fatura aberta" description={cardLabel(activeCard)}>
            <ReportMetrics items={[
              { label: "Total da fatura aberta", value: formatMoney(invoice) },
              { label: "Vencimento", value: formatDate(openInvoice.dueDate) },
            ]} />
            <TransactionTable
              label="Compras da fatura aberta"
              rows={orderedTransactions(charges.map(transaction => ({ transaction })))}
              getHref={id => reportHref("/lancamentos", { painelMes: dashboardMonth ?? undefined, lancamento: id })}
              empty="Nenhuma compra nesta fatura."
            />
          </SectionCard>
          <SectionCard id="parcelas" title="Parcelas futuras">
            {activeCard.installments.length > 0 ? (
              <BreakdownList rows={activeCard.installments.map(installment => ({
                key: `${installment.name}/${installment.month}/${installment.number}`,
                label: `${formatMonth(installment.month)} · ${installment.name} · ${installment.number}/${installment.count}`,
                value: formatMoney(installment.amountCents),
              }))} />
            ) : <p className="report-muted">Nenhuma parcela futura.</p>}
          </SectionCard>
        </>
      )}
      {activeCard && live && (
        <SectionCard id="fatura" title="Lançamentos do cartão" description={cardLabel(activeCard)}>
          <p className="report-muted">Fatura aberta e parcelas futuras indisponíveis nesta consulta.</p>
          <TransactionTable
            label="Lançamentos efetivados do cartão"
            rows={orderedTransactions(cardEntries.map(transaction => ({ transaction })))}
            getHref={id => reportHref("/lancamentos", { painelMes: dashboardMonth ?? undefined, lancamento: id })}
          />
        </SectionCard>
      )}
    </ReportLayout>
  );
}
