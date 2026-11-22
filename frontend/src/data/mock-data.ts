import type { AccountBalance, Transaction } from "../lib/finance";
import type { ReportCard } from "./financial-data";

// The fixture represents a fixed reporting date in America/Sao_Paulo.
export const mockAsOf = "2026-11-14";

export const mockAccounts = [
  { id: "itau-corrente", bank: "Itaú", name: "Conta corrente", balanceCents: 742015 },
  { id: "itau-poupanca", bank: "Itaú", name: "Poupança", balanceCents: 200000 },
  { id: "nubank-conta", bank: "Nubank", name: "Conta digital", balanceCents: 612250 },
  { id: "inter-conta", bank: "Inter", name: "Conta digital", balanceCents: 320000 },
] satisfies (AccountBalance & { id: string; name: string })[];

export const mockCards = [
  {
    id: "itau-4821", bank: "Itaú", lastFour: "4821", usedCents: 248000, limitCents: 900000,
    openInvoice: { dueDate: "2026-11-26", transactionIds: ["hotel", "notebook-2"] },
    installments: ["2026-12", "2027-01", "2027-02", "2027-03"].map((month, index) => ({
      id: `notebook-plan-${month}`, transactionId: "notebook-1", name: "Notebook", category: "Compras",
      date: `${month}-13`, number: index + 3, count: 6, amountCents: 42000,
    })),
  },
  {
    id: "nubank-7032", bank: "Nubank", lastFour: "7032", usedCents: 124840, limitCents: 600000,
    openInvoice: { dueDate: "2026-11-24", transactionIds: ["restaurant", "cinema"] },
    installments: ["2026-12", "2027-01", "2027-02"].map((month, index) => ({
      id: `chair-plan-${month}`, name: "Cadeira ergonômica", category: "Moradia",
      date: `${month}-24`, number: index + 4, count: 6, amountCents: 35020,
    })),
  },
] satisfies ReportCard[];

export const mockBalanceSnapshots = [
  { month: "2026-05", balances: [438000, 164000, 330000, 250000] },
  { month: "2026-06", balances: [450000, 165000, 350000, 250000] },
  { month: "2026-07", balances: [510000, 170000, 435000, 265000] },
  { month: "2026-08", balances: [420000, 180000, 440000, 275000] },
  { month: "2026-09", balances: [590000, 185000, 490000, 295000] },
  { month: "2026-10", balances: [620000, 190000, 570000, 310000] },
].map(({ month, balances }) => ({
  month,
  accounts: mockAccounts.map((account, index) => ({ ...account, balanceCents: balances[index] })),
}));

type MockPurchase = [day: number, name: string, merchantType: string, cents: number];

const purchasesByMonth: Record<string, MockPurchase[]> = {
  "2026-06": [
    [5, "Aluguel", "rent", 95000],
    [8, "Supermercado", "groceries", 38670],
    [12, "Farmácia", "pharmacy", 17500],
    [17, "Posto", "fuel", 19800],
    [26, "Restaurante", "restaurant", 9850],
  ],
  "2026-07": [
    [5, "Aluguel", "rent", 95000],
    [7, "Supermercado", "groceries", 57630],
    [11, "Hotel", "hotel", 72780],
    [16, "Transporte por aplicativo", "ride", 11550],
    [25, "Farmácia", "pharmacy", 10250],
  ],
  "2026-08": [
    [2, "Supermercado", "groceries", 27500],
    [5, "Aluguel", "rent", 95000],
    [7, "Posto", "fuel", 20500],
    [9, "Hotel", "hotel", 56200],
    [12, "Cinema", "cinema", 8400],
    [16, "Supermercado", "groceries", 27500],
    [18, "Farmácia", "pharmacy", 36000],
    [23, "Restaurante", "restaurant", 25000],
    [28, "Hotel", "hotel", 56000],
  ],
  "2026-09": [
    [1, "Transporte por aplicativo", "ride", 5400],
    [3, "Farmácia", "pharmacy", 16900],
    [5, "Aluguel", "rent", 95000],
    [8, "Supermercado", "groceries", 39800],
    [11, "Posto", "fuel", 23500],
    [13, "Restaurante", "restaurant", 18500],
    [15, "Reserva de hotel", "hotel", 128000],
    [21, "Cinema", "cinema", 33400],
    [25, "Supermercado", "groceries", 49700],
    [30, "Farmácia", "pharmacy", 15900],
  ],
  "2026-10": [
    [2, "Posto", "fuel", 21000],
    [4, "Supermercado", "groceries", 34500],
    [6, "Aluguel", "rent", 95000],
    [8, "Cinema", "cinema", 13700],
    [10, "Farmácia", "pharmacy", 45800],
    [13, "Restaurante", "restaurant", 19800],
    [16, "Supermercado", "groceries", 44200],
    [20, "Consulta médica", "medical", 48500],
    [24, "Restaurante", "restaurant", 24800],
    [29, "Hotel", "hotel", 52400],
    [31, "Posto", "fuel", 18000],
  ],
};

