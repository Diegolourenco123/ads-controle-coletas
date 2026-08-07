import FormEditarColeta from "../../components/FormEditarColeta";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";

export default async function EditarColetaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coletaId = Number(id);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          <div className="mb-7">
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