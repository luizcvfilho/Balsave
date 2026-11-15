import { FinancialPage } from "../../components/preview/financial-page";
import { SpendingPage } from "../../ui/pages/spending-page";

export default async function Page() {
  return <FinancialPage><SpendingPage /></FinancialPage>;
}
