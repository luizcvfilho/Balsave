import { connection } from "next/server";
import { PageHeading, ReportNavigation } from "../../components/details/report-layout";
import { CategoriesCatalog } from "../../ui/pages/categories-catalog";
import { TagsCatalog } from "../../ui/pages/tags-catalog";

export default async function Page({ searchParams }: PageProps<"/classificacoes">) {
  await connection();
  const tags = (await searchParams).aba === "etiquetas";
  return <main className="balsave-shell report-layout">
    <PageHeading title="Classificações" />
    <ReportNavigation label="Catálogos de classificação" options={[
      { label: "Categorias e regras", href: "/classificacoes", active: !tags },
      { label: "Etiquetas", href: "/classificacoes?aba=etiquetas", active: tags },
    ]} />
    {tags ? <TagsCatalog /> : <CategoriesCatalog />}
  </main>;
}
