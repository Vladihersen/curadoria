// Testes do Jardim da turma. Rodar: npm test (Node 22 ou mais novo, sem instalar nada).
// O banco é um SQLite em memória (node:sqlite) com a mesma forma de uso do D1 da Cloudflare.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker, { resumoMural, mural } from '../src/worker.js';

function bancoFalso() {
  const db = new DatabaseSync(':memory:');
  const preparar = (sql, args = []) => ({
    bind: (...a) => preparar(sql, a),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
  });
  return {
    prepare: (sql) => preparar(sql),
    // O Worker só usa batch para criar as tabelas.
    batch: async (lista) => { for (const p of lista) await p.run(); },
  };
}

const URL_BASE = 'https://vladimirhersen.com.br/bemviver/api/';
const post = (rota, corpo) => new Request(URL_BASE + rota, { method: 'POST', body: JSON.stringify(corpo) });

// O Worker cria as tabelas uma vez por instância, então os testes dividem o mesmo banco.
const ENV = { DB: bancoFalso() };
async function ambiente() { return ENV; }

async function cadastrar(env, nome, whatsapp) {
  const r = await worker.fetch(post('entrar', { nome, whatsapp, nota: 6, dias_paz: 3, consentimento: true }), env);
  return (await r.json()).id;
}

async function marcar(env, id, dia, coisas) {
  const r = await worker.fetch(post('registro', { id, dia, respiros: 0, movimento: 0, ...coisas }), env);
  assert.equal(r.status, 200);
}

test('antes de 23/11 o jardim não aparece', () => {
  assert.deepEqual(resumoMural([{ dia: '2026-11-20', n: 5 }], '2026-11-22'), { fase: 'antes' });
});

test('conta flores da semana e do piloto, e recomeça o jardim na segunda', () => {
  const contagens = [
    { dia: '2026-11-23', n: 10 }, { dia: '2026-11-29', n: 8 }, // semana 1
    { dia: '2026-11-30', n: 7 }, { dia: '2026-12-01', n: 5 }, // semana 2
  ];
  const r = resumoMural(contagens, '2026-12-01');
  assert.equal(r.fase, 'durante');
  assert.equal(r.semana, 2);
  assert.equal(r.flores_semana, 12);
  assert.equal(r.flores_total, 30);
  assert.equal(r.hoje, 5);
});

test('o total de hoje só aparece a partir de 3 pessoas', () => {
  assert.equal(resumoMural([{ dia: '2026-11-24', n: 2 }], '2026-11-24').hoje, null);
  assert.equal(resumoMural([], '2026-11-24').hoje, null);
  assert.equal(resumoMural([{ dia: '2026-11-24', n: 3 }], '2026-11-24').hoje, 3);
});

test('nunca devolve nomes, ids nem o total de cadastradas', () => {
  const r = resumoMural([{ dia: '2026-11-24', n: 9 }], '2026-11-24');
  assert.deepEqual(Object.keys(r).sort(), ['flores_semana', 'flores_total', 'fase', 'hoje', 'marco', 'semana'].sort());
});

test('marcos da turma: o maior já alcançado', () => {
  assert.equal(resumoMural([{ dia: '2026-11-24', n: 49 }], '2026-11-24').marco, null);
  assert.equal(resumoMural([{ dia: '2026-11-24', n: 50 }], '2026-11-24').marco, 50);
  assert.equal(resumoMural([{ dia: '2026-11-24', n: 60 }, { dia: '2026-11-25', n: 60 }], '2026-11-25').marco, 100);
});

test('depois de 20/12 o jardim fica parado e ignora dias fora do piloto', () => {
  const r = resumoMural([{ dia: '2026-12-14', n: 6 }, { dia: '2026-12-20', n: 4 }, { dia: '2026-12-21', n: 9 }], '2026-12-22');
  assert.equal(r.fase, 'fim');
  assert.equal(r.flores_total, 10);
  assert.equal(r.flores_semana, 10);
  assert.equal(r.hoje, undefined);
});

test('API: uma flor por pessoa por dia, e "só paz" ou desmarcar não contam', async () => {
  const env = await ambiente();
  const ana = await cadastrar(env, 'Ana', '21 99999-0001');
  const bia = await cadastrar(env, 'Bia', '21 99999-0002');
  const cris = await cadastrar(env, 'Cris', '21 99999-0003');
  const dora = await cadastrar(env, 'Dora', '21 99999-0004');
  await marcar(env, ana, '2026-11-24', { respiros: 2, noite: true });   // várias práticas = 1 flor
  await marcar(env, bia, '2026-11-24', { movimento: 1 });
  await marcar(env, cris, '2026-11-24', { paz: true });                 // só "teve paz": não conta
  await marcar(env, dora, '2026-11-24', { vida: true });
  await marcar(env, dora, '2026-11-24', { vida: false });               // desmarcou: não conta
  await marcar(env, ana, '2026-11-23', { contato: true });
  await marcar(env, bia, '2026-11-22', { contato: true });              // antes do piloto: não conta
  await marcar(env, bia, '2026-11-25', { contato: true });              // "amanhã": não conta

  const r = await mural(post('mural', { id: ana }), env, '2026-11-24');
  const corpo = await r.json();
  assert.equal(corpo.flores_semana, 3);
  assert.equal(corpo.flores_total, 3);
  assert.equal(corpo.hoje, null); // 2 hoje: abaixo do mínimo
  assert.ok(!JSON.stringify(corpo).includes('Ana'));
});

test('API: só participantes cadastradas veem o jardim', async () => {
  const env = await ambiente();
  const r = await worker.fetch(post('mural', { id: '0'.repeat(32) }), env);
  assert.equal(r.status, 404);
  const g = await worker.fetch(new Request(URL_BASE + 'mural'), env);
  assert.equal(g.status, 405);
});
