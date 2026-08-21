import Link from "next/link";

import FormEditarColeta from "../../components/FormEditarColeta";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";

export default async function EditarColetaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    voltar?: string;
  }>;
}) {
  const { id } = await params;
  const { voltar } = await searchParams;

  const coletaId = Number(id);

  /*
   * ==========================================================
   * ROTA DE RETORNO
   * ==========================================================
   *
   * Se a coleta foi aberta pela tela "Todas as coletas",
   * recebemos a URL anterior no parâmetro "voltar".
   *
   * Exemplo:
   * /coletas?status=Aguardando%20NF
   *
   * Caso não exista informação de retorno,
   * volta normalmente para /coletas.
   */
  const voltarPara =
    voltar && voltar.startsWith("/coletas")
      ? voltar
      : "/coletas";

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          <div className="mb-7">

            {/* BOTÃO VOLTAR */}
            <Link
              href={voltarPara}
              className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>

              Voltar para coletas
            </Link>

            <p className="text-sm font-medium text-emerald-700">
              Controle operacional
            </p>

            <h2 className="mt-1 text-3xl font-bold">
              Editar coleta #{coletaId}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Atualize o andamento, os documentos e as informações da coleta.
            </p>
          </div>

          <FormEditarColeta id={coletaId} />
        </section>
      </div>
    </main>
  );
}