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

  const [pagina, setPagina] =
    useState(1);

  const [itensPorPagina, setItensPorPagina] =
    useState(10);

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
      const { data, error } = await supabase
        .from("transportadoras")
        .update(dadosTransportadora)
        .eq(
          "id",
          transportadoraEditando.id,
        )
        .select()
        .single();

      if (error) {
        console.error(
          "Erro ao atualizar transportadora:",
          error,
        );

        setMensagem(
          `Não foi possível atualizar: ${error.message}`,
        );

        setSalvando(false);
        return;
      }

      if (!data) {
        setMensagem(
          "A alteração não foi gravada no banco de dados.",
        );

        setSalvando(false);
        return;
      }

      setTransportadoras((atuais) =>
        atuais.map((item) =>
          item.id === data.id
            ? (data as Transportadora)
            : item,
        ),
      );

      setMensagem(
        "Transportadora atualizada com sucesso!",
      );

      setTransportadoraEditando(null);
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

  useEffect(() => {
    setPagina(1);
  }, [pesquisa, itensPorPagina]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(
      transportadorasFiltradas.length /
        itensPorPagina,
    ),
  );

  const inicioPagina =
    (pagina - 1) * itensPorPagina;

  const transportadorasPaginadas =
    transportadorasFiltradas.slice(
      inicioPagina,
      inicioPagina + itensPorPagina,
    );

  const inicioExibicao =
    transportadorasFiltradas.length === 0
      ? 0
      : inicioPagina + 1;

  const fimExibicao = Math.min(
    inicioPagina + itensPorPagina,
    transportadorasFiltradas.length,
  );

  const indicadores = {
    total: transportadoras.length,
    comPrazo: transportadoras.filter(
      (item) => item.prazo_medio !== null,
    ).length,
    contatoIncompleto: transportadoras.filter(
      (item) =>
        !item.contato ||
        !item.telefone ||
        !item.email,
    ).length,
    prazoMedio: (() => {
      const comPrazo = transportadoras.filter(
        (item) =>
          item.prazo_medio !== null,
      );

      if (comPrazo.length === 0) {
        return 0;
      }

      return (
        comPrazo.reduce(
          (total, item) =>
            total +
            (item.prazo_medio ?? 0),
          0,
        ) / comPrazo.length
      );
    })(),
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          {/* CABEÇALHO */}
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                Cadastros operacionais
              </p>
            </div>

            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Transportadoras
            </h2>

            <p className="mt-1.5 text-sm text-slate-500">
              Cadastre, consulte e atualize as transportadoras utilizadas nas coletas.
            </p>
          </div>

          {mensagem && (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {mensagem}
            </div>
          )}

          {/* INDICADORES */}
          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                "Total cadastradas",
                indicadores.total,
                "Transportadoras",
                "bg-emerald-500",
              ],
              [
                "Com prazo definido",
                indicadores.comPrazo,
                `${indicadores.total > 0
                  ? Math.round(
                      (indicadores.comPrazo /
                        indicadores.total) *
                        100,
                    )
                  : 0}% do total`,
                "bg-blue-500",
              ],
              [
                "Sem contato completo",
                indicadores.contatoIncompleto,
                "Precisam atualização",
                "bg-amber-500",
              ],
              [
                "Prazo médio",
                indicadores.prazoMedio.toLocaleString(
                  "pt-BR",
                  {
                    maximumFractionDigits: 1,
                  },
                ),
                "dias",
                "bg-violet-500",
              ],
            ].map(
              ([titulo, valor, detalhe, cor]) => (
                <article
                  key={String(titulo)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${cor}`}
                    />
                    <p className="text-xs font-semibold text-slate-500">
                      {titulo}
                    </p>
                  </div>

                  <p className="mt-2 text-2xl font-black text-slate-900">
                    {valor}
                  </p>

                  <p className="mt-1 text-[11px] text-slate-400">
                    {detalhe}
                  </p>
                </article>
              ),
            )}
          </section>

          {/* FORMULÁRIO */}
          <form
            ref={formularioRef}
            onSubmit={salvarTransportadora}
            className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                  {transportadoraEditando
                    ? "Modo de edição"
                    : "Cadastro"}
                </p>

                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  {transportadoraEditando
                    ? "Editar transportadora"
                    : "Cadastrar transportadora"}
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {transportadoraEditando
                    ? `Alterando os dados de ${transportadoraEditando.nome}.`
                    : "Preencha os dados da empresa responsável pelo transporte."}
                </p>
              </div>

              {transportadoraEditando && (
                <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  Editando registro #{transportadoraEditando.id}
                </span>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className={rotulo}>
                Nome da transportadora *
                <input
                  type="text"
                  name="nome"
                  required
                  placeholder="Ex.: Transportadora Alfa"
                  className={campo}
                />
              </label>

              <label className={rotulo}>
                CNPJ
                <input
                  type="text"
                  name="cnpj"
                  placeholder="00.000.000/0000-00"
                  className={campo}
                />
              </label>

              <label className={rotulo}>
                Contato
                <input
                  type="text"
                  name="contato"
                  placeholder="Nome do responsável"
                  className={campo}
                />
              </label>

              <label className={rotulo}>
                Telefone
                <input
                  type="text"
                  name="telefone"
                  placeholder="(11) 00000-0000"
                  className={campo}
                />
              </label>

              <label className={rotulo}>
                E-mail
                <input
                  type="email"
                  name="email"
                  placeholder="contato@transportadora.com.br"
                  className={campo}
                />
              </label>

              <label className={rotulo}>
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

            <label className={`${rotulo} mt-4 block`}>
              Observações
              <textarea
                name="observacoes"
                rows={3}
                placeholder="Regiões atendidas, horários, condições especiais..."
                className={campo}
              />
            </label>

            <div className="mt-5 flex flex-col justify-end gap-3 sm:flex-row">
              {transportadoraEditando && (
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  disabled={salvando}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar edição
                </button>
              )}

              <button
                type="submit"
                disabled={salvando}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando
                  ? "Salvando..."
                  : transportadoraEditando
                    ? "Salvar alterações"
                    : "Cadastrar transportadora"}
              </button>
            </div>
          </form>

          {/* LISTA */}
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Transportadoras cadastradas
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {transportadorasFiltradas.length} registro(s) encontrado(s)
                </p>
              </div>

              <input
                type="search"
                value={pesquisa}
                onChange={(evento) =>
                  setPesquisa(evento.target.value)
                }
                placeholder="Pesquisar transportadora..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white md:w-80"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] table-fixed text-left">
                <colgroup>
                  <col className="w-[16%]" />
                  <col className="w-[13%]" />
                  <col className="w-[15%]" />
                  <col className="w-[13%]" />
                  <col className="w-[23%]" />
                  <col className="w-[8%]" />
                  <col className="w-[12%]" />
                </colgroup>

                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3.5">Transportadora</th>
                    <th className="px-4 py-3.5">CNPJ</th>
                    <th className="px-4 py-3.5">Contato</th>
                    <th className="px-4 py-3.5">Telefone</th>
                    <th className="px-4 py-3.5">E-mail</th>
                    <th className="px-4 py-3.5">Prazo</th>
                    <th className="px-4 py-3.5">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-sm">
                  {carregando && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-10 text-center text-slate-500"
                      >
                        Carregando transportadoras...
                      </td>
                    </tr>
                  )}

                  {!carregando &&
                    transportadorasFiltradas.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-10 text-center text-slate-500"
                        >
                          Nenhuma transportadora cadastrada.
                        </td>
                      </tr>
                    )}

                  {!carregando &&
                    transportadorasPaginadas.map(
                      (transportadora) => (
                        <tr
                          key={transportadora.id}
                          className="transition hover:bg-slate-50/70"
                        >
                          <td className="px-4 py-3.5 align-middle font-bold text-slate-900">
                            <span className="block leading-5">
                              {transportadora.nome}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 align-middle text-slate-600">
                            <span className="block break-words leading-5">
                              {transportadora.cnpj || "—"}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 align-middle text-slate-700">
                            <span className="block leading-5">
                              {transportadora.contato || "—"}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 align-middle text-slate-700">
                            <span className="block leading-5">
                              {transportadora.telefone || "—"}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 align-middle text-slate-700">
                            <span className="block break-all leading-5">
                              {transportadora.email || "—"}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 align-middle text-slate-700">
                            {transportadora.prazo_medio !== null
                              ? `${transportadora.prazo_medio} dia(s)`
                              : "—"}
                          </td>

                          <td className="px-4 py-3.5 align-middle">
                            <div className="flex flex-nowrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setTransportadoraVisualizando(
                                    transportadora,
                                  )
                                }
                                className="whitespace-nowrap rounded-lg bg-slate-700 px-2.5 py-2 text-[11px] font-semibold text-white transition hover:bg-slate-800"
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
                                className="whitespace-nowrap rounded-lg bg-emerald-600 px-2.5 py-2 text-[11px] font-semibold text-white transition hover:bg-emerald-700"
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
                                className="whitespace-nowrap rounded-lg bg-red-600 px-2.5 py-2 text-[11px] font-semibold text-white transition hover:bg-red-700"
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

            {!carregando &&
              transportadorasFiltradas.length > 0 && (
                <div className="flex flex-col justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xs text-slate-500">
                      Mostrando{" "}
                      <span className="font-bold text-slate-700">
                        {inicioExibicao}
                      </span>{" "}
                      a{" "}
                      <span className="font-bold text-slate-700">
                        {fimExibicao}
                      </span>{" "}
                      de{" "}
                      <span className="font-bold text-slate-700">
                        {transportadorasFiltradas.length}
                      </span>
                    </p>

                    <select
                      value={itensPorPagina}
                      onChange={(evento) =>
                        setItensPorPagina(
                          Number(
                            evento.target.value,
                          ),
                        )
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
                    >
                      <option value={10}>
                        10 por página
                      </option>
                      <option value={20}>
                        20 por página
                      </option>
                      <option value={30}>
                        30 por página
                      </option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPagina((atual) =>
                          Math.max(1, atual - 1),
                        )
                      }
                      disabled={pagina === 1}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Anterior
                    </button>

                    {Array.from(
                      { length: totalPaginas },
                      (_, indice) => indice + 1,
                    ).map((numero) => (
                      <button
                        key={numero}
                        type="button"
                        onClick={() =>
                          setPagina(numero)
                        }
                        className={[
                          "flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-bold transition",
                          pagina === numero
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
                        ].join(" ")}
                      >
                        {numero}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        setPagina((atual) =>
                          Math.min(
                            totalPaginas,
                            atual + 1,
                          ),
                        )
                      }
                      disabled={
                        pagina === totalPaginas
                      }
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
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