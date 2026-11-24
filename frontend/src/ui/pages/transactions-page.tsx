"use client";

import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useState } from "react";
import { SectionCard } from "../../components/cards/section-card";
import { CategoryEditor } from "../../components/details/category-editor";
import { DemoRefundDetail, DemoRefunds } from "../../components/details/demo-refunds";
import { ReceivableDetail, ReceivablesList } from "../../components/details/receivable-view";
import { ReceiptEditor, useReceiptAnnotations } from "../../components/details/receipt-annotations";
import { matchesSearch, PeriodFields, usePeriod, ReportSelect, SearchField } from "../../components/details/report-filters";
import { ReportLayout, ReportNavigation } from "../../components/details/report-layout";
import { ReportMetrics } from "../../components/details/report-metrics";
import { useReportQuery } from "../../components/details/report-query";
import { TagEditor } from "../../components/details/tag-editor";
import { TagFilter, useTagFilter } from "../../components/details/tag-filter";
import { kindOptions, orderOptions, useCategoryOptions } from "../../components/details/transaction-filters";
import { orderedTransactions, TransactionTable } from "../../components/details/transaction-table";
import { useFinancialReports } from "../../data/financial-reports";
import { bankBalanceImpact, isIncoming, matchesTransactionTags, type Transaction, transactionCategory, transactionCategoryKey, transactionKindLabels, transactionTotals } from "../../lib/finance";
import { formatDate, formatMoney, formatSignedMoney } from "../../lib/format";
import { optionValue, reportHref } from "../../lib/report-links";

export function TransactionsPage() {
  const { params, href } = useReportQuery();
  const tagFilter = useTagFilter(params);
  const { live, reportedTransactions } = useFinancialReports();
  const dashboardMonth = params.get("painelMes");
  const refunds = params.get("aba") === "reembolsos";
  const receivables = live && params.get("aba") === "a-receber";
  const id = params.get("lancamento");
  const selected = reportedTransactions.find(transaction => transaction.id === id);
  const [search, setSearch] = useState("");
  const transactionHref = (entryId: string) => href({ lancamento: entryId });

  if (id) {
    const fromReceivables = params.get("origem") === "a-receber";
    const query = new URLSearchParams(params);
    query.delete("lancamento");
    query.delete("origem");
    return (
      <ReportLayout
        title="Detalhe do lançamento"
        dashboardMonth={dashboardMonth}
        back={fromReceivables ? { href: reportHref("/a-receber", query), label: "Voltar para A receber" } : {
          href: href({ lancamento: undefined }),
          label: receivables ? "Voltar a receber" : refunds ? "Voltar aos reembolsos" : "Voltar aos lançamentos",
        }}
      >
        {selected ? <TransactionDetail key={selected.id} transaction={selected} /> : (
          <SectionCard id="lancamento-ausente" title="Lançamento não encontrado">
            <p className="report-muted">Volte aos lançamentos para selecionar outro item.</p>
          </SectionCard>
        )}
      </ReportLayout>
    );
  }

  return (
    <ReportLayout title="Lançamentos" dashboardMonth={dashboardMonth} dashboardTags={tagFilter.query}>
      <ReportNavigation label="Detalhes de lançamentos" options={[
        { label: "Todos os lançamentos", href: href({ aba: undefined }), active: !refunds && !receivables },
        ...(live ? [{ label: "A receber", href: reportHref("/a-receber", { painelMes: dashboardMonth ?? undefined, etiquetas: tagFilter.query }), active: receivables }] : [{ label: "Reembolsos", href: href({ aba: "reembolsos" }), active: refunds }]),
      ]} />
      {receivables ? <ReceivablesList transactionHref={transactionHref} /> : refunds && !live ? <DemoRefunds transactionHref={transactionHref} /> : <TransactionLedger search={search} setSearch={setSearch} tagFilter={tagFilter} />}
    </ReportLayout>
  );
}

