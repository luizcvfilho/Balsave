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
import { matchesSearch, PeriodFields, ReportMultiSelect, ReportSelect, SearchField, usePeriod } from "../../components/details/report-filters";
import { ReportLayout, ReportNavigation } from "../../components/details/report-layout";
import { ReportMetrics } from "../../components/details/report-metrics";
import { useReportQuery } from "../../components/details/report-query";
import { TagEditor } from "../../components/details/tag-editor";
import { TagFilter, useTagFilter } from "../../components/details/tag-filter";
import { CategoryChip, TagChip } from "../../components/details/transaction-classification";
import { kindOptions, orderOptions, useCategoryOptions } from "../../components/details/transaction-filters";
import { InstitutionLabel, orderedTransactions, TransactionTable } from "../../components/details/transaction-table";
import { cardLabel } from "../../data/financial-data";
import { useFinancialReports } from "../../data/financial-reports";
import { bankBalanceImpact, isIncoming, matchesTransactionTags, type Transaction, transactionCategory, transactionCategoryKey, transactionKindLabels, transactionTotals } from "../../lib/finance";
import { formatDate, formatMoney, formatNumericDate, formatSignedMoney } from "../../lib/format";
import { optionValue, optionValues, reportHref } from "../../lib/report-links";
import styles from "./transactions-page.module.css";