const historicalPurchases = Object.entries(purchasesByMonth).flatMap(([month, purchases]) =>
  purchases.map(([day, name, merchantType, amountCents], index): Transaction => ({
    id: `${month}-${index}`,
    date: `${month}-${String(day).padStart(2, "0")}`,
    kind: "expense",
    name,
    merchantType,
    amountCents,
    accountId: merchantType === "rent" ? "itau-corrente" : "nubank-conta",
    expectsRefund: month === "2026-07" && merchantType === "hotel",
  })),
);

const eventTags = ["Mostra de cinema"];

export const mockTransactions: Transaction[] = [
  ...historicalPurchases,
  { id: "booking", date: "2026-09-20", kind: "expense", name: "Reserva cancelada", merchantType: "hotel", amountCents: 45900, accountId: "inter-conta" },
  { id: "booking-refund", date: "2026-09-23", kind: "refund", name: "Reembolso da reserva", expenseId: "booking", amountCents: 45900, accountId: "inter-conta" },
  { id: "notebook-1", date: "2026-10-26", kind: "expense", name: "Notebook", category: "Compras", amountCents: 42000, cardId: "itau-4821", installment: { number: 1, count: 6 } },
  { id: "course-6", date: "2026-10-27", kind: "expense", name: "Curso", category: "Educação", amountCents: 8500, cardId: "itau-4821", installment: { number: 6, count: 6 } },
  { id: "hotel", date: "2026-10-30", kind: "expense", name: "Hotel", merchantType: "hotel", amountCents: 80000, cardId: "itau-4821", expectsRefund: true },
  { id: "market", date: "2026-11-02", kind: "expense", name: "Supermercado", merchantType: "groceries", amountCents: 18420, accountId: "nubank-conta" },
  { id: "salary", date: "2026-11-05", kind: "income", name: "Salário", amountCents: 685000, accountId: "itau-corrente" },
  { id: "rent", date: "2026-11-06", kind: "expense", name: "Aluguel", merchantType: "rent", amountCents: 95000, accountId: "itau-corrente", paymentMethod: "pix" },
  { id: "restaurant", date: "2026-11-07", kind: "expense", name: "Restaurante", merchantType: "restaurant", amountCents: 12580, cardId: "nubank-7032", tags: eventTags },
  { id: "cinema", date: "2026-11-08", kind: "expense", name: "Cinema", merchantType: "cinema", amountCents: 7200, cardId: "nubank-7032", tags: eventTags },
  { id: "fuel", date: "2026-11-10", kind: "expense", name: "Posto", merchantType: "fuel", amountCents: 23000, accountId: "inter-conta" },
  { id: "hotel-refund", date: "2026-11-11", kind: "refund", name: "Reembolso do hotel", expenseId: "hotel", amountCents: 50000, accountId: "itau-corrente" },
  { id: "ride", date: "2026-11-12", kind: "expense", name: "Transporte por aplicativo", merchantType: "ride", amountCents: 3850, accountId: "nubank-conta", tags: eventTags },
  { id: "card-payment", date: "2026-11-13", kind: "transfer", name: "Pagamento de fatura", amountCents: 160000, accountId: "itau-corrente" },
  { id: "notebook-2", date: "2026-11-13", kind: "expense", name: "Notebook", category: "Compras", amountCents: 42000, cardId: "itau-4821", installment: { number: 2, count: 6 } },
  { id: "unclassified", date: "2026-11-14", kind: "expense", name: "Compra no débito", amountCents: 9500, accountId: "nubank-conta", paymentMethod: "debit_card" },
];

export const mockSpendingMonths = [mockAsOf.slice(0, 7), ...Object.keys(purchasesByMonth).reverse()];
