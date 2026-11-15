import { useFinancialReports } from "../../data/financial-reports";
import { transactionKindLabels } from "../../lib/finance";

export function useCategoryOptions(ledger = false) {
  const { expenseCategories, live } = useFinancialReports();
  const categories = ledger
    ? [...new Set([...expenseCategories, "Receitas", "Reembolso", "Transferência", ...(live ? ["Crédito"] : [])])]
    : expenseCategories;
  return [
    { value: "", label: "Todas as categorias" },
    ...categories.map(category => ({ value: category, label: category })),
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
