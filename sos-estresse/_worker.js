export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Raiz "/" → serve index.html. (Com html_handling="none" a raiz não casa
    // com nenhum asset e cai aqui.) NÃO passar `request` como init do new
    // Request: requisição de navegação não pode ser reconstruída (exceção 1101).
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/index.html';
      return env.ASSETS.fetch(url.toString());
    }

    // Qualquer outro arquivo → serve como-é
    return env.ASSETS.fetch(request);
  }
};
