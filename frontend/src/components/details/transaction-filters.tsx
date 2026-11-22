import { useFinancialReports } from "../../data/financial-reports";
import { transactionCategory, transactionCategoryKey, transactionKindLabels } from "../../lib/finance";

export function useCategoryOptions(ledger = false) {
  const { expenseCategories, reportedTransactions } = useFinancialReports();
  const categories = ledger
    ? [...new Map(reportedTransactions.map(transaction => [transactionCategoryKey(transaction), transactionCategory(transaction)])).entries()]
      .map(([value, label]) => ({ value, label })).sort((first, second) => first.label.localeCompare(second.label, "pt-BR"))
    : expenseCategories;
  return [
    { value: "", label: "Todas as categorias" },
    ...categories,
  ];
}

export const kindOptions = [
  { value: "", label: "Todos os tipos" },
  ...Object.entries(transactionKindLabels).map(([value, label]) => ({ value, label })),
];

export const orderOptions = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "highest", label: "Maior valor" },
  { value: "lowest", label: "Menor valor" },
];
