// Extrai o motor de horários direto do cuidado.html publicado, para o teste
// validar exatamente o código que vai pro ar — e não uma cópia que envelhece.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(aqui, 'cuidado.html'), 'utf8');
const js = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/)[1];
const motor = js.slice(js.indexOf('    const TURNOS = ['), js.indexOf('    let medicamentos = garantirTurnos'))
  + '\nexport { TURNOS, CHAVES_TURNO, interpretarHorarios, turnoDoHorario, turnoPrincipalDaReceita, garantirTurnos };\n';
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cf-')), 'motor.mjs');
fs.writeFileSync(tmp, motor);
const { CHAVES_TURNO, interpretarHorarios, turnoDoHorario, garantirTurnos } = await import(tmp);

const casos = [
  // [texto da receita, turnos que DEVEM sair]
  ['Tomar às 02:00',                          ['madrugada']],
  ['1 comp às 03:00 da madrugada',             ['madrugada']],
  ['Dipirona 4/4h',                            ['madrugada','manha','almoco','tarde','noite']],
  ['Tomar em jejum',                           ['jejum']],
  ['Ao acordar, antes do café da manhã',       ['jejum']],
  ['30 min antes de comer',                    ['jejum']],
  ['Café da manhã',                            ['manha']],
  ['Tomar às 08:00',                           ['manha']],
  ['15 a 30 min antes do almoço',              ['antes_almoco']],
  ['Tomar 30 minutos antes do meio-dia',       ['antes_almoco']],
  ['Após o almoço',                            ['almoco']],
  ['Junto ao almoço',                          ['almoco']],
  ['Ao meio-dia',                              ['almoco']],
  ['No lanche da tarde',                       ['tarde']],
  ['Tomar às 15:00',                           ['tarde']],
  ['Tomar às 16h',                             ['tarde']],
  ['Antes do jantar',                          ['antes_jantar']],
  ['À noite, junto ao jantar',                 ['noite']],
  ['Tomar às 20:00',                           ['noite']],
  ['Ao deitar',                                ['deitar']],
  ['Antes de dormir',                          ['deitar']],
  ['Tomar às 22h ao deitar',                   ['deitar']],
  ['Se necessário para dor',                   ['extra_sos']],
  ['Em caso de febre',                         ['extra_sos']],
  ['SOS',                                      ['extra_sos']],
  // combinações e armadilhas
  ['1 comp após o almoço e ao deitar',         ['almoco','deitar']],
  ['Antes do almoço e antes do jantar',        ['antes_almoco','antes_jantar']],
  ['Manhã e noite',                            ['manha','noite']],
  ['de 8 em 8 horas',                          ['manha','tarde','noite']],
];

let falhas = 0;
for (const [texto, esperado] of casos) {
  const got = interpretarHorarios(texto).shiftKeys;
  const ok = JSON.stringify(got) === JSON.stringify(esperado.slice().sort((a,b)=>CHAVES_TURNO.indexOf(a)-CHAVES_TURNO.indexOf(b)));
  if (!ok) { falhas++; console.log('✗', JSON.stringify(texto), '\n    esperado:', esperado, '\n    obtido:  ', got); }
}

// faixas horárias
const horas = [[2,'madrugada'],[6,'jejum'],[8,'manha'],[11,'antes_almoco'],[12,'almoco'],[15,'tarde'],[18,'antes_jantar'],[20,'noite'],[22,'deitar']];
for (const [h,k] of horas) {
  if (turnoDoHorario(h,0) !== k) { falhas++; console.log('✗ hora', h, '->', turnoDoHorario(h,0), 'esperado', k); }
}

// migração não pode perder nada do que já existe
const antigo = { manha:[{nome:'Losartana'}], almoco:[], noite:[{nome:'Sinvastatina'}], custom:[{nome:'X'}] };
const m = garantirTurnos(antigo);
if (m.manha[0].nome!=='Losartana' || m.noite[0].nome!=='Sinvastatina' || !m.custom || Object.keys(m).length !== CHAVES_TURNO.length+1) {
  falhas++; console.log('✗ migração perdeu dados:', JSON.stringify(m));
}
if (CHAVES_TURNO.length !== 10) { falhas++; console.log('✗ não são 10 turnos'); }

console.log(falhas === 0 ? `\n✅ ${casos.length + horas.length + 2} verificações passaram` : `\n❌ ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
