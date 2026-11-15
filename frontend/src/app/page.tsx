import { connection } from "next/server";
import { DashboardPage } from "../ui/pages/dashboard-page";

export default async function Home() {
  await connection();
  return <DashboardPage />;
}
