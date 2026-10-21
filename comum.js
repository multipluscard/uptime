// Peças comuns às três visualizações: textos, ícones, selos, resumos e a dica do histórico.
// Todo texto vindo do banco entra por textContent (nada de innerHTML com dado).
(function () {
    "use strict";

    const ORDEM_TIPOS = ["TEF", "POS", "PIX", "WEB"];
    const DESCRICAO_TIPO = {
        TEF: "Transações de cartão nas automações comerciais",
        POS: "Transações de cartão nas maquininhas",
        PIX: "Recebimentos via Pix",
        WEB: "Pagamentos on-line"
    };
    const ROTULO_STATUS = {
        operacional: "Operacional",
        degradado: "Degradado",
        baixo_movimento: "Pouco movimento",
        sem_movimento: "Sem movimento",
        sem_informacao: "Sem informação"
    };
    const ROTULO_MOTIVO = {
        falha: "Alta taxa de falhas",
        pendente: "Transações pendentes",
        falha_e_pendente: "Alta taxa de falhas e transações pendentes"
    };
    const GRAVIDADE = { degradado: 0, sem_informacao: 1, operacional: 2, baixo_movimento: 3, sem_movimento: 4 };

    // Ícones no traço do Tabler Icons (licença MIT).
    const ICONES = {
        check: '<path d="M5 12l5 5l10 -10"/>',
        alerta: '<path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/><path d="M12 16h.01"/>',
        menos: '<path d="M5 12l14 0"/>',
        vazio: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>',
        interrogacao: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 17l0 .01"/><path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4"/>',
        busca: '<path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/>',
        sol: '<path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"/>',
        lua: '<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"/>',
        sistema: '<path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10z"/><path d="M7 20h10"/><path d="M9 16v4"/><path d="M15 16v4"/>',
        atualizar: '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
        abaixo: '<path d="M6 9l6 6l6 -6"/>',
        fechar: '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
        relogio: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>',
        erro: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
        engrenagem: '<path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>',
        lista: '<path d="M9 6l11 0"/><path d="M9 12l11 0"/><path d="M9 18l11 0"/><path d="M5 6l0 .01"/><path d="M5 12l0 .01"/><path d="M5 18l0 .01"/>',
        cards: '<path d="M4 4h6v6h-6z"/><path d="M14 4h6v6h-6z"/><path d="M4 14h6v6h-6z"/><path d="M14 14h6v6h-6z"/>',
        mapa: '<path d="M3 5h4v4h-4z"/><path d="M10 5h4v4h-4z"/><path d="M17 5h4v4h-4z"/><path d="M3 15h4v4h-4z"/><path d="M10 15h4v4h-4z"/><path d="M17 15h4v4h-4z"/>'
    };
    const ICONE_STATUS = { operacional: "check", degradado: "alerta", baixo_movimento: "menos", sem_movimento: "vazio", sem_informacao: "interrogacao" };

    function el(tag, atributos, filhos) {
        const no = document.createElement(tag);
        for (const [nome, valor] of Object.entries(atributos || {})) {
            if (valor === null || valor === undefined || valor === false)
                continue;
            if (nome === "texto") no.textContent = valor;
            else if (nome === "classe") no.className = valor;
            else no.setAttribute(nome, valor === true ? "" : valor);
        }
        for (const filho of [].concat(filhos || []))
            if (filho) no.appendChild(typeof filho === "string" ? document.createTextNode(filho) : filho);
        return no;
    }

    function icone(nome) {
        const span = document.createElement("span");
        span.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONES[nome] || "") + "</svg>";
        return span.firstChild;
    }

    function classeSelo(status) {
        if (status === "operacional") return "selo selo-operacional";
        if (status === "degradado") return "selo selo-degradado";
        return "selo selo-neutro";
    }

    function selo(status) {
        return el("span", { classe: classeSelo(status) }, [icone(ICONE_STATUS[status]), ROTULO_STATUS[status] || status]);
    }

    function fmtPct(v) { return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"; }
    function fmtHora(iso) { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
    function fmtDataHora(iso) { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }

    function temPercentuais(atual) {
        return atual && atual.pct_autorizada !== null && atual.pct_autorizada !== undefined;
    }

    // Tipos presentes, na ordem TEF, POS, PIX, WEB e depois qualquer outro em ordem alfabética.
    function tiposPresentes(cards) {
        const presentes = Array.from(new Set(cards.map(c => c.tipo)));
        return ORDEM_TIPOS.filter(t => presentes.includes(t)).concat(presentes.filter(t => !ORDEM_TIPOS.includes(t)).sort());
    }

    function periodoTexto(ciclos, intervaloSeg) {
        const minutos = Math.round(ciclos * intervaloSeg / 60);
        if (minutos >= 60 && minutos % 60 === 0) return (minutos / 60) + " h";
        if (minutos > 60) return Math.floor(minutos / 60) + " h " + (minutos % 60) + " min";
        return minutos + " min";
    }

    // Trechos seguidos de degradação no histórico (mais antigo -> mais recente).
    function ocorrencias(historico) {
        const lista = [];
        let atual = null;
        for (const h of historico) {
            if (h.status === "degradado") {
                if (atual && atual.motivo === h.motivo) { atual.fim = h.data; atual.ciclos++; }
                else { atual = { inicio: h.data, fim: h.data, motivo: h.motivo, ciclos: 1 }; lista.push(atual); }
            } else {
                atual = null;
            }
        }
        return lista;
    }

    // Resumo em linguagem simples, no lugar do "% dos ciclos".
    function resumo(historico, periodo) {
        const occ = ocorrencias(historico);
        const avaliados = historico.filter(h => h.status === "operacional" || h.status === "degradado").length;
        if (occ.length === 0)
            return { nivel: avaliados ? "ok" : "neutro", texto: avaliados ? "Sem degradação nas últimas " + periodo : "Pouco movimento nas últimas " + periodo, ocorrencias: occ };
        const ultima = occ[occ.length - 1];
        return {
            nivel: "alerta",
            texto: (occ.length === 1 ? "1 degradação" : occ.length + " degradações") + " nas últimas " + periodo + " · última às " + fmtHora(ultima.fim),
            ocorrencias: occ
        };
    }

    // Completa o histórico com vazios à esquerda até o tamanho da janela.
    function itensHistorico(historico, total) {
        const recorte = historico.slice(-total);
        return new Array(Math.max(0, total - recorte.length)).fill(null).concat(recorte);
    }

    function textoDica(h) {
        if (!h) return "Sem registro";
        let t = fmtHora(h.data) + " · " + (ROTULO_STATUS[h.status] || h.status);
        if (h.motivo && ROTULO_MOTIVO[h.motivo]) t += " — " + ROTULO_MOTIVO[h.motivo];
        return t;
    }

    // ---------------------------------------------------------------------------------
    // Dica do histórico: a faixa inteira é a área de toque; o ciclo vem da posição.
    // Teclado: a faixa é um slider (setas percorrem os ciclos).
    // ---------------------------------------------------------------------------------
    let elDica = null;
    function dica() {
        if (!elDica) {
            elDica = el("div", { classe: "dica", role: "tooltip", hidden: true });
            document.body.appendChild(elDica);
        }
        return elDica;
    }

    function mostrarDica(texto, ancora, x) {
        const d = dica();
        d.textContent = texto;
        d.hidden = false;
        const r = ancora.getBoundingClientRect();
        const largura = d.offsetWidth;
        d.style.left = Math.min(Math.max(8, x - largura / 2), window.innerWidth - largura - 8) + "px";
        d.style.top = Math.max(8, r.top - d.offsetHeight - 8) + "px";
    }

    function esconderDica() { if (elDica) elDica.hidden = true; }

    // itens: lista do tamanho total da faixa (null = sem registro), do mais antigo ao mais recente.
    // aoMover (opcional): recebe o índice sob o cursor, ou -1 ao sair.
    function ligarHistorico(faixa, itens, resumoTexto, aoMover) {
        let indice = itens.length - 1;
        faixa.setAttribute("tabindex", "0");
        faixa.setAttribute("role", "slider");
        faixa.setAttribute("aria-label", "Histórico. " + resumoTexto);
        faixa.setAttribute("aria-valuemin", "1");
        faixa.setAttribute("aria-valuemax", String(itens.length));

        function marcar(i, x) {
            indice = Math.max(0, Math.min(itens.length - 1, i));
            const filhos = faixa.children;
            for (let k = 0; k < filhos.length; k++) filhos[k].classList.toggle("ativo", k === indice);
            const texto = textoDica(itens[indice]);
            faixa.setAttribute("aria-valuenow", String(indice + 1));
            faixa.setAttribute("aria-valuetext", texto);
            const r = faixa.getBoundingClientRect();
            mostrarDica(texto, faixa, x !== undefined ? x : r.left + (indice + 0.5) * r.width / itens.length);
            if (aoMover) aoMover(indice);
        }
        function limpar() {
            for (const f of faixa.children) f.classList.remove("ativo");
            esconderDica();
            if (aoMover) aoMover(-1);
        }
        function porPosicao(evento) {
            const r = faixa.getBoundingClientRect();
            marcar(Math.floor((evento.clientX - r.left) / r.width * itens.length), evento.clientX);
        }

        faixa.addEventListener("pointermove", porPosicao);
        faixa.addEventListener("pointerdown", porPosicao);
        faixa.addEventListener("pointerleave", evento => { if (evento.pointerType === "mouse") limpar(); });
        faixa.addEventListener("focus", () => marcar(indice));
        faixa.addEventListener("blur", limpar);
        faixa.addEventListener("keydown", evento => {
            if (evento.key === "ArrowLeft") { marcar(indice - 1); evento.preventDefault(); }
            else if (evento.key === "ArrowRight") { marcar(indice + 1); evento.preventDefault(); }
            else if (evento.key === "Home") { marcar(0); evento.preventDefault(); }
            else if (evento.key === "End") { marcar(itens.length - 1); evento.preventDefault(); }
            else if (evento.key === "Escape") limpar();
        });
    }

    document.addEventListener("pointerdown", evento => {
        if (!evento.target.closest('[role="slider"]')) esconderDica();
    });
    document.addEventListener("scroll", esconderDica, { passive: true });

    // Faixa de histórico (barras), usada pelas três visualizações.
    function faixaHistorico(classe, itens, resumoTexto, aoMover) {
        const faixa = el("div", { classe }, itens.map(h => el("span", { classe: h ? "h-" + h.status : "" })));
        ligarHistorico(faixa, itens, resumoTexto, aoMover);
        return faixa;
    }

    function composicao(atual) {
        const faixas = [["autorizada", "autorizadas", atual.pct_autorizada], ["negada", "negadas", atual.pct_negada], ["pendente", "pendentes", atual.pct_pendente]];
        const barra = el("div", { classe: "barra", "aria-hidden": "true" }, faixas.filter(f => f[2] > 0).map(f => {
            const s = el("span", { classe: f[0] });
            s.style.flex = f[2] + " 0 0";
            return s;
        }));
        return el("div", { classe: "composicao" }, [barra, el("ul", { classe: "valores" }, faixas.map(f => el("li", {}, [
            el("span", { classe: "marca " + f[0], "aria-hidden": "true" }), el("b", { texto: fmtPct(f[2]) }), f[1]
        ])))]);
    }

    function chave(card) { return (card.tipo + "-" + card.rede).toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

    // ---------------------------------------------------------------------------------
    // Preferências do visitante: ficam só neste navegador (localStorage).
    // Grupo "comum" vale para as três visualizações; os outros, para cada uma.
    // ---------------------------------------------------------------------------------
    const CHAVE_PREFERENCIAS = "uptime.preferencias";
    const PREFERENCIAS_PADRAO = {
        comum: { visualizacao: "mapa", tema: "sistema", tiposOcultos: [], mostrarPoucoMovimento: true, atualizacaoAutomatica: true },
        lista: { periodoCiclos: 60, ordem: "nome", abrirDegradadas: true },
        cards: { periodoCiclos: 30, abaInicial: "TEF", mostrarAtencao: true, poucoMovimentoAberto: false },
        mapa: { periodoCiclos: 60, mostrarPaineis: true, mostrarOcorrencias: true, densidade: "normal" }
    };
    const VISUALIZACOES = {
        mapa: { nome: "Mapa de calor", descricao: "Todas as redes no tempo, com a linha do tempo das ocorrências.", icone: "mapa" },
        cards: { nome: "Cards", descricao: "Destaca o que precisa de atenção, com abas por tipo.", icone: "cards" },
        lista: { nome: "Lista", descricao: "Uma linha por rede, densa e rápida de varrer.", icone: "lista" }
    };

    function lerPreferencias() {
        let salvas = {};
        try { salvas = JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS) || "{}") || {}; } catch (e) { salvas = {}; }
        const prefs = {};
        for (const grupo of Object.keys(PREFERENCIAS_PADRAO))
            prefs[grupo] = Object.assign({}, PREFERENCIAS_PADRAO[grupo], salvas[grupo] || {});
        if (!VISUALIZACOES[prefs.comum.visualizacao]) prefs.comum.visualizacao = PREFERENCIAS_PADRAO.comum.visualizacao;
        return prefs;
    }

    function salvarPreferencias(prefs) {
        try { localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(prefs)); return true; }
        catch (e) { return false; } // navegador sem armazenamento: vale só nesta visita
    }

    function aplicarTema(tema) {
        if (tema === "claro") document.documentElement.setAttribute("data-theme", "light");
        else if (tema === "escuro") document.documentElement.setAttribute("data-theme", "dark");
        else document.documentElement.removeAttribute("data-theme");
    }

    // Opções de período do histórico, limitadas ao que a página busca (HISTORICO_QTD do config.js).
    function opcoesPeriodo(maximoCiclos, intervaloSeg) {
        return [15, 30, 60, 120, 180, 360, 720]
            .filter(c => c <= maximoCiclos)
            .map(c => ({ ciclos: c, rotulo: periodoTexto(c, intervaloSeg) }));
    }

    window.Status = {
        CHAVE_PREFERENCIAS, PREFERENCIAS_PADRAO, VISUALIZACOES, lerPreferencias, salvarPreferencias, aplicarTema, opcoesPeriodo,
        ORDEM_TIPOS, DESCRICAO_TIPO, ROTULO_STATUS, ROTULO_MOTIVO, GRAVIDADE,
        el, icone, selo, fmtPct, fmtHora, fmtDataHora, temPercentuais, tiposPresentes, periodoTexto,
        ocorrencias, resumo, itensHistorico, textoDica, ligarHistorico, faixaHistorico, esconderDica, composicao, chave
    };
})();
