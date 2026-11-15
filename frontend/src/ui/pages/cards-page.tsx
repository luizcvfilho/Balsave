"use client";

import Link from "next/link";
import { BreakdownList } from "../../components/cards/breakdown-list";
import { SectionCard } from "../../components/cards/section-card";
import { ReportLayout } from "../../components/details/report-layout";
import { ReportMetrics } from "../../components/details/report-metrics";
import { useReportQuery } from "../../components/details/report-query";
import { orderedTransactions, TransactionTable } from "../../components/details/transaction-table";
import { mockCards } from "../../data/mock-data";
import { reportedTransactions } from "../../data/mock-reports";
import { summarizeCards } from "../../lib/finance";
import { formatDate, formatMoney, formatMonth } from "../../lib/format";
import { reportHref } from "../../lib/report-links";

const totals = summarizeCards(mockCards);

function limitMetrics({ limitCents, usedCents }: typeof totals) {
  return [
    { label: "Limite total", value: formatMoney(limitCents) },
    { label: "Limite usado", value: formatMoney(usedCents) },
    { label: "Limite disponível", value: formatMoney(limitCents - usedCents) },
  ];
}

export function CardsPage() {
  const { params, href } = useReportQuery();
  const activeCard = mockCards.find(card => card.id === params.get("cartao"));
  const dashboardMonth = params.get("painelMes");
  const charges = activeCard ? reportedTransactions.filter(transaction => transaction.cardId === activeCard.id
    && transaction.kind === "expense" && activeCard.openInvoice.transactionIds.includes(transaction.id)) : [];
  const invoice = charges.reduce((sum, charge) => sum + charge.amountCents, 0);

  return (
    <ReportLayout title="Cartões" dashboardMonth={dashboardMonth}>
      <SectionCard id="limites" title="Limites dos cartões">
        <ReportMetrics items={limitMetrics(totals)} />
        {/* biome-ignore lint/a11y/noRedundantRoles: Safari can omit the list role when markers are hidden. */}
        <ul className="report-list" role="list">
          {mockCards.map(card => (
            <li key={card.id} className="report-list-item">
              <Link className="report-link report-action" href={`${href({ cartao: card.id })}#fatura`} aria-current={activeCard?.id === card.id ? "true" : undefined}>
                {card.bank} · final {card.lastFour}
              </Link>
              <ReportMetrics items={limitMetrics(card)} />
            </li>
          ))}
        </ul>
      </SectionCard>
      {activeCard && (
        <>
          <SectionCard id="fatura" title="Fatura aberta" description={`${activeCard.bank} · final ${activeCard.lastFour}`}>
            <ReportMetrics items={[
              { label: "Total da fatura aberta", value: formatMoney(invoice) },
              { label: "Vencimento", value: formatDate(activeCard.openInvoice.dueDate) },
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
    </ReportLayout>
  );
}
