// Configuração pública da página. Tudo aqui é visível para qualquer visitante.
// NUNCA coloque aqui chaves secretas.
window.STATUS_CONFIG = {
    // Chave pública (publishable): só permite ler os dados de status.
    SUPABASE_URL: "https://ycjayvzasqdwguzdfhoa.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_uV0FkJAylJhqIie9Jw-H6Q_cU2r4lh9",

    // Quantos ciclos aparecem nas barras de histórico (o monitor roda a cada 2 min: 60 = 2 h).
    // Máximo útil: 720 (as views guardam 24 h).
    HISTORICO_QTD: 60,

    // De quanto em quanto tempo a página busca dados novos.
    PAGINA_ATUALIZACAO_SEGUNDOS: 60
};
