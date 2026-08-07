import Image from "next/image";
import FormLogin from "../components/FormLogin";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        {/* Lado esquerdo */}
        <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative">
            <div className="inline-flex rounded-2xl bg-white p-4 shadow-xl">
              <Image
                src="/logo-ads.png"
                alt="ADS Logística Ambiental"
                width={240}
                height={90}
                priority
                className="h-auto w-52 object-contain"
              />
            </div>
          </div>

          <div className="relative max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-400">
              Centro de Inteligência Operacional
            </p>

            <h1 className="mt-5 text-5xl font-black leading-tight">
              ADS Controle de Coletas
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              Gestão operacional, acompanhamento das coletas,
              indicadores e controle financeiro em um único sistema.
            </p>
          </div>

          <p className="relative text-xs text-slate-500">
            ADS Logística Ambiental • Sistema de Gestão Operacional
          </p>
        </section>

        {/* Lado direito */}
        <section className="flex items-center justify-center p-5 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <Image
                src="/logo-ads.png"
                alt="ADS Logística Ambiental"
                width={220}
                height={82}
                priority
                className="h-auto w-48 object-contain"
              />
            </div>

            <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                  Acesso Restrito
                </p>

                <h2 className="mt-3 text-3xl font-black text-slate-900">
                  Bem-vindo ao ADS
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Informe seu e-mail e senha para acessar o sistema.
                </p>
              </div>

              <FormLogin />
            </article>

            <p className="mt-6 text-center text-xs text-slate-400">
              © ADS Logística Ambiental
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}