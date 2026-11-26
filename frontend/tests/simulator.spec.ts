import { expect, test } from "@playwright/test";
import { simulatorSources } from "../src/app/simulador/simulator-sources";

const accounts = [
  { id: "a", name: "Conta A", bank: "Banco A", balanceCents: 10_150 },
  { id: "b", name: "Conta B", bank: "Banco A", balanceCents: -150 },
  { id: "c", name: "Conta C", bank: "Banco B", balanceCents: 0 },
];
const snapshot = { asOf: "2026-11-14", accounts, failedConnections: 0 };

test("offers the complete bank total and preserves grouped balances and zero", () => {
  expect(simulatorSources(snapshot)).toEqual({
    asOf: snapshot.asOf,
    totalCents: 10_000,
    banks: [{ bank: "Banco A", balanceCents: 10_000 }, { bank: "Banco B", balanceCents: 0 }],
    funds: [],
  });
  expect(simulatorSources({ ...snapshot, accounts: [accounts[2]] }).totalCents).toBe(0);
});

test("withholds an incomplete total and banks missing an account balance", () => {
  expect(simulatorSources({ ...snapshot, failedConnections: 1 }).totalCents).toBeNull();
  const partial = simulatorSources({
    ...snapshot,
    accounts: [accounts[0], { ...accounts[1], balanceCents: null }, accounts[2]],
  });
  expect(partial.totalCents).toBeNull();
  expect(partial.banks).toEqual([{ bank: "Banco B", balanceCents: 0 }]);
  expect(simulatorSources({ ...snapshot, accounts: [accounts[1]] }).banks).toEqual([]);
});
