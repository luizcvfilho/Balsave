import { connection } from "next/server";
import { AccountsPage } from "../../ui/pages/accounts-page";

export default async function Page() {
  await connection();
  return <AccountsPage />;
}
