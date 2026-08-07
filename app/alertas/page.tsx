import CentralAlertas from "../components/CentralAlertas";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

export default function AlertasPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          <CentralAlertas />
        </section>
      </div>
    </main>
  );
}