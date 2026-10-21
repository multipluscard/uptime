// Página de configurações: monta o formulário a partir da lista de itens e salva a cada alteração.
// Grupo "comum" vale para as três visualizações; "lista", "cards" e "mapa", para cada uma.
(function () {
    "use strict";
    const S = window.Status;
    const { el, icone } = S;

    const config = window.STATUS_CONFIG || {};
    const HISTORICO_QTD = Math.max(1, Math.min(720, Number(config.HISTORICO_QTD) || 60));
    const INTERVALO_SEG = 120; // o monitor verifica a cada 2 min; só para escrever os períodos
    const PERIODOS = S.opcoesPeriodo(HISTORICO_QTD, INTERVALO_SEG).map(p => [p.ciclos, p.rotulo]);

    const GRUPOS = [
        {
            grupo: "comum", titulo: "Comum", sub: "vale para as três visualizações",
            itens: [
                { chave: "visualizacao", tipo: "visual", rotulo: "Visualização", explica: "Como a página de status abre." },
                { chave: "tema", tipo: "radio", rotulo: "Tema", opcoes: [["sistema", "Igual ao sistema"], ["claro", "Claro"], ["escuro", "Escuro"]] },
                { chave: "tiposOcultos", tipo: "tipos", rotulo: "Tipos exibidos", explica: "Desmarque o que não quer ver." },
                { chave: "mostrarPoucoMovimento", tipo: "bool", rotulo: "Redes com pouco movimento", texto: "Mostrar redes com pouco ou nenhum movimento agora" },
                { chave: "atualizacaoAutomatica", tipo: "bool", rotulo: "Atualização automática", texto: "Buscar dados novos sozinho a cada " + (Number(config.PAGINA_ATUALIZACAO_SEGUNDOS) || 60) + " s" }
            ]
        },
        {
            grupo: "mapa", titulo: "Mapa de calor", sub: "visualização C",
            itens: [
                { chave: "periodoCiclos", tipo: "select", numero: true, rotulo: "Período do histórico", opcoes: PERIODOS },
                { chave: "mostrarPaineis", tipo: "bool", rotulo: "Painéis por tipo", texto: "Mostrar os painéis de resumo por tipo no topo" },
                { chave: "mostrarOcorrencias", tipo: "bool", rotulo: "Ocorrências", texto: "Mostrar a linha do tempo de ocorrências ao lado" },
                { chave: "densidade", tipo: "radio", rotulo: "Densidade", opcoes: [["normal", "Normal"], ["compacta", "Compacta (mais redes por tela)"]] }
            ]
        },
        {
            grupo: "cards", titulo: "Cards", sub: "visualização B",
            itens: [
                { chave: "periodoCiclos", tipo: "select", numero: true, rotulo: "Período do histórico", explica: "Período curto deixa as barras maiores.", opcoes: PERIODOS },
                { chave: "abaInicial", tipo: "select", rotulo: "Aba inicial", opcoes: S.ORDEM_TIPOS.map(t => [t, t]).concat([["TODAS", "Todas"]]) },
                { chave: "mostrarAtencao", tipo: "bool", rotulo: "Precisa de atenção", texto: "Destacar no topo as redes com degradação" },
                { chave: "poucoMovimentoAberto", tipo: "bool", rotulo: "Pouco movimento", texto: "Abrir já expandida a lista de redes com pouco movimento" }
            ]
        },
        {
            grupo: "lista", titulo: "Lista", sub: "visualização A",
            itens: [
                { chave: "periodoCiclos", tipo: "select", numero: true, rotulo: "Período do histórico", opcoes: PERIODOS },
                { chave: "ordem", tipo: "radio", rotulo: "Ordenação inicial", opcoes: [["nome", "Por nome"], ["situacao", "Por situação (degradadas primeiro)"]] },
                { chave: "abrirDegradadas", tipo: "bool", rotulo: "Detalhes", texto: "Abrir automaticamente os detalhes das redes degradadas" }
            ]
        }
    ];

    let prefs = S.lerPreferencias();
    const form = document.getElementById("formulario");
    const elSalvo = document.getElementById("salvo");
    let temporizador = null;

    function salvar() {
        const ok = S.salvarPreferencias(prefs);
        S.aplicarTema(prefs.comum.tema);
        elSalvo.textContent = ok ? "Salvo neste navegador." : "Este navegador não permite salvar: vale só nesta visita.";
        clearTimeout(temporizador);
        temporizador = setTimeout(() => { elSalvo.textContent = ""; }, 2500);
    }

    function nomeCampo(grupo, chave) { return grupo + "." + chave; }

    function controle(grupo, item) {
        const valor = prefs[grupo][item.chave];
        const nome = nomeCampo(grupo, item.chave);

        if (item.tipo === "visual") {
            return el("div", { classe: "escolha-visual", role: "radiogroup", "aria-label": item.rotulo }, Object.entries(S.VISUALIZACOES).map(([id, v]) => {
                const entrada = el("input", { type: "radio", name: nome, value: id, checked: valor === id });
                entrada.addEventListener("change", () => { prefs[grupo][item.chave] = id; salvar(); });
                return el("label", {}, [el("span", { classe: "titulo" }, [entrada, icone(v.icone), v.nome + (id === S.PREFERENCIAS_PADRAO.comum.visualizacao ? " (padrão)" : "")]), el("small", { texto: v.descricao })]);
            }));
        }
        if (item.tipo === "radio") {
            return el("div", { classe: "opcoes", role: "radiogroup", "aria-label": item.rotulo }, item.opcoes.map(([v, rotulo]) => {
                const entrada = el("input", { type: "radio", name: nome, value: v, checked: valor === v });
                entrada.addEventListener("change", () => { prefs[grupo][item.chave] = v; salvar(); });
                return el("label", {}, [entrada, rotulo]);
            }));
        }
        if (item.tipo === "select") {
            const sel = el("select", { classe: "campo", name: nome, "aria-label": item.rotulo }, item.opcoes.map(([v, rotulo]) => el("option", { value: String(v), texto: rotulo, selected: String(valor) === String(v) })));
            sel.addEventListener("change", () => { prefs[grupo][item.chave] = item.numero ? Number(sel.value) : sel.value; salvar(); });
            return el("div", { classe: "opcoes" }, [sel]);
        }
        if (item.tipo === "bool") {
            const entrada = el("input", { type: "checkbox", name: nome, checked: !!valor });
            entrada.addEventListener("change", () => { prefs[grupo][item.chave] = entrada.checked; salvar(); });
            return el("div", { classe: "opcoes" }, [el("label", {}, [entrada, item.texto])]);
        }
        if (item.tipo === "tipos") {
            return el("div", { classe: "opcoes" }, S.ORDEM_TIPOS.map(tipo => {
                const entrada = el("input", { type: "checkbox", name: nome, value: tipo, checked: !valor.includes(tipo) });
                entrada.addEventListener("change", () => {
                    const ocultos = new Set(prefs[grupo][item.chave]);
                    if (entrada.checked) ocultos.delete(tipo); else ocultos.add(tipo);
                    prefs[grupo][item.chave] = Array.from(ocultos);
                    salvar();
                });
                return el("label", { title: S.DESCRICAO_TIPO[tipo] }, [entrada, tipo]);
            }));
        }
        return null;
    }

    function montar() {
        form.replaceChildren(...GRUPOS.map(g => el("fieldset", {}, [
            el("legend", {}, [g.titulo, el("small", { texto: g.sub })]),
            ...g.itens.map(item => el("div", { classe: "item" }, [
                el("div", { classe: "rotulo" }, [item.rotulo, item.explica ? el("span", { classe: "explica", texto: item.explica }) : null]),
                controle(g.grupo, item)
            ]))
        ])));
    }

    document.getElementById("restaurar").addEventListener("click", () => {
        prefs = JSON.parse(JSON.stringify(S.PREFERENCIAS_PADRAO));
        salvar();
        montar();
    });

    S.aplicarTema(prefs.comum.tema);
    montar();
})();
