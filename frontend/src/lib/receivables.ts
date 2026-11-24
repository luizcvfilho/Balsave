import type { Expense, Transaction } from "./finance";

export type ReceivableGroup = {
  expenseId: string;
  expectations: { id: string; name: string; amountCents: number }[];
  receipts: { creditId: string; expectationId: string | null; amountCents: number }[];
};

export function deriveReceivables(groups: readonly ReceivableGroup[], transactions: readonly Transaction[], asOf: string, requireEligibility = false) {
  const entries = new Map(transactions.map(transaction => [transaction.id, transaction]));
  const available = new Map<string, number>();
  return groups.map(group => {
    const candidate = entries.get(group.expenseId);
    const expense: Expense | undefined = candidate?.kind === "expense" && candidate.date <= asOf
      && (!requireEligibility || candidate.receivableEligible === true) ? candidate : undefined;
    const expectations = group.expectations.map(item => ({ ...item, receivedCents: 0, remainingCents: item.amountCents }));
    const receipts = group.receipts.map(item => {
      const credit = entries.get(item.creditId);
      const valid = expense && credit && (credit.kind === "credit" || credit.kind === "income" || credit.kind === "refund")
        && credit.date >= expense.date && credit.date <= asOf && (!requireEligibility || credit.receivableEligible === true);
      const remaining = valid ? (available.get(item.creditId) ?? credit.amountCents) : 0;
      const eligibleCents = expense ? Math.max(0, Math.min(item.amountCents, remaining)) : 0;
      if (valid && expense) available.set(item.creditId, remaining - eligibleCents);
      return { ...item, credit, eligibleCents, appliedCents: 0, surplusCents: 0,
        incomplete: !expense || !valid || eligibleCents < item.amountCents
          || (item.expectationId !== null && !group.expectations.some(expectation => expectation.id === item.expectationId)),
        coverages: [] as { expectationId: string; amountCents: number }[] };
    });
    const grossCents = expense?.amountCents ?? 0;
    const plannedCents = expectations.reduce((sum, item) => sum + item.amountCents, 0);
    const reimbursableCents = Math.min(grossCents, expectations.length ? plannedCents : grossCents);
    let capacity = reimbursableCents;
    function apply(receipt: typeof receipts[number], expectation: typeof expectations[number] | undefined, amount: number) {
      const cents = Math.max(0, Math.min(amount, capacity, expectation?.remainingCents ?? capacity));
      if (!cents) return;
      receipt.appliedCents += cents;
      capacity -= cents;
      if (expectation) {
        expectation.receivedCents += cents;
        expectation.remainingCents -= cents;
        receipt.coverages.push({ expectationId: expectation.id, amountCents: cents });
      }
    }
    // Reserve targeted amounts before distributing pooled or excess receipts.
    for (const receipt of receipts) {
      const expectation = expectations.find(item => item.id === receipt.expectationId);
      if (expectation) apply(receipt, expectation, receipt.eligibleCents);
    }
    for (const receipt of receipts) {
      if (expectations.length) {
        for (const expectation of expectations) apply(receipt, expectation, receipt.eligibleCents - receipt.appliedCents);
      } else apply(receipt, undefined, receipt.eligibleCents - receipt.appliedCents);
      receipt.surplusCents = receipt.eligibleCents - receipt.appliedCents;
    }
    const receivedCents = receipts.reduce((sum, item) => sum + item.eligibleCents, 0);
    const appliedCents = receipts.reduce((sum, item) => sum + item.appliedCents, 0);
    return { ...group, expense, expectations, receipts, grossCents, receivedCents, appliedCents,
      pendingCents: (expense ? reimbursableCents : plannedCents) - appliedCents,
      surplusCents: receivedCents - appliedCents, netCents: Math.max(0, grossCents - appliedCents) };
  });
}
