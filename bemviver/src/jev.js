// Cliente do JEV (TypeSafe System One) para o Worker do Bem Viver.
// O JEV não conversa: recebe um "estado" (o texto a julgar) e perguntas fechadas,
// e devolve respostas tipadas com probabilidades. A decisão final fica no código.
//
// A chave fica só no servidor, como secret da Cloudflare:
//   npx wrangler secret put TYPESAFE_API_KEY
// Nunca coloque a chave no código, no wrangler.toml nem no app do celular.

export const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
export const JEV_MODELO = 'jev-latest';

export class JevErro extends Error {
  constructor(mensagem, status = 0, detalhe = null) {
    super(mensagem);
    this.name = 'JevErro';
    this.status = status;
    this.detalhe = detalhe;
  }
}

// Envia uma pergunta ao JEV. Uma falha vira erro (nunca um "não" disfarçado).
// fetchFn existe para os testes trocarem a rede por uma resposta falsa.
export async function perguntarJev(env, { state, questions, model = JEV_MODELO }, fetchFn = fetch) {
  const chave = env && env.TYPESAFE_API_KEY;
  if (!chave) throw new JevErro('TYPESAFE_API_KEY não configurada (wrangler secret put TYPESAFE_API_KEY)');
  let resposta;
  try {
    resposta = await fetchFn(JEV_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${chave}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, state, questions }),
    });
  } catch (e) {
    throw new JevErro(`sem conexão com o JEV: ${e && e.message || e}`);
  }
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new JevErro(`JEV respondeu ${resposta.status}`, resposta.status, corpo && corpo.detail);
  if (!corpo || typeof corpo.answers !== 'object') throw new JevErro('resposta do JEV sem "answers"', resposta.status);
  return corpo;
}
