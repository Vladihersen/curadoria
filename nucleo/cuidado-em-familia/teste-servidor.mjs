// Testa as funções de proteção de dados do cuidado-worker.js sem precisar
// subir um Worker: extrai as funções puras do arquivo publicado, para o teste
// validar exatamente o código que vai ao ar.
import fs from 'fs'; import path from 'path'; import os from 'os';
import { fileURLToPath } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(AQUI, 'cuidado-worker.js'), 'utf8');
const corta = (nome) => {
  const i = src.indexOf('function ' + nome + '(');
  const j = src.indexOf('\n}\n', i) + 3;
  return src.slice(i, j);
};
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cfw-')), 'fn.mjs');
fs.writeFileSync(tmp, corta('medicamentosTemItensServidor') + '\n' + corta('mesclarDadosFamiliaComSeguranca')
  + '\nexport { medicamentosTemItensServidor, mesclarDadosFamiliaComSeguranca };\n');
const { medicamentosTemItensServidor, mesclarDadosFamiliaComSeguranca } = await import(tmp);

let falhas = 0;
const conferir = (nome, ok, detalhe='') => {
  if (!ok) { falhas++; console.log('  ✗ ' + nome + (detalhe ? ' → ' + detalhe : '')); }
  else console.log('  ✓ ' + nome);
};

console.log('1. Reconhecer que a família TEM remédios');
conferir('nos três turnos antigos', medicamentosTemItensServidor({manha:[{n:1}],almoco:[],noite:[]}));
conferir('só em jejum (horário novo)', medicamentosTemItensServidor({manha:[],almoco:[],noite:[],jejum:[{n:1}]}));
conferir('só ao deitar', medicamentosTemItensServidor({deitar:[{n:1}]}));
conferir('só SOS', medicamentosTemItensServidor({extra_sos:[{n:1}]}));
conferir('vazio é vazio', !medicamentosTemItensServidor({manha:[],almoco:[],noite:[],jejum:[]}));
conferir('nulo é vazio', !medicamentosTemItensServidor(null));

console.log('\n2. Um aparelho com estado incompleto NÃO apaga a família');
const noServidor = {
  medicamentos: {manha:[{nome:'Losartana'},{nome:'AAS'}], almoco:[], noite:[{nome:'Sinvastatina'}], jejum:[{nome:'Omeprazol'}]},
  fotosReceitas: [{id:1},{id:2},{id:3}],
  examesSalvos: [{id:9}],
  turnosAtivos: ['manha','jejum','noite'],
  nomePaciente: 'Dona Maria'
};
const aparelhoZerado = { medicamentos:{manha:[],almoco:[],noite:[]}, fotosReceitas:[], examesSalvos:[], turnosAtivos:[] };
const r = mesclarDadosFamiliaComSeguranca(noServidor, aparelhoZerado);
conferir('remédios preservados', r.medicamentos.manha.length===2 && r.medicamentos.jejum.length===1, JSON.stringify(r.medicamentos));
conferir('receitas preservadas', r.fotosReceitas.length===3, r.fotosReceitas.length+' fotos');
conferir('exames preservados', r.examesSalvos.length===1);
conferir('períodos preservados', r.turnosAtivos.length===3, JSON.stringify(r.turnosAtivos));
conferir('nome preservado', r.nomePaciente==='Dona Maria');

console.log('\n3. Uma mudança de verdade CONTINUA passando');
const mudanca = mesclarDadosFamiliaComSeguranca(noServidor, {
  medicamentos:{manha:[{nome:'Losartana'}], almoco:[], noite:[{nome:'Sinvastatina'}], jejum:[{nome:'Omeprazol'}], deitar:[{nome:'Rivotril'}]},
  fotosReceitas:[{id:1},{id:2},{id:3},{id:4}],
  nomePaciente:'Dona Maria Alves'
});
conferir('remédio removido some', mudanca.medicamentos.manha.length===1, JSON.stringify(mudanca.medicamentos.manha));
conferir('remédio novo entra', mudanca.medicamentos.deitar.length===1);
conferir('receita nova entra', mudanca.fotosReceitas.length===4);
conferir('nome alterado passa', mudanca.nomePaciente==='Dona Maria Alves');

console.log('\n4. O caso que a correção destrava: remédios só em horários novos');
const soNovos = { medicamentos:{manha:[],almoco:[],noite:[],jejum:[{nome:'Omeprazol'}],deitar:[{nome:'Rivotril'}]} };
const aindaVazio = { medicamentos:{manha:[],almoco:[],noite:[]} };
const r4 = mesclarDadosFamiliaComSeguranca(soNovos, aindaVazio);
conferir('não apaga jejum/deitar', r4.medicamentos.jejum && r4.medicamentos.jejum.length===1, JSON.stringify(r4.medicamentos));

console.log(falhas===0 ? '\n✅ todas as verificações passaram' : `\n❌ ${falhas} falha(s)`);
process.exit(falhas?1:0);
