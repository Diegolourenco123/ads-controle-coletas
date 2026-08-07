import FormNovaColeta from "../../components/FormNovaColeta";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";

export default function NovaColetaPage() {
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
              Cadastrar nova coleta
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Preencha os dados recebidos do cliente e acompanhe toda a
              movimentação da coleta.
            </p>
          </div>

          <FormNovaColeta />
        </section>
      </div>
    </main>
  );
}