function TransactionLedger({ search, setSearch, tagFilter }: {
  search: string;
  setSearch: (value: string) => void;
  tagFilter: ReturnType<typeof useTagFilter>;
}) {
  const { params, href, update } = useReportQuery();
  const { live, reportedTransactions, receivableCredits } = useFinancialReports();
  const [editingId, setEditingId] = useState<string>();
  const annotations = useReceiptAnnotations(!live);
  const period = usePeriod(params);
  const ledgerCategoryOptions = useCategoryOptions(true);
  const types = live ? kindOptions : kindOptions.filter(option => option.value !== "credit");
  const type = optionValue(params.get("tipo"), types.map(option => option.value));
  const category = optionValue(params.get("categoria"), ledgerCategoryOptions.map(option => option.value));
  const order = optionValue(params.get("ordem"), orderOptions.map(option => option.value), "recent");
  const tagNames = new Map(tagFilter.tags.map(tag => [tag.id, tag.name]));
  const editing = editingId ? reportedTransactions.find(transaction => transaction.id === editingId) : undefined;

  function transactionTagNames(transaction: Transaction) {
    return transaction.tagIds?.map(id => tagNames.get(id)) ?? [];
  }

  function renderTags(transaction: Transaction) {
    if (transaction.tagIds === undefined) return "—";
    const names = transactionTagNames(transaction).filter(Boolean).join(" · ");
    return (
      <button
        className="report-link report-action"
        type="button"
        aria-haspopup="dialog"
        aria-label={names ? `Editar etiquetas de ${transaction.name}: ${names}` : `Adicionar etiquetas a ${transaction.name}`}
        onClick={() => setEditingId(transaction.id)}
      >
        {names || "Adicionar etiquetas"}
      </button>
    );
  }

  const matches = reportedTransactions.flatMap(transaction => {
    const annotation = annotations[transaction.id];
    const receivable = receivableCredits.get(transaction.id);
    const appliedCents = receivable?.appliedCents ?? 0;
    const labels = [
      annotation?.classification,
      appliedCents > 0 ? `Reembolso: ${formatMoney(appliedCents)}` : undefined,
      receivable?.surplusCents ? `Excedente: ${formatMoney(receivable.surplusCents)}` : undefined,
      ...(transaction.tags ?? []),
      ...(annotation?.tags ?? []),
    ];
    const matchesType = !type || (type === "refund" && appliedCents > 0)
      || (transaction.kind === type && (!appliedCents || appliedCents < transaction.amountCents));
    if (!period.includes(transaction.date)
      || !matchesTransactionTags(transaction, tagFilter.selected)
      || !matchesType
      || (category && transactionCategoryKey(transaction) !== category)
      || !matchesSearch(search, transaction.name, ...labels, ...transactionTagNames(transaction))) return [];
    return [{ transaction, annotation: labels.filter(Boolean).join(" · ") }];
  });
  const rows = orderedTransactions(matches, order);
  const totals = transactionTotals(rows.map(row => row.transaction));

  return (
    <SectionCard id="historico-lancamentos" title="Histórico de lançamentos"
      description="Verde indica entradas externas, vermelho indica saídas externas e cinza indica movimentações internas ou lançamentos sem efeito no saldo.">
      <div className="report-filters">
        <PeriodFields period={period} update={update} />
        <ReportSelect label="Tipo" value={type} options={types} onChange={value => update({ tipo: value })} />
        <ReportSelect label="Categoria" value={category} options={ledgerCategoryOptions} onChange={value => update({ categoria: value })} />
        <SearchField value={search} onChange={setSearch} />
        <ReportSelect label="Ordenar por" value={order} options={orderOptions} onChange={value => update({ ordem: value })} />
        <TagFilter tags={tagFilter.tags} selected={tagFilter.selected} update={update} />
      </div>
      <p className="report-muted" role="status">{rows.length} {rows.length === 1 ? "lançamento" : "lançamentos"}</p>
      {live && <ReportMetrics items={[
        { label: "Entradas", value: formatMoney(totals.incomingCents) },
        { label: "Saídas", value: formatMoney(totals.outgoingCents) },
        { label: "Total líquido", value: formatMoney(totals.netCents) },
      ]} />}
      <TransactionTable
        label="Lançamentos filtrados"
        rows={rows}
        balanceScope="consolidated"
        getHref={id => href({ lancamento: id })}
        renderTags={live ? renderTags : undefined}
      />
      {live && editing?.tagIds !== undefined && (
        <Dialog
          open
          fullWidth
          onClose={() => setEditingId(undefined)}
          aria-labelledby="etiquetas-dialog-title"
          aria-describedby="etiquetas-dialog-transaction"
          slotProps={{ paper: { sx: { bgcolor: "var(--surface)", color: "var(--text-primary)", borderRadius: "var(--radius-card)", m: { xs: 2, sm: 4 } } } }}
        >
          <DialogTitle id="etiquetas-dialog-title">Editar etiquetas</DialogTitle>
          <DialogContent dividers>
            <DialogContentText id="etiquetas-dialog-transaction" sx={{ mb: 2 }}>{editing.name}</DialogContentText>
            <TagEditor key={editing.id} entryId={editing.id} tagIds={editing.tagIds} tags={tagFilter.tags} />
          </DialogContent>
          <DialogActions>
            <button className="report-button" type="button" onClick={() => setEditingId(undefined)}>Fechar</button>
          </DialogActions>
        </Dialog>
      )}
    </SectionCard>
  );
}

