// Testes do painel privado: leitura da lista de inscritas colada pelo Vladimir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerListaInscritas } from '../src/worker.js';

test('lista de inscritas aceita ponto e vírgula, traço, vírgula e DDI', () => {
  const lista = lerListaInscritas('Ana Souza; 21 99900-0000\nBeatriz Lima - (21) 99900-0001\nHelena Prado, +55 31 97777-6666\nVanilda Kamiya +351913956627');
  assert.deepEqual(lista.map((x) => x.nome), ['Ana Souza', 'Beatriz Lima', 'Helena Prado', 'Vanilda Kamiya']);
  assert.equal(lista[2].whatsapp, '+55 31 97777-6666');
});

test('linhas sem WhatsApp são ignoradas e número repetido vale uma vez', () => {
  const lista = lerListaInscritas('linha sem telefone\n\nAna; 21999000000\nBia; (21) 99900-0001');
  assert.equal(lista.length, 2);
  assert.equal(lerListaInscritas('Ana; 21999000000\nAna de novo; 21999000000').length, 1);
});
