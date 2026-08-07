import FormLogin from "../components/FormLogin";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* ======================================================
            LADO ESQUERDO - IDENTIDADE VISUAL ADS
        ====================================================== */}
        <section
          className="relative hidden min-h-screen overflow-hidden bg-slate-950 lg:block"
          style={{
            backgroundImage: "url('/login-ads-bg.png')",
            backgroundSize: "200% 100%",
            backgroundPosition: "left center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Camada suave para reforçar contraste */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/5" />
        </section>

        {/* ======================================================
            LADO DIREITO - LOGIN
        ====================================================== */}
        <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-5 py-10 sm:px-8 lg:px-12">
          {/* Efeitos sutis de fundo */}
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-emerald-100/40 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-slate-200/50 blur-3xl" />

          <div className="relative w-full max-w-[500px]">
            {/* ==================================================
                CARD
            ================================================== */}
            <article className="rounded-[28px] border border-slate-200/80 bg-white px-7 py-9 shadow-[0_25px_70px_rgba(15,23,42,0.10)] sm:px-10 sm:py-11">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
                  Acesso restrito
                </p>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-[34px]">
                  Bem-vindo ao ADS
                </h1>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Informe seu e-mail e senha para acessar o sistema.
                </p>
              </div>

              {/* Formulário real integrado ao Supabase */}
              <div className="mt-8">
                <FormLogin />
              </div>
            </article>

            {/* Rodapé */}
            <p className="mt-7 text-center text-xs font-medium text-slate-400">
              © ADS Logística Ambiental
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}