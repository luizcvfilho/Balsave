import { FinancialPage } from "../../components/preview/financial-page";
import ReceivablesPage from "../../ui/pages/receivables-page";

export default function Page() {
  return <FinancialPage showSavedReceivablesWhenUnavailable><ReceivablesPage /></FinancialPage>;
}
