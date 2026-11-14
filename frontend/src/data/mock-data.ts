import type { AccountBalance, CreditCard, Transaction } from "../lib/finance";

// The fixture represents a fixed reporting date in America/Sao_Paulo.
export const mockAsOf = "2026-11-14";

export const mockAccounts = [
  { bank: "Itaú", balanceCents: 742015 },
  { bank: "Itaú", balanceCents: 200000 },
  { bank: "Nubank", balanceCents: 612250 },
  { bank: "Inter", balanceCents: 320000 },
] satisfies AccountBalance[];

export const mockCards = [
  { bank: "Itaú", lastFour: "4821", usedCents: 248000, limitCents: 900000 },
  { bank: "Nubank", lastFour: "7032", usedCents: 124840, limitCents: 600000 },
] satisfies CreditCard[];

export const mockBalanceHistory = [
  { month: "2026-06", cents: 1215000 },
  { month: "2026-07", cents: 1380000 },
  { month: "2026-08", cents: 1315000 },
  { month: "2026-09", cents: 1560000 },
  { month: "2026-10", cents: 1690000 },
];

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
  })),
);

export const mockTransactions: Transaction[] = [
  ...historicalPurchases,
  { id: "market", date: "2026-11-02", kind: "expense", name: "Supermercado", merchantType: "groceries", amountCents: 18420 },
  { id: "salary", date: "2026-11-05", kind: "income", name: "Salário", amountCents: 685000 },
  { id: "rent", date: "2026-11-06", kind: "expense", name: "Aluguel", merchantType: "rent", amountCents: 95000 },
  { id: "restaurant", date: "2026-11-07", kind: "expense", name: "Restaurante", merchantType: "restaurant", amountCents: 12580 },
  { id: "cinema", date: "2026-11-08", kind: "expense", name: "Cinema", merchantType: "cinema", amountCents: 7200 },
  { id: "hotel", date: "2026-11-09", kind: "expense", name: "Hotel", merchantType: "hotel", amountCents: 80000 },
  { id: "fuel", date: "2026-11-10", kind: "expense", name: "Posto", merchantType: "fuel", amountCents: 23000 },
  { id: "hotel-refund", date: "2026-11-11", kind: "refund", name: "Reembolso do hotel", expenseId: "hotel", amountCents: 50000 },
  { id: "ride", date: "2026-11-12", kind: "expense", name: "Transporte por aplicativo", merchantType: "ride", amountCents: 3850 },
  { id: "card-payment", date: "2026-11-13", kind: "transfer", name: "Pagamento de fatura", amountCents: 160000 },
  { id: "unclassified", date: "2026-11-14", kind: "expense", name: "Compra no débito", amountCents: 9500 },
];

export const mockSpendingMonths = [mockAsOf.slice(0, 7), ...Object.keys(purchasesByMonth).reverse()];
