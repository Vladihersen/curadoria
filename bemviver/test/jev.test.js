// Testes da base do JEV, sem rede: a chamada à API é trocada por respostas falsas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perguntarJev, JevErro, JEV_URL } from '../src/jev.js';
import { decidirDomingo, PERGUNTAS_DOMINGO } from '../src/jev-perguntas.js';
import worker, { testeJev } from '../src/worker.js';

const respostaFalsa = (corpo, status = 200) => async () => new Response(JSON.stringify(corpo), { status });

test('sem a chave, o JEV não é chamado e o erro é claro', async () => {
  let chamou = false;
  await assert.rejects(perguntarJev({}, { state: 'x', questions: {} }, async () => { chamou = true; }), /TYPESAFE_API_KEY/);
  assert.equal(chamou, false);
});

test('envia endpoint, cabeçalhos e corpo certos', async () => {
  let pedido;
  const fetchFalso = async (url, init) => { pedido = { url, init }; return new Response(JSON.stringify({ model: 'jev', answers: {} })); };
  await perguntarJev({ TYPESAFE_API_KEY: 'k' }, { state: { texto: 'oi' }, questions: PERGUNTAS_DOMINGO }, fetchFalso);
  assert.equal(pedido.url, JEV_URL);
  assert.equal(pedido.init.method, 'POST');
  assert.equal(pedido.init.headers.authorization, 'Bearer k');
  assert.equal(pedido.init.headers['content-type'], 'application/json');
  const corpo = JSON.parse(pedido.init.body);
  assert.deepEqual(corpo.state, { texto: 'oi' });
  assert.equal(corpo.model, 'jev-latest');
});

test('erro da API vira JevErro, nunca uma resposta', async () => {
  await assert.rejects(perguntarJev({ TYPESAFE_API_KEY: 'k' }, { state: 'x', questions: {} }, respostaFalsa({ detail: 'ruim' }, 400)),
    (e) => e instanceof JevErro && e.status === 400 && e.detalhe === 'ruim');
});

test('tabela de decisão do domingo', () => {
  const a = (mal, resp, fala, estado) => ({ mal_estar: { noul: mal }, espera_resposta: { noul: resp }, fala_do_estado: { noul: fala }, estado: { choice: estado } });
  assert.deepEqual(decidirDomingo(a(0.4, 0.9, 0.95, 'mais_calma')), { olhar_com_cuidado: true, responder: true, estado: 'mais_calma' });
  assert.deepEqual(decidirDomingo(a(0.1, 0.5, 0.2, 'mais_calma')), { olhar_com_cuidado: false, responder: false, estado: null });
});

test('rota de teste exige a chave do painel', async () => {
  const env = { ADMIN_KEY: 'segredo', DB: { batch: async () => {}, prepare: () => ({}) } };
  const r = await worker.fetch(new Request('https://vladimirhersen.com.br/bemviver/painel/jev'), env);
  assert.notEqual(r.headers.get('content-type'), 'application/json; charset=utf-8');
});

test('teste do painel mostra erro legível quando falta a chave do JEV', async () => {
  const r = await testeJev({});
  assert.equal(r.status, 502);
  assert.equal((await r.json()).ok, false);
});
