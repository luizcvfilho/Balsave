import { FinancialPage } from "../../components/preview/financial-page";
import { AccountsPage } from "../../ui/pages/accounts-page";

export default async function Page() {
  return <FinancialPage showDemoWhenSignedOut><AccountsPage /></FinancialPage>;
}
