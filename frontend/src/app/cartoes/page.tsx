import { connection } from "next/server";
import { CardsPage } from "../../ui/pages/cards-page";

export default async function Page() {
  await connection();
  return <CardsPage />;
}