export function TransactionsPage() {
  const { params, href, update } = useReportQuery();
  const tagFilter = useTagFilter(params);
  const { live, reportedTransactions } = useFinancialReports();
  const dashboardMonth = params.get("painelMes");
  const refunds = !live && params.get("aba") === "reembolsos";
  const receivables = live && params.get("aba") === "a-receber";
  const id = params.get("lancamento");
  const period = usePeriod(params);
  const selected = reportedTransactions.find(transaction => transaction.id === id);
  const [search, setSearch] = useState("");
  const transactionHref = (entryId: string) => href({ lancamento: entryId });
  const receivablesQuery = new URLSearchParams(params);
  receivablesQuery.delete("aba");

  if (id) {
    const fromReceivables = params.get("origem") === "a-receber";
    const query = new URLSearchParams(params);
    query.delete("lancamento");
    query.delete("origem");
    return (
      <ReportLayout
        title={selected?.name ?? "Lançamento indisponível"}
        description={selected ? `${formatNumericDate(selected.date)} · Detalhe do lançamento` : undefined}
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
    <ReportLayout title="Lançamentos" description="Consulte entradas, saídas e classificações."
      dashboardMonth={dashboardMonth} dashboardTags={tagFilter.query}
      controls={!refunds && !receivables && (
        <div className="report-filters report-heading-filters">
          <PeriodFields period={period} update={update} compact />
          <TagFilter tags={tagFilter.tags} selected={tagFilter.selected} update={update} />
        </div>
      )}>
      <ReportNavigation label="Detalhes do extrato" options={[
        { label: "Lançamentos", href: href({ aba: undefined }), active: !refunds && !receivables },
        { label: "A receber", href: reportHref("/a-receber", receivablesQuery), active: receivables || refunds },
      ]} />
      {receivables ? <ReceivablesList transactionHref={transactionHref} /> : refunds ? <DemoRefunds transactionHref={transactionHref} /> : <TransactionLedger period={period} search={search} setSearch={setSearch} tagFilter={tagFilter} />}
    </ReportLayout>
  );
}

function TransactionLedger({ period, search, setSearch, tagFilter }: {
  period: ReturnType<typeof usePeriod>;
  search: string;
  setSearch: (value: string) => void;
  tagFilter: ReturnType<typeof useTagFilter>;
}) {
  const { params, href, update } = useReportQuery();
  const { live, accounts, cards, investments, reportedTransactions, receivableCredits, transactionInstitution } = useFinancialReports();
  const [editingId, setEditingId] = useState<string>();
  const annotations = useReceiptAnnotations(!live);
  const ledgerCategoryOptions = useCategoryOptions(true);
  const typeOptions = live ? kindOptions : kindOptions.filter(option => option.value !== "credit");
  const types = optionValues(params, "tipo", typeOptions);
  const categories = optionValues(params, "categoria", ledgerCategoryOptions);
  const order = optionValue(params.get("ordem"), orderOptions.map(option => option.value), "recent");
  const bankOptions = [...new Set([...accounts, ...cards, ...investments].map(source => source.bank))]
    .sort((a, b) => a.localeCompare(b, "pt-BR")).map(bank => ({ value: bank, label: bank }));
  const banks = optionValues(params, "banco", bankOptions);
  const cardOptions = cards.filter(card => !banks.size || banks.has(card.bank))
    .map(card => ({ value: card.id, label: cardLabel(card) }));
  const cardIds = optionValues(params, "cartao", cardOptions);
  const tagNames = new Map(tagFilter.tags.map(tag => [tag.id, tag.name]));
  const editing = editingId ? reportedTransactions.find(transaction => transaction.id === editingId) : undefined;

  function transactionTagNames(transaction: Transaction) {
    return transaction.tagIds?.map(id => tagNames.get(id)) ?? [];
  }

  function renderTags(transaction: Transaction) {
    if (transaction.tagIds === undefined) return null;
    const tags = transaction.tagIds.flatMap(id => {
      const label = tagNames.get(id);
      return label ? [{ id, label }] : [];
    });
    const names = tags.map(tag => tag.label).join(", ");
    return (
      <button
        className={styles.tagButton}
        type="button"
        aria-haspopup="dialog"
        aria-label={names ? `Editar etiquetas de ${transaction.name}: ${names}` : `Adicionar etiquetas a ${transaction.name}`}
        onClick={() => setEditingId(transaction.id)}
      >
        {tags.length ? tags.map(tag => <TagChip key={tag.id} {...tag} />) : "Adicionar etiquetas"}
      </button>
    );
  }

  const matches = reportedTransactions.flatMap(transaction => {
    const annotation = annotations[transaction.id];
    const origin = transactionInstitution(transaction);
    const receivable = receivableCredits.get(transaction.id);
    const appliedCents = receivable?.appliedCents ?? 0;
    const labels = [
      annotation?.classification,
      appliedCents > 0 ? `Reembolso: ${formatMoney(appliedCents)}` : undefined,
      receivable?.surplusCents ? `Excedente: ${formatMoney(receivable.surplusCents)}` : undefined,
    ];
    const tags = [...new Set([...(transaction.tags ?? []), ...(annotation?.tags ?? [])])];
    const matchesType = !types.size || (types.has("refund") && appliedCents > 0)
      || (types.has(transaction.kind) && (!appliedCents || appliedCents < transaction.amountCents));
    if (!period.includes(transaction.date)
      || !matchesTransactionTags(transaction, tagFilter.selected)
      || !matchesType
      || (categories.size > 0 && !categories.has(transactionCategoryKey(transaction)))
      || (banks.size > 0 && (!origin || !banks.has(origin.bank)))
      || (cardIds.size > 0 && (!transaction.cardId || !cardIds.has(transaction.cardId)))
      || !matchesSearch(search, transaction.name, transactionCategory(transaction), origin?.label, ...labels, ...tags, ...transactionTagNames(transaction))) return [];
    return [{ transaction, annotation: labels.filter(Boolean).join(" · "), tags }];
  });
  const rows = orderedTransactions(matches, order);
  const totals = transactionTotals(rows.map(row => row.transaction));

  return (
    <div className={styles.ledger}>
      <div className={`report-filters ${styles.primaryFilters}`}>
        <SearchField value={search} onChange={setSearch} compact />
        <ReportMultiSelect label="Tipo" placeholder="Todos os tipos" selectionLabel="Tipos"
          selected={types} options={typeOptions} onChange={values => update({ tipo: values })} />
        <ReportMultiSelect label="Banco" placeholder="Todos os bancos" selectionLabel="Bancos"
          selected={banks} options={bankOptions} onChange={values => update({
            banco: values,
            cartao: cards.filter(card => cardIds.has(card.id) && (!values.length || values.includes(card.bank))).map(card => card.id),
          })} />
        <ReportMultiSelect label="Cartão" placeholder={cardOptions.length ? "Todos os cartões" : "Sem cartões"}
          selectionLabel="Cartões" selected={cardIds} options={cardOptions} onChange={values => update({ cartao: values })} />
      </div>
      <section id="historico-lancamentos" aria-labelledby="historico-lancamentos-title">
        <ReportMetrics items={[
          { label: "Entradas", value: formatMoney(totals.incomingCents) },
          { label: "Saídas", value: formatMoney(totals.outgoingCents) },
          { label: "Total líquido", value: formatMoney(totals.netCents) },
        ]} />
        <div className={styles.panel}>
          <header className={styles.panelHeading}>
            <h2 id="historico-lancamentos-title">Histórico de lançamentos</h2>
          </header>
          <p className="sr-only" role="status">{rows.length} {rows.length === 1 ? "lançamento" : "lançamentos"}</p>
          <details className={styles.secondaryFilters} open={Boolean(categories.size || order !== "recent") || undefined}>
            <summary>Mais filtros</summary>
            <div className="report-filters">
              <ReportMultiSelect label="Categoria" placeholder="Todas as categorias" selectionLabel="Categorias"
                selected={categories} options={ledgerCategoryOptions} onChange={values => update({ categoria: values })} labeled />
              <ReportSelect label="Ordenar por" value={order} options={orderOptions} onChange={value => update({ ordem: value })} />
            </div>
          </details>
          <TransactionTable
            label="Lançamentos filtrados"
            rows={rows}
            balanceScope="consolidated"
            getHref={id => href({ lancamento: id })}
            renderTags={live ? renderTags : undefined}
          />
        </div>
      </section>
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
    </div>
  );
}

function TransactionDetail({ transaction }: { transaction: Transaction }) {
  const { href } = useReportQuery();
  const { live, tags, transactionInstitution, receivableCredits } = useFinancialReports();
  const annotations = useReceiptAnnotations(!live);
  const origin = transactionInstitution(transaction);
  const impact = bankBalanceImpact(transaction);
  const receivable = receivableCredits.get(transaction.id);

  return (
    <>
      <SectionCard id="detalhe-lancamento" className="report-narrow" title={isIncoming(transaction) ? "Entrada" : "Saída"} description={formatDate(transaction.date)}>
        <ReportMetrics items={[
          { label: "Valor", value: formatSignedMoney(isIncoming(transaction) ? transaction.amountCents : -transaction.amountCents) },
          { label: transaction.accountId ? "Impacto nesta conta" : transaction.investmentId ? "Impacto neste investimento" : "Impacto no saldo em contas", value: impact === 0 ? "Sem efeito" : formatSignedMoney(impact) },
          { label: "Tipo", value: receivable?.appliedCents === transaction.amountCents ? "Reembolso" : transactionKindLabels[transaction.kind] },
          ...(receivable?.appliedCents ? [{ label: "Reembolso", value: formatMoney(receivable.appliedCents) }] : []),
          ...(receivable?.surplusCents ? [{ label: "Excedente", value: formatMoney(receivable.surplusCents) }] : []),
          { label: "Categoria", value: <CategoryChip categoryKey={transactionCategoryKey(transaction)}
            categoryId={transaction.kind === "expense" ? transaction.categoryId : undefined} label={transactionCategory(transaction)} /> },
          ...(origin ? [{ label: "Conta ou cartão", value: <InstitutionLabel bank={origin.bank} detail={origin.detail} /> }] : []),
          ...(transaction.tags?.length ? [{ label: "Etiquetas", value: <span className={styles.tagList}>
            {transaction.tags.map(tag => <TagChip key={tag} id={tag} label={tag} />)}
          </span> }] : []),
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