function TransactionDetail({ transaction }: { transaction: Transaction }) {
  const { href } = useReportQuery();
  const { live, tags, transactionSource, receivableCredits } = useFinancialReports();
  const annotations = useReceiptAnnotations(!live);
  const source = transactionSource(transaction);
  const impact = bankBalanceImpact(transaction);
  const receivable = receivableCredits.get(transaction.id);

  return (
    <>
      <SectionCard id="detalhe-lancamento" title={transaction.name} description={formatDate(transaction.date)}>
        <ReportMetrics items={[
          { label: "Valor", value: formatSignedMoney(isIncoming(transaction) ? transaction.amountCents : -transaction.amountCents) },
          { label: transaction.accountId ? "Impacto nesta conta" : transaction.investmentId ? "Impacto neste investimento" : "Impacto no saldo em contas", value: impact === 0 ? "Sem efeito" : formatSignedMoney(impact) },
          { label: "Tipo", value: receivable?.appliedCents === transaction.amountCents ? "Reembolso" : transactionKindLabels[transaction.kind] },
          ...(receivable?.appliedCents ? [{ label: "Reembolso", value: formatMoney(receivable.appliedCents) }] : []),
          ...(receivable?.surplusCents ? [{ label: "Excedente", value: formatMoney(receivable.surplusCents) }] : []),
          { label: "Categoria", value: transactionCategory(transaction) },
          ...(transaction.tags?.length ? [{ label: "Tags", value: transaction.tags.join(" · ") }] : []),
          ...(source ? [{ label: "Conta ou cartão", value: source }] : []),
        ]} />
      </SectionCard>
      {transaction.kind === "expense" && <CategoryEditor transaction={transaction} />}
      {live && <ReceivableDetail transaction={transaction} />}
      {live && transaction.tagIds !== undefined && (
        <SectionCard id="etiquetas-lancamento" title="Etiquetas">
          <TagEditor entryId={transaction.id} tagIds={transaction.tagIds} tags={tags} />
        </SectionCard>
      )}
      <DemoRefundDetail transaction={transaction} transactionHref={id => href({ lancamento: id })} />
      {!live && (transaction.kind === "income" || transaction.kind === "refund") && (
        <SectionCard id="classificacao-recebimento" title="Classificação e tags">
          <ReceiptEditor id={transaction.id} annotation={annotations[transaction.id]} />
        </SectionCard>
      )}
    </>
  );
}
