import { expenses } from "../../data/mock-reports";
import { transactionCategory, transactionKindLabels } from "../../lib/finance";

export const expenseCategories = Array.from(new Set(expenses.map(({ expense }) => transactionCategory(expense))))
  .sort((first, second) => first.localeCompare(second, "pt-BR"));

export const expenseCategoryOptions = [
  { value: "", label: "Todas as categorias" },
  ...expenseCategories.map(category => ({ value: category, label: category })),
];

export const ledgerCategoryOptions = [
  ...expenseCategoryOptions,
  ...["Receitas", "Reembolso", "Transferência"].map(category => ({ value: category, label: category })),
];

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
