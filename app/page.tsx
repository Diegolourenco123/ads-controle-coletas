import Link from "next/link";
import AlertasOperacionais from "./components/AlertasOperacionais";
import ColetasTable from "./components/ColetasTable";
import DashboardCards from "./components/DashboardCards";
import DashboardExecutivo from "./components/DashboardExecutivo";
import GraficosDesempenho from "./components/GraficosDesempenho";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-medium text-emerald-700">
                Painel Operacional Lousa
              </p>

              <h2 className="mt-1 text-3xl font-bold">
                Visão geral das coletas
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Acompanhe a operação e o financeiro em tempo real.
              </p>
            </div>

            <Link
              href="/coletas/nova"
              className="rounded-xl bg-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              + Nova coleta
            </Link>
          </div>

          <DashboardExecutivo />
          <DashboardCards />
          <GraficosDesempenho />
          <AlertasOperacionais />
          <ColetasTable />
        </section>
      </div>
    </main>
  );
}