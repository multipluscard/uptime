// Página pública de status: lê as views do Supabase, monta o modelo e entrega à visualização escolhida.
// JS puro, sem build. Visualizações em vistas.js; peças comuns e preferências em comum.js.
(function () {
    "use strict";
    const S = window.Status;
    const { el, icone } = S;

    const config = window.STATUS_CONFIG || {};
    const HISTORICO_QTD = Math.max(1, Math.min(720, Number(config.HISTORICO_QTD) || 60));
    const ATUALIZACAO_SEG = Math.max(15, Number(config.PAGINA_ATUALIZACAO_SEGUNDOS) || 60);
    // Último ciclo mais velho que isso (em múltiplos do intervalo do monitor) = dado desatualizado.
    const FATOR_DESATUALIZADO = 3;

    const elVista = document.getElementById("vista");
    const elAviso = document.getElementById("aviso");
    const elAtualizacao = document.getElementById("atualizacao");

    let prefs = S.lerPreferencias();
    let modelo = null;
    let restante = ATUALIZACAO_SEG;
    let carregando = false;

    // ---------------------------------------------------------------------------------
    // Supabase (REST/PostgREST, só leitura)
    // ---------------------------------------------------------------------------------
    async function buscar(view, consulta) {
        const url = config.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/" + view + "?" + consulta;
        const resposta = await fetch(url, { headers: { apikey: config.SUPABASE_ANON_KEY } });
        if (!resposta.ok)
            throw new Error(view + ": HTTP " + resposta.status);
        return resposta.json();
    }

    async function carregarDados() {
        const [servicos, snapshots, historico] = await Promise.all([
            buscar("vw_tef_servicos", "select=tipo,rede&order=tipo,rede"),
            buscar("vw_tef_snapshot", "select=posicao,data_verificacao,intervalo_consulta_segundos,config&posicao=lte." + HISTORICO_QTD + "&order=posicao"),
            buscar("vw_tef_historico", "select=posicao,tipo,rede,status,motivo,pct_autorizada,pct_negada,pct_pendente&posicao=lte." + HISTORICO_QTD)
        ]);
        return { servicos, snapshots, historico };
    }

    function montarModelo(dados) {
        // posicao 1 = mais recente; o histórico vai do mais antigo ao mais recente.
        const ciclos = dados.snapshots.slice().sort((a, b) => b.posicao - a.posicao);
        const ultimo = dados.snapshots.find(s => s.posicao === 1) || null;

        const itensPorChave = new Map();
        for (const item of dados.historico) {
            const k = item.tipo + "|" + item.rede;
            if (!itensPorChave.has(k)) itensPorChave.set(k, new Map());
            itensPorChave.get(k).set(item.posicao, item);
        }

        let desatualizado = true;
        if (ultimo) {
            const idadeMs = Date.now() - new Date(ultimo.data_verificacao).getTime();
            desatualizado = idadeMs > FATOR_DESATUALIZADO * ultimo.intervalo_consulta_segundos * 1000;
        }

        const cards = dados.servicos.map(servico => {
            const itens = itensPorChave.get(servico.tipo + "|" + servico.rede) || new Map();
            const historico = ciclos.map(ciclo => {
                const item = itens.get(ciclo.posicao);
                return { data: ciclo.data_verificacao, status: item ? item.status : "sem_movimento", motivo: item ? item.motivo : null };
            });
            const atual = desatualizado ? { status: "sem_informacao" } : (itens.get(1) || { status: "sem_movimento" });
            return { tipo: servico.tipo, rede: servico.rede, nome: servico.tipo + " - " + servico.rede, atual, historico };
        });

        return { ultimo, desatualizado, ciclos: ciclos.map(c => c.data_verificacao), cards };
    }

    // ---------------------------------------------------------------------------------
    // Renderização
    // ---------------------------------------------------------------------------------
    function intervaloSeg() { return (modelo && modelo.ultimo && modelo.ultimo.intervalo_consulta_segundos) || 120; }

    // Período nunca maior do que a página busca.
    function prefsEfetivas() {
        const p = JSON.parse(JSON.stringify(prefs));
        for (const grupo of ["lista", "cards", "mapa"]) p[grupo].periodoCiclos = Math.min(p[grupo].periodoCiclos, HISTORICO_QTD);
        return p;
    }

    function vistaAtual() {
        const nome = window.Vistas[prefs.comum.visualizacao] ? prefs.comum.visualizacao : "mapa";
        document.body.dataset.vista = nome;
        elVista.className = "vista-" + nome;
        return window.Vistas[nome];
    }

    function render() {
        const vista = vistaAtual();
        if (!modelo) return;
        vista.render(elVista, { modelo, prefs: prefsEfetivas(), intervaloSeg: intervaloSeg() });
    }

    function avisar(tipo, titulo, texto) {
        elAviso.replaceChildren(el("div", { classe: "aviso " + (tipo === "erro" ? "aviso-erro" : "aviso-alerta") }, [
            icone(tipo === "erro" ? "erro" : "relogio"), el("div", {}, [el("b", { texto: titulo }), texto])
        ]));
    }

    function avisoDoModelo() {
        if (!modelo.ultimo) avisar("alerta", "Ainda não há dados recentes.", "Assim que o monitoramento enviar a primeira verificação, as redes aparecem aqui.");
        else if (modelo.desatualizado) avisar("alerta", "Dados desatualizados.", "O monitoramento não envia dados desde " + S.fmtDataHora(modelo.ultimo.data_verificacao) + ". O histórico abaixo vai até esse horário.");
        else elAviso.replaceChildren();
    }

    function textoAtualizacao() {
        if (!modelo || !modelo.ultimo) return carregando ? "Carregando…" : "";
        const base = "Última verificação às " + S.fmtHora(modelo.ultimo.data_verificacao);
        return prefs.comum.atualizacaoAutomatica ? base + " · próxima atualização em " + restante + " s" : base + " · atualização automática desligada";
    }

    async function atualizar() {
        if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
            avisar("erro", "Configuração ausente.", "Preencha SUPABASE_URL e SUPABASE_ANON_KEY no config.js.");
            return;
        }
        if (carregando) return;
        carregando = true;
        restante = ATUALIZACAO_SEG;
        if (modelo) document.body.classList.add("atualizando");
        else vistaAtual().esqueleto(elVista);
        elAtualizacao.textContent = textoAtualizacao();
        try {
            modelo = montarModelo(await carregarDados());
            avisoDoModelo();
            render();
        } catch (erro) {
            // Mantém a última renderização; só avisa.
            avisar("erro", "Não foi possível atualizar agora.", modelo ? "Mostrando a última atualização. Nova tentativa em instantes." : "Nova tentativa em instantes.");
            if (!modelo) elVista.replaceChildren();
            console.error(erro);
        } finally {
            carregando = false;
            document.body.classList.remove("atualizando");
            elAtualizacao.textContent = textoAtualizacao();
        }
    }

    // ---------------------------------------------------------------------------------
    // Barra superior: atualizar, tema, ajuda (a engrenagem é um link para configuracao.html)
    // ---------------------------------------------------------------------------------
    function desenharBotaoTema() {
        const tema = prefs.comum.tema;
        document.querySelectorAll("[data-tema-botao]").forEach(b => {
            b.replaceChildren(icone(tema === "claro" ? "sol" : tema === "escuro" ? "lua" : "sistema"));
            b.setAttribute("aria-label", "Tema: " + tema + ". Trocar");
            b.title = "Tema: " + tema;
        });
    }

    document.querySelectorAll("[data-tema-botao]").forEach(b => b.addEventListener("click", () => {
        const ordem = ["sistema", "claro", "escuro"];
        prefs.comum.tema = ordem[(ordem.indexOf(prefs.comum.tema) + 1) % ordem.length];
        S.salvarPreferencias(prefs);
        S.aplicarTema(prefs.comum.tema);
        desenharBotaoTema();
    }));
    document.querySelectorAll("[data-atualizar-botao]").forEach(b => { b.appendChild(icone("atualizar")); b.addEventListener("click", atualizar); });
    document.querySelectorAll("[data-config-botao]").forEach(b => b.appendChild(icone("engrenagem")));
    document.querySelectorAll("[data-ajuda-botao]").forEach(b => {
        b.append(icone("interrogacao"), el("span", { classe: "rotulo-botao", texto: "Como ler" }));
        b.addEventListener("click", abrirAjuda);
    });

    function abrirAjuda() {
        const c = (modelo && modelo.ultimo && modelo.ultimo.config) || {};
        const v = (chave, padrao) => (c[chave] !== undefined && c[chave] !== null ? c[chave] : padrao);
        const fundo = el("div", { classe: "ajuda-fundo" });
        const fechar = el("button", { classe: "botao botao-icone fechar", "aria-label": "Fechar ajuda" }, [icone("fechar")]);
        const painel = el("aside", { classe: "ajuda", role: "dialog", "aria-modal": "true", "aria-label": "Como ler esta página" }, [
            fechar,
            el("h2", { texto: "Como ler" }),
            el("p", { texto: "Esta página mostra, quase em tempo real, se as redes de captura atendidas pela Multiplus Card estão processando transações normalmente." }),
            el("h3", { texto: "Situações" }),
            el("ul", {}, [
                el("li", {}, [S.selo("operacional"), " transações fluindo normalmente."]),
                el("li", {}, [S.selo("degradado"), " " + v("alarme_falha_percent", 20) + "% ou mais de transações negadas, ou " + v("limite_pendentes", 5) + " ou mais pendentes, nos últimos " + v("janela_minutos", 10) + " minutos."]),
                el("li", {}, [S.selo("baixo_movimento"), " menos de " + v("minimo_transacoes", 5) + " transações na janela: sem volume para avaliar."]),
                el("li", {}, [S.selo("sem_movimento"), " nenhuma transação na janela mais recente."]),
                el("li", {}, [S.selo("sem_informacao"), " o monitoramento não enviou dados recentes."])
            ]),
            el("h3", { texto: "Histórico" }),
            el("p", { texto: "Cada barra é uma verificação, feita a cada " + Math.round(intervaloSeg() / 60) + " minutos. A mais recente fica à direita. Passe o mouse, toque ou use as setas do teclado para ver o horário e a situação." }),
            el("h3", { texto: "O que não é falha da rede" }),
            el("p", { texto: "Recusas do emissor do cartão (códigos " + v("codigos_fora_do_calculo", "51, 05") + ", como saldo insuficiente) não entram no cálculo." }),
            el("h3", { texto: "Quais redes aparecem" }),
            el("p", { texto: "As redes avaliadas ao menos uma vez nos últimos " + v("dias_card_visivel", 4) + " dias." }),
            el("h3", { texto: "Personalizar" }),
            el("p", {}, ["Em ", el("a", { href: "configuracao.html", texto: "Configurações" }), " você escolhe a visualização (mapa, cards ou lista), os tipos exibidos e outros detalhes. Fica salvo só neste navegador."])
        ]);
        function sair() { fundo.remove(); painel.remove(); document.removeEventListener("keydown", tecla); }
        function tecla(e) { if (e.key === "Escape") sair(); }
        fundo.addEventListener("click", sair);
        fechar.addEventListener("click", sair);
        document.addEventListener("keydown", tecla);
        document.body.append(fundo, painel);
        fechar.focus();
    }

    // Preferências mudadas na página de configurações (em outra aba): aplica na hora.
    window.addEventListener("storage", evento => {
        if (evento.key !== S.CHAVE_PREFERENCIAS) return;
        prefs = S.lerPreferencias();
        S.aplicarTema(prefs.comum.tema);
        desenharBotaoTema();
        render();
    });

    S.aplicarTema(prefs.comum.tema);
    desenharBotaoTema();
    vistaAtual();

    setInterval(() => {
        if (!prefs.comum.atualizacaoAutomatica || carregando) return;
        restante--;
        if (restante <= 0) atualizar();
        else elAtualizacao.textContent = textoAtualizacao();
    }, 1000);

    atualizar();
})();
