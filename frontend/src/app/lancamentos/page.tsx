import { connection } from "next/server";
import { TransactionsPage } from "../../ui/pages/transactions-page";

export default async function Page() {
  await connection();
  return <TransactionsPage />;
}
