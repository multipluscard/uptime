// As três visualizações da página: lista, cards e mapa de calor.
// Cada uma expõe esqueleto(alvo) e render(alvo, ctx), com ctx = { modelo, prefs, intervaloSeg }.
// O estado de tela (filtros, abas, linhas abertas) fica guardado aqui e sobrevive às atualizações.
(function () {
    "use strict";
    const S = window.Status;
    const { el, icone, selo } = S;

    // Filtros do grupo "comum" (tipos ocultos, pouco movimento).
    function cardsVisiveis(modelo, comum) {
        return modelo.cards
            .filter(c => !comum.tiposOcultos.includes(c.tipo))
            .filter(c => comum.mostrarPoucoMovimento || !(c.atual.status === "baixo_movimento" || c.atual.status === "sem_movimento"));
    }

    function vazio(texto) { return el("p", { classe: "vazio-filtro", texto }); }

    // =================================================================================
    // A · Lista
    // =================================================================================
    const lista = (function () {
        const estado = { tipo: "TODOS", busca: "", soOcorrencia: false, ordem: null, fechadas: new Set(), abertas: new Set(), jaAbertas: new Set() };

        function geral(modelo, cards) {
            const alvo = el("section", { classe: "geral", "aria-live": "polite" });
            if (modelo.desatualizado) {
                alvo.classList.add("neutro");
                alvo.append(el("div", { classe: "icone-geral" }, [icone("relogio")]),
                    el("div", {}, [el("h1", { texto: "Situação atual indisponível" }), el("p", { texto: "Mostramos o histórico até o último envio do monitoramento." })]));
                return alvo;
            }
            const degradados = cards.filter(c => c.atual.status === "degradado");
            if (!degradados.length) {
                alvo.classList.add("ok");
                alvo.append(el("div", { classe: "icone-geral" }, [icone("check")]),
                    el("div", {}, [el("h1", { texto: "Todas as redes operando normalmente" }), el("p", { texto: cards.length + " redes monitoradas · verificação a cada 2 minutos" })]));
                return alvo;
            }
            alvo.classList.add("alerta");
            alvo.append(el("div", { classe: "icone-geral" }, [icone("alerta")]),
                el("div", {}, [
                    el("h1", { texto: degradados.length === 1 ? "1 rede com degradação" : degradados.length + " redes com degradação" }),
                    el("ul", { classe: "degradados" }, degradados.map(c => el("li", {}, [
                        el("a", { href: "#rede-" + S.chave(c), texto: c.nome }), " — " + (S.ROTULO_MOTIVO[c.atual.motivo] || "")
                    ])))
                ]));
            return alvo;
        }

        function ferramentas(cards, periodo, rerender) {
            const seg = el("div", { classe: "segmentado", "aria-label": "Filtrar por tipo" });
            const opcoes = [["TODOS", "Todos", cards.length]].concat(S.tiposPresentes(cards).map(t => [t, t, cards.filter(c => c.tipo === t).length]));
            for (const [valor, rotulo, qt] of opcoes) {
                const b = el("button", { "aria-pressed": String(estado.tipo === valor) }, [rotulo, el("span", { classe: "contagem", texto: String(qt) })]);
                b.addEventListener("click", () => { estado.tipo = valor; rerender(); });
                seg.appendChild(b);
            }
            const busca = el("input", { classe: "campo", type: "search", placeholder: "Buscar rede (ex.: Cielo)", "aria-label": "Buscar rede", value: estado.busca });
            busca.addEventListener("input", () => { estado.busca = busca.value; renderLinhas(); });
            const so = el("input", { type: "checkbox", checked: estado.soOcorrencia });
            so.addEventListener("change", () => { estado.soOcorrencia = so.checked; renderLinhas(); });
            const ordem = el("select", { classe: "campo", "aria-label": "Ordenar" }, [
                el("option", { value: "nome", texto: "Nome", selected: estado.ordem === "nome" }),
                el("option", { value: "situacao", texto: "Situação", selected: estado.ordem === "situacao" })
            ]);
            ordem.addEventListener("change", () => { estado.ordem = ordem.value; renderLinhas(); });
            return el("div", { classe: "ferramentas", role: "search" }, [
                seg,
                el("div", { classe: "busca" }, [icone("busca"), busca]),
                el("label", { classe: "opcao" }, [so, " Só com ocorrência nas últimas " + periodo]),
                el("label", { classe: "ordem" }, ["Ordenar ", ordem])
            ]);
        }

        let contexto = null, alvoLinhas = null;

        function linha(c, periodo, ciclos) {
            const historico = c.historico.slice(-ciclos);
            const r = S.resumo(historico, periodo);
            const k = S.chave(c);
            const itens = S.itensHistorico(c.historico, ciclos);
            const faixa = S.faixaHistorico("faixa-historico", itens, r.texto);
            const calma = c.atual.status === "baixo_movimento" || c.atual.status === "sem_movimento";
            const botao = el("button", { classe: "expandir", "aria-label": "Detalhes de " + c.nome, "aria-expanded": String(estado.abertas.has(k)) }, [icone("abaixo")]);

            const esq = el("div", {}, [el("h3", { classe: "rotulo-grupo", texto: "Agora (últimos 10 min)" })]);
            esq.appendChild(S.temPercentuais(c.atual) ? S.composicao(c.atual)
                : el("p", { classe: "texto-resumo", texto: c.atual.status === "sem_informacao" ? "Sem dados recentes." : "Sem volume suficiente para calcular percentuais." }));
            const dir = el("div", {}, [el("h3", { classe: "rotulo-grupo", texto: "Ocorrências nas últimas " + periodo })]);
            dir.appendChild(r.ocorrencias.length
                ? el("ul", { classe: "lista-ocorrencias" }, r.ocorrencias.slice().reverse().map(o => el("li", {}, [
                    el("b", { texto: S.fmtHora(o.inicio) + (o.ciclos > 1 ? "–" + S.fmtHora(o.fim) : "") }), " · " + S.ROTULO_MOTIVO[o.motivo]
                ])))
                : el("p", { classe: "texto-resumo", texto: "Nenhuma." }));

            const no = el("div", { classe: "linha" + (calma ? " calma" : "") + (c.atual.status === "degradado" ? " degradada" : ""), id: "rede-" + k, "data-aberta": estado.abertas.has(k) }, [
                el("div", { classe: "linha-resumo" }, [
                    el("span", { classe: "nome-rede", texto: c.rede }),
                    selo(c.atual.status),
                    el("div", { classe: "historico" }, [faixa, el("div", { classe: "eixo" }, [el("span", { texto: "há " + periodo }), el("span", { texto: "agora" })])]),
                    el("span", { classe: "texto-resumo" + (r.nivel === "alerta" ? " alerta" : ""), texto: r.texto }),
                    botao
                ]),
                el("div", { classe: "detalhe" }, [esq, dir])
            ]);
            botao.addEventListener("click", () => {
                if (estado.abertas.has(k)) estado.abertas.delete(k); else estado.abertas.add(k);
                no.toggleAttribute("data-aberta");
                botao.setAttribute("aria-expanded", String(estado.abertas.has(k)));
            });
            return no;
        }

        function renderLinhas() {
            const { cards, prefs, intervaloSeg } = contexto;
            const ciclos = prefs.lista.periodoCiclos;
            const periodo = S.periodoTexto(ciclos, intervaloSeg);
            const busca = estado.busca.trim().toUpperCase();
            alvoLinhas.replaceChildren();
            let total = 0;
            for (const tipo of S.tiposPresentes(cards)) {
                if (estado.tipo !== "TODOS" && estado.tipo !== tipo) continue;
                const doTipo = cards.filter(c => c.tipo === tipo)
                    .filter(c => !busca || c.rede.toUpperCase().includes(busca))
                    .filter(c => !estado.soOcorrencia || S.ocorrencias(c.historico.slice(-ciclos)).length > 0)
                    .sort(estado.ordem === "situacao"
                        ? (a, b) => (S.GRAVIDADE[a.atual.status] - S.GRAVIDADE[b.atual.status]) || a.rede.localeCompare(b.rede)
                        : (a, b) => a.rede.localeCompare(b.rede));
                if (!doTipo.length) continue;
                total += doTipo.length;
                const degradadas = doTipo.filter(c => c.atual.status === "degradado").length;
                const fechada = estado.fechadas.has(tipo);
                const cabeca = el("button", { classe: "secao-cabeca", "aria-expanded": String(!fechada) }, [
                    el("h2", { texto: tipo }),
                    el("span", { classe: "descricao", texto: S.DESCRICAO_TIPO[tipo] || "" }),
                    el("span", { classe: "contagem" }, [doTipo.length + " redes", degradadas ? el("span", { classe: "alerta", texto: " · " + degradadas + " com degradação" }) : null]),
                    icone("abaixo")
                ]);
                const secao = el("section", { classe: "secao", "data-fechada": fechada }, [cabeca, el("div", { classe: "linhas" }, doTipo.map(c => linha(c, periodo, ciclos)))]);
                cabeca.addEventListener("click", () => {
                    if (estado.fechadas.has(tipo)) estado.fechadas.delete(tipo); else estado.fechadas.add(tipo);
                    secao.toggleAttribute("data-fechada");
                    cabeca.setAttribute("aria-expanded", String(!estado.fechadas.has(tipo)));
                });
                alvoLinhas.appendChild(secao);
            }
            if (!total) alvoLinhas.appendChild(vazio("Nenhuma rede encontrada com esses filtros."));
        }

        function render(alvo, ctx) {
            const cards = cardsVisiveis(ctx.modelo, ctx.prefs.comum);
            if (estado.ordem === null) estado.ordem = ctx.prefs.lista.ordem;
            if (ctx.prefs.lista.abrirDegradadas)
                for (const c of cards)
                    if (c.atual.status === "degradado" && !estado.jaAbertas.has(S.chave(c))) { estado.abertas.add(S.chave(c)); estado.jaAbertas.add(S.chave(c)); }
            contexto = { cards, prefs: ctx.prefs, intervaloSeg: ctx.intervaloSeg };
            const periodo = S.periodoTexto(ctx.prefs.lista.periodoCiclos, ctx.intervaloSeg);
            alvoLinhas = el("div");
            const rerender = () => render(alvo, ctx);
            alvo.replaceChildren(geral(ctx.modelo, cards), ferramentas(cards, periodo, rerender), alvoLinhas);
            renderLinhas();
        }

        function esqueleto(alvo) {
            alvo.replaceChildren(
                el("section", { classe: "geral" }, [el("div", { classe: "esqueleto", style: "width:44px;height:44px" }), el("div", { style: "flex:1" }, [el("div", { classe: "esqueleto", style: "height:20px;width:40%" }), el("div", { classe: "esqueleto", style: "height:14px;width:25%;margin-top:8px" })])]),
                el("section", { classe: "secao" }, [el("div", { classe: "esqueleto", style: "height:18px;width:160px;margin:6px 0 10px" }), el("div", { classe: "linhas" }, Array.from({ length: 8 }, () => el("div", { classe: "esqueleto carregando-linha" })))])
            );
        }

        return { render, esqueleto };
    })();

    // =================================================================================
    // B · Cards
    // =================================================================================
    const cards = (function () {
        const estado = { aba: null, busca: "", poucoAberto: null };

        function cartao(c, mostrarTipo, ciclos, periodo) {
            const historico = c.historico.slice(-ciclos);
            const r = S.resumo(historico, periodo);
            const faixa = S.faixaHistorico("faixa-historico", S.itensHistorico(c.historico, ciclos), r.texto);
            const corpo = [];
            if (c.atual.status === "degradado") corpo.push(el("span", { classe: "motivo", texto: S.ROTULO_MOTIVO[c.atual.motivo] }));
            if (S.temPercentuais(c.atual)) {
                corpo.push(el("div", { classe: "principal" }, [el("span", { classe: "numero", texto: S.fmtPct(c.atual.pct_autorizada) }), el("span", { classe: "rotulo", texto: "autorizadas agora" })]));
                const extras = [];
                if (c.atual.pct_negada > 0) extras.push(el("span", { classe: "chip chip-negada", texto: S.fmtPct(c.atual.pct_negada) + " negadas" }));
                if (c.atual.pct_pendente > 0) extras.push(el("span", { classe: "chip chip-pendente", texto: S.fmtPct(c.atual.pct_pendente) + " pendentes" }));
                if (extras.length) corpo.push(el("div", { classe: "extras" }, extras));
            }
            return el("article", { classe: "cartao" + (c.atual.status === "degradado" ? " atencao" : "") }, [
                el("div", { classe: "cabeca" }, [el("div", {}, [mostrarTipo ? el("div", { classe: "tipo", texto: c.tipo }) : null, el("div", { classe: "rede", texto: c.rede })]), selo(c.atual.status)]),
                ...corpo,
                faixa,
                el("div", { classe: "rodape-cartao" }, [
                    el("span", { texto: "há " + periodo }),
                    el("span", { classe: r.nivel === "alerta" ? "alerta" : "", texto: r.ocorrencias.length ? (r.ocorrencias.length === 1 ? "1 degradação" : r.ocorrencias.length + " degradações") : "Sem degradação" }),
                    el("span", { texto: "agora" })
                ])
            ]);
        }

        function render(alvo, ctx) {
            const prefs = ctx.prefs.cards;
            const visiveis = cardsVisiveis(ctx.modelo, ctx.prefs.comum);
            const tipos = S.tiposPresentes(visiveis);
            if (estado.aba === null) estado.aba = prefs.abaInicial;
            if (estado.aba !== "TODAS" && !tipos.includes(estado.aba)) estado.aba = tipos[0] || "TODAS";
            if (estado.poucoAberto === null) estado.poucoAberto = prefs.poucoMovimentoAberto;
            const ciclos = prefs.periodoCiclos;
            const periodo = S.periodoTexto(ciclos, ctx.intervaloSeg);

            // Situação geral
            const deg = visiveis.filter(c => c.atual.status === "degradado");
            const estadoGeral = el("div", { classe: "estado-geral " + (ctx.modelo.desatualizado ? "neutro" : deg.length ? "alerta" : "ok"), "aria-live": "polite" }, [
                el("span", { classe: "ponto" }),
                ctx.modelo.desatualizado ? "Situação atual indisponível"
                    : deg.length ? (deg.length === 1 ? "1 rede precisa de atenção" : deg.length + " redes precisam de atenção") : "Todas as redes operando normalmente"
            ]);

            // Abas
            const abas = el("nav", { classe: "abas", role: "tablist", "aria-label": "Tipo de captura" });
            for (const tipo of tipos.concat(["TODAS"])) {
                const doTipo = tipo === "TODAS" ? visiveis : visiveis.filter(c => c.tipo === tipo);
                const d = doTipo.filter(c => c.atual.status === "degradado").length;
                const b = el("button", { role: "tab", "aria-selected": String(estado.aba === tipo) }, [
                    tipo === "TODAS" ? "Todas" : tipo,
                    el("span", { classe: "qt", texto: String(doTipo.length) }),
                    d ? el("span", { classe: "marca-alerta", title: d + " com degradação" }, [icone("alerta"), String(d)]) : null
                ]);
                b.addEventListener("click", () => { estado.aba = tipo; render(alvo, ctx); });
                abas.appendChild(b);
            }
            const campo = el("input", { classe: "campo", type: "search", placeholder: "Buscar rede", "aria-label": "Buscar rede", value: estado.busca });
            const conteudo = el("div");
            campo.addEventListener("input", () => { estado.busca = campo.value; renderConteudo(); });
            abas.appendChild(el("div", { classe: "busca" }, [icone("busca"), campo]));

            function renderConteudo() {
                conteudo.replaceChildren();
                const busca = estado.busca.trim().toUpperCase();
                const todas = estado.aba === "TODAS";
                const lista = (todas ? visiveis : visiveis.filter(c => c.tipo === estado.aba))
                    .filter(c => !busca || c.rede.toUpperCase().includes(busca))
                    .sort((a, b) => todas ? (tipos.indexOf(a.tipo) - tipos.indexOf(b.tipo)) || a.rede.localeCompare(b.rede) : a.rede.localeCompare(b.rede));
                if (!lista.length) { conteudo.appendChild(vazio("Nenhuma rede encontrada.")); return; }

                const mostrarAtencao = prefs.mostrarAtencao && !busca && deg.length > 0;
                if (mostrarAtencao) {
                    conteudo.appendChild(el("h2", { classe: "bloco rotulo-grupo" }, [icone("alerta"), "Precisa de atenção · todas as categorias"]));
                    conteudo.appendChild(el("div", { classe: "grade" }, deg.map(c => cartao(c, true, ciclos, periodo))));
                } else if (prefs.mostrarAtencao && !busca && !ctx.modelo.desatualizado) {
                    conteudo.appendChild(el("div", { classe: "tudo-ok" }, [icone("check"), "Nenhuma rede com degradação agora."]));
                }

                const ativas = lista.filter(c => !(c.atual.status === "baixo_movimento" || c.atual.status === "sem_movimento"))
                    .filter(c => !(mostrarAtencao && c.atual.status === "degradado"));
                const pouco = lista.filter(c => c.atual.status === "baixo_movimento" || c.atual.status === "sem_movimento");
                if (ativas.length) {
                    conteudo.appendChild(el("h2", { classe: "bloco rotulo-grupo", texto: todas ? "Todas as redes" : estado.aba + (S.DESCRICAO_TIPO[estado.aba] ? " · " + S.DESCRICAO_TIPO[estado.aba] : "") }));
                    conteudo.appendChild(el("div", { classe: "grade" }, ativas.map(c => cartao(c, todas, ciclos, periodo))));
                }
                if (pouco.length) {
                    const det = el("details", { classe: "pouco", open: estado.poucoAberto }, [
                        el("summary", {}, [icone("abaixo"), "Pouco ou nenhum movimento agora (" + pouco.length + ")", el("span", { classe: "explica", texto: "sem volume para avaliar nos últimos 10 min" })]),
                        el("ul", { classe: "lista-pouco" }, pouco.map(c => el("li", {}, [
                            el("span", { texto: (todas ? c.tipo + " · " : "") + c.rede }),
                            el("span", { classe: "info", texto: S.ocorrencias(c.historico.slice(-ciclos)).length ? "teve degradação em " + periodo : S.ROTULO_STATUS[c.atual.status] })
                        ])))
                    ]);
                    det.addEventListener("toggle", () => { estado.poucoAberto = det.open; });
                    conteudo.appendChild(det);
                }
            }

            alvo.replaceChildren(estadoGeral, abas, conteudo);
            renderConteudo();
        }

        function esqueleto(alvo) {
            alvo.replaceChildren(
                el("div", { classe: "esqueleto", style: "height:28px;width:320px;margin-top:4px" }),
                el("div", { classe: "abas" }, Array.from({ length: 4 }, () => el("span", { classe: "esqueleto", style: "width:70px;height:22px;margin:8px 6px" }))),
                el("div", { classe: "grade", style: "margin-top:22px" }, Array.from({ length: 8 }, () => el("div", { classe: "esqueleto esqueleto-cartao" })))
            );
        }

        return { render, esqueleto };
    })();

    // =================================================================================
    // C · Mapa de calor + ocorrências
    // =================================================================================
    const mapa = (function () {
        const estado = { tipo: null, busca: "", soOcorrencia: false };

        function paineis(visiveis, desatualizado, rerender) {
            const alvo = el("section", { classe: "paineis", "aria-label": "Resumo por tipo (clique para filtrar)" });
            for (const tipo of S.tiposPresentes(visiveis)) {
                const doTipo = visiveis.filter(c => c.tipo === tipo);
                const ok = doTipo.filter(c => c.atual.status === "operacional").length;
                const deg = doTipo.filter(c => c.atual.status === "degradado").length;
                const pouco = doTipo.length - ok - deg;
                const dist = el("div", { classe: "distribuicao", "aria-hidden": "true" });
                for (const [classe, qt] of [["d-ok", ok], ["d-deg", deg], ["d-pouco", pouco]])
                    if (qt) { const s = el("span", { classe }); s.style.flex = qt + " 0 0"; dist.appendChild(s); }
                const painel = el("button", { classe: "painel", "aria-pressed": String(estado.tipo === tipo), title: S.DESCRICAO_TIPO[tipo] || tipo }, [
                    el("div", { classe: "cabeca" }, [el("span", { classe: "tipo", texto: tipo }), desatualizado ? selo("sem_informacao") : selo(deg ? "degradado" : "operacional")]),
                    el("div", { classe: "numero" }, [el("b", { texto: String(ok + deg) }), " de " + doTipo.length + " redes com movimento agora"]),
                    dist,
                    el("div", { classe: "legenda" }, [el("span", { texto: ok + " ok" }), deg ? el("span", { texto: deg + " degradada" + (deg > 1 ? "s" : "") }) : null, el("span", { texto: pouco + " pouco mov." })])
                ]);
                painel.addEventListener("click", () => { estado.tipo = estado.tipo === tipo ? null : tipo; rerender(); });
                alvo.appendChild(painel);
            }
            return alvo;
        }

        function linhaDoTempo(visiveis, ciclos, periodo, desatualizado) {
            const lista = [];
            for (const c of visiveis) {
                const historico = c.historico.slice(-ciclos);
                const ultimo = historico[historico.length - 1];
                for (const o of S.ocorrencias(historico))
                    lista.push(Object.assign({ card: c, andamento: !desatualizado && ultimo && o.fim === ultimo.data }, o));
            }
            lista.sort((a, b) => b.fim.localeCompare(a.fim));
            const ul = el("ul", { classe: "linha-tempo" });
            if (!lista.length) ul.appendChild(el("li", { classe: "sem-ocorrencias", texto: "Nenhuma degradação nas últimas " + periodo + "." }));
            for (const o of lista)
                ul.appendChild(el("li", { classe: o.andamento ? "" : "resolvida" }, [
                    el("div", { classe: "quando", texto: S.fmtHora(o.inicio) + (o.ciclos > 1 ? " – " + S.fmtHora(o.fim) : "") }),
                    el("div", { classe: "quem", texto: o.card.tipo + " · " + o.card.rede }),
                    el("div", { classe: "oque", texto: S.ROTULO_MOTIVO[o.motivo] }),
                    el("div", { classe: "situacao " + (o.andamento ? "em-andamento" : "ok"), texto: o.andamento ? "Em andamento" : "Normalizado" })
                ]));
            return el("aside", { classe: "quadro lateral" }, [
                el("div", { classe: "quadro-cabeca" }, [el("h2", { texto: "Ocorrências" }), el("span", { classe: "rotulo-grupo", texto: lista.length ? lista.length + " em " + periodo : "" })]),
                ul
            ]);
        }

        function render(alvo, ctx) {
            const prefs = ctx.prefs.mapa;
            const visiveis = cardsVisiveis(ctx.modelo, ctx.prefs.comum);
            const ciclos = prefs.periodoCiclos;
            const periodo = S.periodoTexto(ciclos, ctx.intervaloSeg);
            if (estado.tipo && !visiveis.some(c => c.tipo === estado.tipo)) estado.tipo = null;
            const rerender = () => render(alvo, ctx);

            // Cursor de tempo comum: destaca a mesma coluna em todas as linhas.
            const datas = S.itensHistorico(ctx.modelo.ciclos.map(d => ({ data: d })), ciclos).map(x => x && x.data);
            const cursor = el("span", { classe: "cursor-hora", hidden: true });
            let colunaAtual = -1;
            const matriz = el("div", { classe: "matriz" + (prefs.densidade === "compacta" ? " compacta" : "") });
            function marcarColuna(i) {
                if (i === colunaAtual) return;
                colunaAtual = i;
                matriz.querySelectorAll(".celulas").forEach(linha => {
                    for (let k = 0; k < linha.children.length; k++) linha.children[k].classList.toggle("coluna", k === i);
                });
                cursor.hidden = i < 0 || !datas[i];
                if (!cursor.hidden) { cursor.textContent = S.fmtHora(datas[i]); cursor.style.left = ((i + 0.5) / ciclos * 100) + "%"; }
            }

            const busca = el("input", { classe: "campo", type: "search", placeholder: "Buscar rede", "aria-label": "Buscar rede", value: estado.busca });
            const so = el("input", { type: "checkbox", checked: estado.soOcorrencia });

            function renderMatriz() {
                matriz.replaceChildren();
                colunaAtual = -1;
                const marcas = el("div", { classe: "marcas" }, [el("span", { texto: "há " + periodo }), el("span", { texto: "agora" }), cursor]);
                matriz.appendChild(el("div", { classe: "eixo", "aria-hidden": "true" }, [el("span", { texto: "Rede" }), el("span", { texto: "Agora" }), marcas]));
                const termo = estado.busca.trim().toUpperCase();
                let total = 0;
                for (const tipo of S.tiposPresentes(visiveis)) {
                    if (estado.tipo && estado.tipo !== tipo) continue;
                    const doTipo = visiveis.filter(c => c.tipo === tipo)
                        .filter(c => !termo || c.rede.toUpperCase().includes(termo))
                        .filter(c => !estado.soOcorrencia || S.ocorrencias(c.historico.slice(-ciclos)).length)
                        .sort((a, b) => a.rede.localeCompare(b.rede));
                    if (!doTipo.length) continue;
                    total += doTipo.length;
                    matriz.appendChild(el("div", { classe: "grupo", texto: tipo + (S.DESCRICAO_TIPO[tipo] ? " · " + S.DESCRICAO_TIPO[tipo] : "") }));
                    for (const c of doTipo) {
                        const r = S.resumo(c.historico.slice(-ciclos), periodo);
                        const celulas = S.faixaHistorico("celulas", S.itensHistorico(c.historico, ciclos), c.rede + ". " + r.texto, marcarColuna);
                        matriz.appendChild(el("div", { classe: "linha-mapa", title: c.nome }, [el("span", { classe: "nome", texto: c.rede }), selo(c.atual.status), celulas]));
                    }
                }
                if (!total) matriz.appendChild(vazio("Nenhuma rede encontrada com esses filtros."));
            }
            busca.addEventListener("input", () => { estado.busca = busca.value; renderMatriz(); });
            so.addEventListener("change", () => { estado.soOcorrencia = so.checked; renderMatriz(); });

            const quadro = el("section", { classe: "quadro" }, [
                el("div", { classe: "quadro-cabeca" }, [
                    el("h2", { texto: (estado.tipo ? estado.tipo + " · " : "") + "Últimas " + periodo }),
                    el("label", {}, [so, " Só com ocorrência"]),
                    el("div", { classe: "busca" }, [icone("busca"), busca])
                ]),
                el("div", { classe: "legenda-mapa" }, [
                    el("span", {}, [el("i", { classe: "d-ok" }), "Operacional"]),
                    el("span", {}, [el("i", { classe: "d-deg" }), "Degradado"]),
                    el("span", {}, [el("i", { classe: "d-pouco" }), "Pouco ou nenhum movimento"]),
                    el("span", {}, [el("i", { classe: "d-vazio" }), "Sem registro"])
                ]),
                matriz
            ]);

            const partes = [];
            if (prefs.mostrarPaineis) partes.push(paineis(visiveis, ctx.modelo.desatualizado, rerender));
            partes.push(el("div", { classe: "corpo" + (prefs.mostrarOcorrencias ? "" : " sem-lateral") }, [
                quadro,
                prefs.mostrarOcorrencias ? linhaDoTempo(visiveis, ciclos, periodo, ctx.modelo.desatualizado) : null
            ]));
            alvo.replaceChildren(...partes);
            renderMatriz();
        }

        function esqueleto(alvo) {
            alvo.replaceChildren(
                el("section", { classe: "paineis" }, Array.from({ length: 4 }, () => el("div", { classe: "esqueleto", style: "height:96px;border-radius:12px" }))),
                el("div", { classe: "corpo" }, [
                    el("section", { classe: "quadro", style: "padding:14px" }, Array.from({ length: 12 }, () => el("div", { classe: "esqueleto", style: "height:22px;margin:8px 0" }))),
                    el("aside", { classe: "quadro", style: "padding:14px" }, Array.from({ length: 4 }, () => el("div", { classe: "esqueleto", style: "height:56px;margin:10px 0" })))
                ])
            );
        }

        return { render, esqueleto };
    })();

    window.Vistas = { lista, cards, mapa };
})();
