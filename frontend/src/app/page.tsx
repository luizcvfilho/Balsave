import { FinancialPage } from "../components/preview/financial-page";
import { DashboardPage } from "../ui/pages/dashboard-page";

export default async function Home() {
  return <FinancialPage><DashboardPage /></FinancialPage>;
}
