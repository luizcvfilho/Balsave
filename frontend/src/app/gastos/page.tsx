import { connection } from "next/server";
import { SpendingPage } from "../../ui/pages/spending-page";

export default async function Page() {
  await connection();
  return <SpendingPage />;
}
