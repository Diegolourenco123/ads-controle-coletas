"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";

type Transportadora = {
  id: number;
  nome: string;
  cnpj: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  prazo_medio: number | null;
  observacoes: string | null;
  created_at: string;
};

const campo =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const rotulo =
  "text-sm font-semibold text-slate-700";

export default function TransportadorasPage() {
  const formularioRef =
    useRef<HTMLFormElement>(null);

  const [transportadoras, setTransportadoras] =
    useState<Transportadora[]>([]);

  const [pesquisa, setPesquisa] =
    useState("");

  const [mensagem, setMensagem] =
    useState("");

  const [carregando, setCarregando] =
    useState(true);

  const [salvando, setSalvando] =
    useState(false);

  const [
    transportadoraEditando,
    setTransportadoraEditando,
  ] = useState<Transportadora | null>(null);

  const [
    transportadoraVisualizando,
    setTransportadoraVisualizando,
  ] = useState<Transportadora | null>(null);

  async function carregarTransportadoras() {
    setCarregando(true);

    const { data, error } = await supabase
      .from("transportadoras")
      .select("*")
      .order("nome", { ascending: true });

    if (error) {
      console.error(error);

      setMensagem(
        `Não foi possível carregar as transportadoras: ${error.message}`,
      );

      setCarregando(false);
      return;
    }

    setTransportadoras(
      (data ?? []) as Transportadora[],
    );

    setCarregando(false);
  }

  useEffect(() => {
    carregarTransportadoras();
  }, []);

  function preencherCampo(
    nome: string,
    valor: string | number | null,
  ) {
    const elemento =
      formularioRef.current?.elements.namedItem(
        nome,
      ) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;

    if (elemento) {
      elemento.value =
        valor !== null &&
        valor !== undefined
          ? String(valor)
          : "";
    }
  }

  function iniciarEdicao(
    transportadora: Transportadora,
  ) {
    setTransportadoraEditando(
      transportadora,
    );

    setMensagem("");

    preencherCampo(
      "nome",
      transportadora.nome,
    );

    preencherCampo(
      "cnpj",
      transportadora.cnpj,
    );

    preencherCampo(
      "contato",
      transportadora.contato,
    );

    preencherCampo(
      "telefone",
      transportadora.telefone,
    );

    preencherCampo(
      "email",
      transportadora.email,
    );

    preencherCampo(
      "prazoMedio",
      transportadora.prazo_medio,
    );

    preencherCampo(
      "observacoes",
      transportadora.observacoes,
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelarEdicao() {
    setTransportadoraEditando(null);

    formularioRef.current?.reset();

    setMensagem(
      "Edição cancelada.",
    );
  }

  async function salvarTransportadora(
    evento: FormEvent<HTMLFormElement>,
  ) {
    evento.preventDefault();

    const formulario =
      evento.currentTarget;

    if (!formulario.checkValidity()) {
      formulario.reportValidity();
      return;
    }

    setSalvando(true);

    setMensagem(
      transportadoraEditando
        ? "Salvando alterações..."
        : "Salvando transportadora...",
    );

    const dados =
      new FormData(formulario);

    const valorOuNulo = (
      nome: string,
    ) => {
      const valor = dados
        .get(nome)
        ?.toString()
        .trim();

      return valor
        ? valor
        : null;
    };

    const prazoInformado =
      valorOuNulo("prazoMedio");

    const dadosTransportadora = {
      nome: valorOuNulo("nome"),
      cnpj: valorOuNulo("cnpj"),
      contato:
        valorOuNulo("contato"),
      telefone:
        valorOuNulo("telefone"),
      email: valorOuNulo("email"),

      prazo_medio:
        prazoInformado
          ? Number(prazoInformado)
          : null,

      observacoes:
        valorOuNulo("observacoes"),
    };

    if (transportadoraEditando) {
      const { error } = await supabase
        .from("transportadoras")
        .update(dadosTransportadora)
        .eq(
          "id",
          transportadoraEditando.id,
        );

      if (error) {
        console.error(error);

        setMensagem(
          `Não foi possível atualizar: ${error.message}`,
        );

        setSalvando(false);
        return;
      }

      setMensagem(
        "Transportadora atualizada com sucesso!",
      );

      setTransportadoraEditando(
        null,
      );
    } else {
      const { error } = await supabase
        .from("transportadoras")
        .insert(dadosTransportadora);

      if (error) {
        console.error(error);

        setMensagem(
          `Não foi possível salvar: ${error.message}`,
        );

        setSalvando(false);
        return;
      }

      setMensagem(
        "Transportadora cadastrada com sucesso!",
      );
    }

    formulario.reset();

    setSalvando(false);

    await carregarTransportadoras();
  }

  async function excluirTransportadora(
    id: number,
    nome: string,
  ) {
    const confirmou =
      window.confirm(
        `Deseja realmente excluir a transportadora "${nome}"?`,
      );

    if (!confirmou) {
      return;
    }

    const { error } = await supabase
      .from("transportadoras")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);

      setMensagem(
        `Não foi possível excluir: ${error.message}`,
      );

      return;
    }

    if (
      transportadoraEditando?.id ===
      id
    ) {
      setTransportadoraEditando(
        null,
      );

      formularioRef.current?.reset();
    }

    setMensagem(
      "Transportadora excluída com sucesso!",
    );

    await carregarTransportadoras();
  }

  const termo =
    pesquisa.trim().toLowerCase();

  const transportadorasFiltradas =
    transportadoras.filter(
      (transportadora) => {
        if (!termo) {
          return true;
        }

        const conteudo = [
          transportadora.nome,
          transportadora.cnpj,
          transportadora.contato,
          transportadora.telefone,
          transportadora.email,
          transportadora.observacoes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return conteudo.includes(
          termo,
        );
      },
    );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          <div className="mb-7">
            <p className="text-sm font-medium text-emerald-700">
              Cadastros operacionais
            </p>

            <h2 className="mt-1 text-3xl font-bold">
              Transportadoras
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre, consulte e
              atualize as transportadoras
              utilizadas nas coletas.
            </p>
          </div>

          {mensagem && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              {mensagem}
            </div>
          )}

          <form
            ref={formularioRef}
            onSubmit={
              salvarTransportadora
            }
            className="mb-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  {transportadoraEditando
                    ? "Modo de edição"
                    : "Cadastro"}
                </p>

                <h3 className="mt-1 text-lg font-bold">
                  {transportadoraEditando
                    ? "Editar transportadora"
                    : "Cadastrar transportadora"}
                </h3>

                <p className="text-sm text-slate-500">
                  {transportadoraEditando
                    ? `Alterando os dados de ${transportadoraEditando.nome}.`
                    : "Preencha os dados da empresa responsável pelo transporte."}
                </p>
              </div>

              {transportadoraEditando && (
                <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  Editando registro #
                  {
                    transportadoraEditando.id
                  }
                </span>
              )}
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <label
                className={rotulo}
              >
                Nome da transportadora *
                <input
                  type="text"
                  name="nome"
                  required
                  placeholder="Ex.: Transportadora Alfa"
                  className={campo}
                />
              </label>

              <label
                className={rotulo}
              >
                CNPJ
                <input
                  type="text"
                  name="cnpj"
                  placeholder="00.000.000/0000-00"
                  className={campo}
                />
              </label>

              <label
                className={rotulo}
              >
                Contato
                <input
                  type="text"
                  name="contato"
                  placeholder="Nome do responsável"
                  className={campo}
                />
              </label>

              <label
                className={rotulo}
              >
                Telefone
                <input
                  type="text"
                  name="telefone"
                  placeholder="(11) 00000-0000"
                  className={campo}
                />
              </label>

              <label
                className={rotulo}
              >
                E-mail
                <input
                  type="email"
                  name="email"
                  placeholder="contato@transportadora.com.br"
                  className={campo}
                />
              </label>

              <label
                className={rotulo}
              >
                Prazo médio em dias
                <input
                  type="number"
                  name="prazoMedio"
                  min="0"
                  placeholder="Ex.: 3"
                  className={campo}
                />
              </label>
            </div>

            <label
              className={`${rotulo} mt-5 block`}
            >
              Observações
              <textarea
                name="observacoes"
                rows={4}
                placeholder="Regiões atendidas, horários, condições especiais..."
                className={campo}
              />
            </label>

            <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
              {transportadoraEditando && (
                <button
                  type="button"
                  onClick={
                    cancelarEdicao
                  }
                  disabled={salvando}
                  className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar edição
                </button>
              )}

              <button
                type="submit"
                disabled={salvando}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando
                  ? "Salvando..."
                  : transportadoraEditando
                    ? "Salvar alterações"
                    : "Cadastrar transportadora"}
              </button>
            </div>
          </form>

          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center">
              <div>
                <h3 className="text-lg font-bold">
                  Transportadoras
                  cadastradas
                </h3>

                <p className="text-sm text-slate-500">
                  {
                    transportadorasFiltradas.length
                  }{" "}
                  registro(s)
                  encontrado(s)
                </p>
              </div>

              <input
                type="search"
                value={pesquisa}
                onChange={(evento) =>
                  setPesquisa(
                    evento.target.value,
                  )
                }
                placeholder="Pesquisar transportadora..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600 md:w-80"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">
                      Transportadora
                    </th>

                    <th className="px-5 py-4">
                      CNPJ
                    </th>

                    <th className="px-5 py-4">
                      Contato
                    </th>

                    <th className="px-5 py-4">
                      Telefone
                    </th>

                    <th className="px-5 py-4">
                      E-mail
                    </th>

                    <th className="px-5 py-4">
                      Prazo
                    </th>

                    <th className="px-5 py-4">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-sm">
                  {carregando && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-8 text-center text-slate-500"
                      >
                        Carregando
                        transportadoras...
                      </td>
                    </tr>
                  )}

                  {!carregando &&
                    transportadorasFiltradas.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-8 text-center text-slate-500"
                        >
                          Nenhuma
                          transportadora
                          cadastrada.
                        </td>
                      </tr>
                    )}

                  {!carregando &&
                    transportadorasFiltradas.map(
                      (
                        transportadora,
                      ) => (
                        <tr
                          key={
                            transportadora.id
                          }
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-4 font-semibold text-slate-900">
                            {
                              transportadora.nome
                            }
                          </td>

                          <td className="px-5 py-4">
                            {transportadora.cnpj ||
                              "—"}
                          </td>

                          <td className="px-5 py-4">
                            {transportadora.contato ||
                              "—"}
                          </td>

                          <td className="px-5 py-4">
                            {transportadora.telefone ||
                              "—"}
                          </td>

                          <td className="px-5 py-4">
                            {transportadora.email ||
                              "—"}
                          </td>

                          <td className="px-5 py-4">
                            {transportadora.prazo_medio !==
                            null
                              ? `${transportadora.prazo_medio} dia(s)`
                              : "—"}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setTransportadoraVisualizando(
                                    transportadora,
                                  )
                                }
                                className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                              >
                                Visualizar
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  iniciarEdicao(
                                    transportadora,
                                  )
                                }
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  excluirTransportadora(
                                    transportadora.id,
                                    transportadora.nome,
                                  )
                                }
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>

      {transportadoraVisualizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Transportadora
                </p>

                <h3 className="mt-1 text-2xl font-bold text-slate-900">
                  {
                    transportadoraVisualizando.nome
                  }
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setTransportadoraVisualizando(
                    null,
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">
                  CNPJ
                </p>

                <p className="mt-1 font-medium text-slate-800">
                  {transportadoraVisualizando.cnpj ||
                    "Não informado"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Contato
                </p>

                <p className="mt-1 font-medium text-slate-800">
                  {transportadoraVisualizando.contato ||
                    "Não informado"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Telefone
                </p>

                <p className="mt-1 font-medium text-slate-800">
                  {transportadoraVisualizando.telefone ||
                    "Não informado"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">
                  E-mail
                </p>

                <p className="mt-1 break-all font-medium text-slate-800">
                  {transportadoraVisualizando.email ||
                    "Não informado"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Prazo médio
                </p>

                <p className="mt-1 font-medium text-slate-800">
                  {transportadoraVisualizando.prazo_medio !==
                  null
                    ? `${transportadoraVisualizando.prazo_medio} dia(s)`
                    : "Não informado"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Código
                </p>

                <p className="mt-1 font-medium text-slate-800">
                  #
                  {
                    transportadoraVisualizando.id
                  }
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Observações
                </p>

                <div className="mt-2 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {transportadoraVisualizando.observacoes ||
                    "Nenhuma observação cadastrada."}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 p-5">
              <button
                type="button"
                onClick={() => {
                  iniciarEdicao(
                    transportadoraVisualizando,
                  );

                  setTransportadoraVisualizando(
                    null,
                  );
                }}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Editar transportadora
              </button>

              <button
                type="button"
                onClick={() =>
                  setTransportadoraVisualizando(
                    null,
                  )
                }
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}