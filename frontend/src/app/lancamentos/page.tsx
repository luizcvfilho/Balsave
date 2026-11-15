import { FinancialPage } from "../../components/preview/financial-page";
import { TransactionsPage } from "../../ui/pages/transactions-page";

export default async function Page() {
  return <FinancialPage><TransactionsPage /></FinancialPage>;
}
