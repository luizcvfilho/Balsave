import { FinancialPage } from "../../components/preview/financial-page";
import { CardsPage } from "../../ui/pages/cards-page";

export default async function Page() {
  return <FinancialPage><CardsPage /></FinancialPage>;
}
