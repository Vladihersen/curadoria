// App do Método Bem Viver: o ritual Dia Bem Vivido e a nota de domingo do piloto.
// Tudo fica guardado no celular (localStorage) e é enviado para /dia/api/ quando há internet.
// As "três coisas boas" escritas à noite nunca saem do celular.
'use strict';

const INICIO_PILOTO = '2026-11-16'; // segunda-feira da semana 1

const PERGUNTAS = [
  { tema: 'Escutar sem consertar', pergunta: 'O que está pesando para você agora?', gesto: 'Ouça até o fim, sem dar conselho.' },
  { tema: 'Gratidão dita em voz alta', pergunta: 'Sabe o que eu nunca te disse?', gesto: 'Diga à pessoa o que ela fez de bom na sua vida.' },
  { tema: 'Pedir e oferecer ajuda', pergunta: 'Em que eu posso te ajudar esta semana?', gesto: 'Faça um pedido simples e aceite ajuda.' },
  { tema: 'Lembrar juntos', pergunta: 'Qual foi o dia mais feliz que vivemos juntos?', gesto: 'Revivam uma boa lembrança, com fotos ou objetos.' },
];

// Foco de cada semana do piloto: o ritual fica igual, um pilar ganha destaque e um extra.
const FOCOS = [
  { nome: 'Corpo', extra: 'Nesta semana, faça o respiro de 5 minutos todo dia e os três minutos de movimento.' },
  { nome: 'Pessoas', extra: 'Nesta semana, escreva uma carta de gratidão a alguém vivo, e leia para a pessoa ou envie.' },
  { nome: 'Encantamento', extra: 'Nesta semana, faça uma caminhada mais longa num lugar bonito, sem celular, por uns 30 minutos.' },
  { nome: 'Sentido', extra: 'Pergunta da semana: para quem a minha vida faz diferença, e o que eu quero continuar fazendo?' },
];

const AUDIOS = {
  boasVindas: '/dia/audio/1-boas-vindas.mp3',
  manha: '/dia/audio/2-comeco-do-dia.mp3',
  respiro1: '/dia/audio/3a-respiro-1-minuto.mp3',
  respiro5: '/dia/audio/3b-respiro-5-minutos.mp3',
  noite: '/dia/audio/4-noite.mp3',
  domingo: '/dia/audio/5-domingo.mp3',
};

const TESTE_ZONA = 'Zona de Entusiasmo: firme e confortável. Teste: consigo respirar pelo nariz com calma e sorrir? Se não, recue um pouco.';

const VINCULOS = ['Filha ou filho', 'Marido, esposa ou companheiro(a)', 'Amiga ou amigo', 'Irmã ou irmão', 'Mãe ou pai', 'Neta ou neto', 'Outra pessoa'];

// ---------- Guardar no celular ----------

function ler(chave, padrao) {
  try {
    const v = localStorage.getItem('dia.' + chave);
    return v === null ? padrao : JSON.parse(v);
  } catch {
    return padrao;
  }
}

function gravar(chave, valor) {
  try { localStorage.setItem('dia.' + chave, JSON.stringify(valor)); } catch { /* modo privado: segue sem guardar */ }
}

// ---------- Datas (sempre no fuso do celular) ----------

function isoLocal(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

function hoje() { return isoLocal(new Date()); }

function domingoDaSemana() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); // domingo que fecha a semana (hoje, se for domingo)
  return isoLocal(d);
}

function dataCurta(iso) { return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`; }

function semanaDoPiloto() {
  const inicio = new Date(INICIO_PILOTO + 'T00:00:00');
  const dias = Math.floor((new Date() - inicio) / 86400000);
  return Math.min(4, Math.max(1, Math.floor(dias / 7) + 1));
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ---------- Envio com fila para quando não há internet ----------

async function enviar(rota, dados) {
  const r = await fetch('/dia/api/' + rota, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dados),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const erro = new Error(corpo.erro || 'falha ao enviar');
    erro.definitivo = r.status >= 400 && r.status < 500;
    throw erro;
  }
  return corpo;
}

// A fila guarda só o estado mais recente de cada dia e de cada domingo.
function enfileirar(rota, chave, dados) {
  const fila = ler('fila', {});
  fila[rota + ':' + chave] = { rota, dados };
  gravar('fila', fila);
  esvaziarFila();
}

let esvaziando = false;
async function esvaziarFila() {
  if (esvaziando) return;
  esvaziando = true;
  try {
    const fila = ler('fila', {});
    for (const [chave, item] of Object.entries(fila)) {
      try {
        await enviar(item.rota, item.dados);
        const atual = ler('fila', {});
        if (atual[chave] && JSON.stringify(atual[chave]) === JSON.stringify(item)) delete atual[chave];
        gravar('fila', atual);
      } catch (e) {
        if (e.definitivo) { const atual = ler('fila', {}); delete atual[chave]; gravar('fila', atual); continue; }
        break; // sem internet: tenta de novo depois
      }
    }
  } finally {
    esvaziando = false;
    document.getElementById('aviso-rede').hidden = Object.keys(ler('fila', {})).length === 0 || navigator.onLine;
  }
}

window.addEventListener('online', esvaziarFila);
window.addEventListener('offline', () => {
  if (Object.keys(ler('fila', {})).length) document.getElementById('aviso-rede').hidden = false;
});

// ---------- Pequenos construtores de tela ----------

function el(tag, attrs = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const f of filhos.flat()) if (f != null) n.append(f);
  return n;
}

function botaoMarcar(rotulo, ligado, aoMudar) {
  const b = el('button', { type: 'button', class: 'marcar', 'aria-pressed': String(!!ligado) }, rotulo);
  b.addEventListener('click', () => {
    const novo = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(novo));
    aoMudar(novo);
  });
  return b;
}

function escala(min, max, valor, aoEscolher, classe = '') {
  const caixa = el('div', { class: 'escala ' + classe, role: 'group' });
  for (let i = min; i <= max; i++) {
    const b = el('button', { type: 'button', 'aria-pressed': String(valor === i) }, String(i));
    b.addEventListener('click', () => {
      caixa.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      aoEscolher(i);
    });
    caixa.append(b);
  }
  return caixa;
}

function simNao(valor, aoEscolher) {
  const caixa = el('div', { class: 'opcoes', role: 'group' });
  for (const [rotulo, v] of [['Sim', true], ['Não', false]]) {
    const b = el('button', { type: 'button', 'aria-pressed': String(valor === v) }, rotulo);
    b.addEventListener('click', () => {
      caixa.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      aoEscolher(v);
    });
    caixa.append(b);
  }
  return caixa;
}

// Player que dá lugar a um aviso enquanto o áudio não foi gravado.
const audioExiste = {};
function audio(src) {
  const caixa = el('div');
  const emBreve = () => caixa.replaceChildren(el('p', { class: 'suave' }, 'O áudio guiado chega em breve.'));
  const tocar = () => caixa.replaceChildren(el('audio', { controls: true, preload: 'none', src }));
  audioExiste[src] ??= fetch(src, { method: 'HEAD' }).then((r) => r.ok).catch(() => null);
  audioExiste[src].then((ok) => (ok === false ? emBreve() : tocar()));
  return caixa;
}

const app = document.getElementById('app');
const titulo = document.getElementById('titulo');
const abas = document.getElementById('abas');

function mostrar(...filhos) {
  app.replaceChildren(...filhos);
  window.scrollTo(0, 0);
}

// ---------- Entrada no piloto ----------

function telaEntrar() {
  abas.hidden = true;
  titulo.textContent = 'Dia Bem Vivido';
  const dados = { nota: null, dias_paz: null };
  const nome = el('input', { type: 'text', id: 'nome', autocomplete: 'given-name', maxlength: '80' });
  const whats = el('input', { type: 'tel', id: 'whats', autocomplete: 'tel', inputmode: 'tel', placeholder: '(21) 99999-9999', maxlength: '30' });
  const aceite = el('input', { type: 'checkbox', id: 'aceite' });
  const msg = el('p', { role: 'status' });
  const botao = el('button', { type: 'submit' }, 'Começar');

  const form = el('form', { class: 'cartao', novalidate: true },
    el('h2', {}, 'Boas-vindas ao piloto'),
    el('p', {}, 'Quatro semanas de práticas de poucos minutos por dia, com o Vladimir Hersen.'),
    el('label', { for: 'nome' }, 'Seu nome'), nome,
    el('label', { for: 'whats' }, 'WhatsApp com DDD'), whats,
    el('p', { class: 'suave' }, 'Só o Vladimir vê esse número, para falar com você se precisar.'),
    el('label', {}, 'De 0 a 10, quão satisfeita você está com a sua vida hoje?'),
    escala(0, 10, null, (v) => { dados.nota = v; }),
    el('div', { class: 'escala-rotulos' }, el('span', {}, '0 nada'), el('span', {}, '10 totalmente')),
    el('label', {}, 'Na última semana, em quantos dias você sentiu paz?'),
    escala(0, 7, null, (v) => { dados.dias_paz = v; }, 'oito'),
    el('label', { class: 'consentimento', for: 'aceite' }, aceite,
      el('span', {}, 'Quero participar do piloto. Concordo que o Vladimir veja minhas respostas para acompanhar o método. Elas não serão publicadas nem passadas a ninguém, e posso sair quando quiser.')),
    msg, botao,
  );

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    msg.className = 'erro';
    if (!nome.value.trim()) return void (msg.textContent = 'Escreva seu nome.');
    if (whats.value.replace(/\D/g, '').length < 10) return void (msg.textContent = 'Escreva o WhatsApp com DDD.');
    if (dados.nota === null) return void (msg.textContent = 'Escolha a nota de 0 a 10.');
    if (dados.dias_paz === null) return void (msg.textContent = 'Escolha em quantos dias sentiu paz.');
    if (!aceite.checked) return void (msg.textContent = 'Marque a concordância para participar.');
    botao.disabled = true;
    msg.className = 'suave';
    msg.textContent = 'Enviando…';
    try {
      const r = await enviar('entrar', { nome: nome.value, whatsapp: whats.value, nota: dados.nota, dias_paz: dados.dias_paz, consentimento: true });
      gravar('id', r.id);
      gravar('inicio', { nota: dados.nota, dias_paz: dados.dias_paz });
      gravar('nome', nome.value.trim().split(/\s+/)[0]);
      telaBoasVindas();
    } catch (e) {
      botao.disabled = false;
      msg.className = 'erro';
      msg.textContent = navigator.onLine ? 'Não deu certo agora. Tente de novo em instantes.' : 'Você está sem internet. Conecte-se para entrar no piloto.';
    }
  });
  mostrar(form);
}

function telaBoasVindas() {
  abas.hidden = true;
  titulo.textContent = 'Que bom que você chegou';
  mostrar(
    el('section', { class: 'cartao' },
      el('h2', {}, 'Ouça primeiro'),
      el('p', {}, 'Quatro minutos com o Vladimir explicando como funciona.'),
      audio(AUDIOS.boasVindas),
      el('h3', {}, 'Os quatro pilares'),
      el('p', {}, el('b', {}, 'Bem respirar'), ': um respiro de 1 minuto na hora do aperto, ou 5 minutos quando houver tempo.'),
      el('p', {}, el('b', {}, 'Bem fazer'), ': três minutos de movimento ao longo do dia e uma coisa pequena que te dá vida.'),
      el('p', {}, el('b', {}, 'Bem querer'), ': um contato de verdade por dia e, uma vez por semana, um Encontro de Verdade.'),
      el('p', {}, el('b', {}, 'Bem ver'), ': à noite, três coisas boas do dia e desejar o bem a quem você ama.'),
      el('p', {}, 'Em dia corrido, faça a versão mínima: um minuto de cada já conta. Nunca zero, nunca forçado.'),
      el('p', { class: 'suave' }, TESTE_ZONA),
      el('p', { class: 'suave' }, '"A felicidade vem de uma vida significativa e não de uma vida fácil." Maria Nogueira Maia'),
      el('h3', {}, 'O teste de 60 segundos'),
      el('p', {}, 'Dê uma nota para a sua tensão, faça 1 minuto de respiro e dê a nota de novo. Veja com os seus olhos o que um minuto faz.'),
      el('button', { type: 'button', onclick: () => fazerRespiro(60) }, 'Fazer o teste agora'),
      el('button', { type: 'button', class: 'secundario', onclick: () => irPara('hoje') }, 'Ir para o meu dia'),
    ),
  );
}

// ---------- Hoje ----------

const REGISTRO_VAZIO = { respiros: [], movimento: 0, vida: false, contato: false, noite: false, paz: null };

function registroDe(dia) {
  return { ...REGISTRO_VAZIO, ...(ler('registros', {})[dia] || {}) };
}

function mediaTensao(respiros) {
  if (!respiros.length) return null;
  const soma = respiros.reduce((t, r) => ({ a: t.a + r.antes, d: t.d + r.depois }), { a: 0, d: 0 });
  return { antes: soma.a / respiros.length, depois: soma.d / respiros.length };
}

function praticou(reg) {
  return reg.respiros.length > 0 || reg.movimento > 0 || reg.vida || reg.contato || reg.noite;
}

function salvarRegistro(dia, reg) {
  const todos = ler('registros', {});
  todos[dia] = reg;
  gravar('registros', todos);
  const m = mediaTensao(reg.respiros);
  enfileirar('registro', dia, {
    id: ler('id'), dia,
    respiros: reg.respiros.length,
    tensao_antes: m ? Math.round(m.antes * 10) / 10 : null,
    tensao_depois: m ? Math.round(m.depois * 10) / 10 : null,
    movimento: reg.movimento, vida: reg.vida, contato: reg.contato, noite: reg.noite, paz: reg.paz,
  });
}

function ontem() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return isoLocal(d);
}

function telaHoje() {
  const dia = hoje();
  const reg = registroDe(dia);
  const semana = semanaDoPiloto();
  const foco = FOCOS[semana - 1];
  const enc = PERGUNTAS[semana - 1];
  titulo.textContent = `${saudacao()}${ler('nome') ? ', ' + ler('nome') : ''}`;
  const marcar = (cartao, feito) => cartao.classList.toggle('feito', feito);

  const cFoco = el('section', { class: 'cartao destaque' },
    el('p', { class: 'pilar' }, `Semana ${semana} de 4 · foco: ${foco.nome}`),
    el('p', {}, foco.extra),
    el('p', { class: 'suave' }, TESTE_ZONA),
  );

  const m = mediaTensao(reg.respiros);
  const cRespiro = el('section', { class: 'cartao' + (reg.respiros.length ? ' feito' : '') },
    el('p', { class: 'pilar' }, 'Bem respirar · quando apertar'),
    el('h2', {}, 'Respiro'),
    el('p', {}, 'Puxe o ar pelo nariz, dê mais uma puxadinha e solte devagar pela boca. Antes e depois, uma nota para a sua tensão.'),
    m ? el('p', { class: 'resultado' }, `Hoje: ${reg.respiros.length} ${reg.respiros.length === 1 ? 'respiro' : 'respiros'}, tensão média de ${m.antes.toFixed(1).replace('.', ',')} para ${m.depois.toFixed(1).replace('.', ',')}.`) : null,
    el('button', { type: 'button', onclick: () => fazerRespiro(60) }, 'Respiro de 1 minuto'),
    el('button', { type: 'button', class: 'secundario', onclick: () => fazerRespiro(300) }, 'Respiro de 5 minutos'),
    el('details', {}, el('summary', {}, 'Prefere ouvir o Vladimir?'), audio(AUDIOS.respiro1), audio(AUDIOS.respiro5)),
  );

  const passos = el('div', { class: 'pausas', role: 'group', 'aria-label': 'Minutos de movimento hoje' });
  const desenharPassos = () => {
    passos.replaceChildren(...[1, 2, 3].map((n) => el('button', {
      type: 'button',
      'aria-pressed': String(reg.movimento >= n),
      'aria-label': `Minuto de movimento ${n}`,
      onclick: () => {
        reg.movimento = reg.movimento >= n ? n - 1 : n;
        salvarRegistro(dia, reg); desenharPassos(); marcar(cCorpo, reg.movimento > 0);
      },
    }, `${n}º minuto`)));
  };
  const cCorpo = el('section', { class: 'cartao' + (reg.movimento > 0 ? ' feito' : '') },
    el('p', { class: 'pilar' }, 'Bem fazer · o corpo'),
    el('h2', {}, 'Movimento de bolso'),
    el('p', {}, 'Três vezes hoje, 1 minuto de passo rápido ou escada, preso a algo que já acontece: ir ao ponto, subir para casa, esperar o café. A respiração acelera, mas dá para falar.'),
    el('p', { class: 'suave' }, 'Dia calmo? Uma caminhada ao ar livre vale pelos três. Andar enquanto faz a ligação do dia também conta.'),
    audio(AUDIOS.manha),
    passos,
  );
  desenharPassos();

  const escolhida = (ler('amanha', {})[ontem()] || '').trim();
  const cVida = el('section', { class: 'cartao' + (reg.vida ? ' feito' : '') },
    el('p', { class: 'pilar' }, 'Bem fazer · a vida'),
    el('h2', {}, 'A coisa que me dá vida'),
    escolhida
      ? el('p', { class: 'pergunta' }, `Você escolheu ontem: "${escolhida}"`)
      : el('p', {}, 'Escolha agora uma coisa pequena que te dá prazer ou sentido: cozinhar ouvindo música, regar as plantas, ler dez páginas, visitar alguém.'),
    botaoMarcar('Fiz a coisa que me dá vida', reg.vida, (v) => { reg.vida = v; salvarRegistro(dia, reg); marcar(cVida, v); }),
  );

  const cContato = el('section', { class: 'cartao' + (reg.contato ? ' feito' : '') },
    el('p', { class: 'pilar' }, 'Bem querer · durante o dia'),
    el('h2', {}, 'Um contato de verdade'),
    el('p', {}, 'Uma mensagem de apreço específica ("lembrei de você porque..."), uma ligação de 5 minutos ou uma conversa com alguém do caminho. Quem recebe costuma ficar mais feliz do que a gente imagina.'),
    el('p', { class: 'suave' }, 'Se hoje for difícil falar com alguém, escreva a mensagem sem enviar. Também conta.'),
    botaoMarcar('Fiz meu contato de hoje', reg.contato, (v) => { reg.contato = v; salvarRegistro(dia, reg); marcar(cContato, v); }),
  );

  const boas = ler('boas', {});
  const minhas = boas[dia] || ['', '', ''];
  const dicas = ['1. Algo bom de hoje, e por quê', '2. Algo bom que veio de uma pessoa', '3. Algo bom que eu mesma fiz'];
  const campos = minhas.map((t, i) => {
    const c = el('input', { type: 'text', value: t, 'aria-label': `Coisa boa ${i + 1}`, placeholder: dicas[i] });
    c.addEventListener('input', () => {
      const todas = ler('boas', {});
      todas[dia] = campos.map((x) => x.value);
      gravar('boas', todas);
    });
    return c;
  });
  const amanha = el('input', { type: 'text', id: 'amanha', maxlength: '120', value: ler('amanha', {})[dia] || '', placeholder: 'Ex.: ligar para a minha irmã' });
  amanha.addEventListener('input', () => {
    const todas = ler('amanha', {});
    todas[dia] = amanha.value;
    gravar('amanha', todas);
  });
  const cNoite = el('section', { class: 'cartao' + (reg.noite ? ' feito' : '') },
    el('p', { class: 'pilar' }, 'Bem ver e Bem querer · noite'),
    el('h2', {}, 'Três coisas boas e amor-bondade'),
    el('p', {}, 'Lembre três coisas boas do dia e por que aconteceram. Escolha uma e fique um minuto com ela, saboreando. Depois deseje o bem a quem você ama, e a você mesma.'),
    ...campos,
    el('p', { class: 'suave' }, 'O que você escreve aqui fica só no seu celular.'),
    el('p', { class: 'frase' }, 'Que você esteja em paz. Que você tenha saúde. Que você seja feliz.'),
    el('p', { class: 'frase' }, 'Que eu esteja em paz. Que eu tenha saúde. Que eu seja feliz.'),
    el('p', { class: 'frase' }, 'Que todos os seres sejam felizes.'),
    el('label', { for: 'amanha' }, 'Amanhã, a coisa que vai me dar vida'), amanha,
    audio(AUDIOS.noite),
    botaoMarcar('Fiz a prática da noite', reg.noite, (v) => { reg.noite = v; salvarRegistro(dia, reg); marcar(cNoite, v); }),
    el('label', {}, 'Hoje teve um momento de paz?'),
    simNao(reg.paz, (v) => { reg.paz = v; salvarRegistro(dia, reg); }),
  );

  const cEncontro = el('section', { class: 'cartao' },
    el('p', { class: 'pilar' }, `Bem querer · semana ${semana} de 4`),
    el('h2', {}, `Encontro de Verdade: ${enc.tema}`),
    el('p', {}, 'Uma vez nesta semana, 20 a 30 minutos com alguém importante, com o celular guardado longe. Comece pela pergunta e escute.'),
    el('p', { class: 'pergunta' }, `"${enc.pergunta}"`),
    el('p', { class: 'suave' }, enc.gesto),
  );

  mostrar(cFoco, cRespiro, cCorpo, cVida, cContato, cNoite, cEncontro);
}

// Nota de tensão de 0 a 10, pedida antes e depois de cada respiro.
function telaTensao(momento, aoEscolher) {
  abas.hidden = true;
  titulo.textContent = momento === 'antes' ? 'Antes de começar' : 'E agora?';
  mostrar(el('section', { class: 'cartao' },
    el('h2', {}, momento === 'antes' ? 'Como está a sua tensão agora?' : 'Como está a sua tensão agora, depois do respiro?'),
    el('p', { class: 'suave' }, 'O primeiro número que vier é o certo.'),
    escala(0, 10, null, aoEscolher),
    el('div', { class: 'escala-rotulos' }, el('span', {}, '0 nenhuma'), el('span', {}, '10 muita')),
    el('button', { type: 'button', class: 'secundario', onclick: () => irPara('hoje') }, 'Voltar'),
  ));
}

function fazerRespiro(segundos) {
  telaTensao('antes', (antes) => {
    telaPausa(segundos, () => {
      telaTensao('depois', (depois) => {
        const dia = hoje();
        const reg = registroDe(dia);
        reg.respiros = [...reg.respiros, { antes, depois }];
        salvarRegistro(dia, reg);
        const frase = depois < antes
          ? `Você chegou em ${antes} e saiu em ${depois}.`
          : `Você chegou em ${antes} e saiu em ${depois}. Tudo bem: às vezes o corpo precisa de mais de um respiro.`;
        abas.hidden = true;
        titulo.textContent = 'Pronto';
        mostrar(el('section', { class: 'cartao' },
          el('p', { class: 'resultado grande' }, frase),
          el('button', { type: 'button', onclick: () => irPara('hoje') }, 'Voltar para o meu dia'),
        ));
      });
    });
  });
}

// Respiro guiado: inspira pelo nariz, puxadinha, solta pela boca. 1 ou 5 minutos.
function telaPausa(segundos, aoTerminar) {
  abas.hidden = true;
  titulo.textContent = segundos >= 300 ? 'Respiro de 5 minutos' : 'Respiro de 1 minuto';
  const FASES = [
    { texto: 'Puxe o ar pelo nariz, devagar', ms: 2500, escala: 0.9 },
    { texto: 'Mais um pouquinho', ms: 1000, escala: 1 },
    { texto: 'Solte pela boca, bem devagar', ms: 6000, escala: 0.55 },
  ];
  const TOTAL_MS = segundos * 1000;
  const bolha = el('div', { class: 'bolha', 'aria-hidden': 'true' });
  const fase = el('p', { class: 'fase', 'aria-live': 'polite' }, 'Sente-se ou deite-se. Deixe o corpo pesar.');
  const resta = el('p', { class: 'suave' }, segundos >= 120 ? `${Math.round(segundos / 60)} minutos` : '1 minuto');
  const parar = el('button', { type: 'button', class: 'secundario' }, 'Parar');
  let ativo = true;
  let tempo;

  const fim = (completou) => {
    ativo = false; clearTimeout(tempo);
    if (completou) aoTerminar();
    else irPara('hoje');
  };
  parar.addEventListener('click', () => fim(false));

  const inicio = Date.now() + 3000;
  let i = 0;
  const passo = () => {
    if (!ativo) return;
    const decorrido = Date.now() - inicio;
    if (decorrido >= TOTAL_MS && i % FASES.length === 0) {
      fase.textContent = 'Pronto. Deixe a respiração voltar ao normal.';
      bolha.style.transitionDuration = '2000ms';
      bolha.style.transform = 'scale(.55)';
      resta.textContent = '';
      parar.replaceWith(el('button', { type: 'button', onclick: () => fim(true) }, 'Concluir'));
      return;
    }
    const f = FASES[i % FASES.length];
    fase.textContent = f.texto;
    bolha.style.transitionDuration = f.ms + 'ms';
    bolha.style.transform = `scale(${f.escala})`;
    const seg = Math.max(0, Math.ceil((TOTAL_MS - decorrido) / 1000));
    resta.textContent = seg > 60 ? `${Math.ceil(seg / 60)} minutos` : `${seg} segundos`;
    i++;
    tempo = setTimeout(passo, f.ms);
  };
  tempo = setTimeout(passo, 3000);

  mostrar(el('section', { class: 'cartao guia' },
    bolha, fase, resta,
    el('p', { class: 'suave' }, 'Se sentir tontura, volte a respirar normal. A respiração é suave, nunca forçada.'),
    parar,
  ));
}

// ---------- Domingo ----------

function telaDomingo() {
  const domingo = domingoDaSemana();
  const salvos = ler('semanas', {})[domingo] || {};
  const s = {
    nota: salvos.nota ?? null, dias_paz: salvos.dias_paz ?? null,
    encontro: salvos.encontro ?? null, encontro_com: salvos.encontro_com || '',
    efeito_ruim: salvos.efeito_ruim ?? null, efeito_texto: salvos.efeito_texto || '', duvida: salvos.duvida || '',
  };
  const semana = semanaDoPiloto();
  titulo.textContent = 'Domingo';

  const com = el('select', { id: 'com', 'aria-label': 'Com quem foi o encontro' },
    el('option', { value: '' }, 'Escolha'),
    ...VINCULOS.map((v) => el('option', { value: v, selected: s.encontro_com === v }, v)));
  com.addEventListener('change', () => { s.encontro_com = com.value; });
  const caixaCom = el('div', { hidden: s.encontro !== true }, el('label', { for: 'com' }, 'Com quem? (sem nome, só o vínculo)'), com);

  const efeito = el('textarea', { id: 'efeito', maxlength: '600', placeholder: 'Conte o que aconteceu' }, s.efeito_texto);
  efeito.addEventListener('input', () => { s.efeito_texto = efeito.value; });
  const caixaEfeito = el('div', { hidden: s.efeito_ruim !== true }, el('label', { for: 'efeito' }, 'O que foi?'), efeito,
    el('p', { class: 'suave' }, 'O Vladimir lê cada resposta e entra em contato.'));

  const duvida = el('textarea', { id: 'duvida', maxlength: '600', placeholder: 'Opcional' }, s.duvida);
  duvida.addEventListener('input', () => { s.duvida = duvida.value; });

  const msg = el('p', { role: 'status' });
  const botao = el('button', { type: 'button' }, salvos.nota != null ? 'Atualizar respostas' : 'Enviar respostas');
  botao.addEventListener('click', () => {
    msg.className = 'erro';
    if (s.nota === null) return void (msg.textContent = 'Escolha a nota de 0 a 10.');
    if (s.dias_paz === null) return void (msg.textContent = 'Escolha em quantos dias sentiu paz.');
    const dados = {
      id: ler('id'), domingo, nota: s.nota, dias_paz: s.dias_paz,
      encontro: s.encontro === true, encontro_com: s.encontro === true ? s.encontro_com : '',
      efeito_ruim: s.efeito_ruim === true, efeito_texto: s.efeito_ruim === true ? s.efeito_texto : '',
      duvida: s.duvida,
    };
    const todas = ler('semanas', {});
    todas[domingo] = dados;
    gravar('semanas', todas);
    enfileirar('semana', domingo, dados);
    msg.className = 'ok';
    msg.textContent = navigator.onLine ? 'Recebido. Obrigado por responder.' : 'Guardado. Será enviado quando a internet voltar.';
    botao.textContent = 'Atualizar respostas';
  });

  // Calendário da semana: cada dia mostra se houve prática e se houve um momento de paz.
  const regs = ler('registros', {});
  const NOMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const diasSemana = [];
  for (let k = 6; k >= 0; k--) {
    const d = new Date(domingo + 'T12:00:00');
    d.setDate(d.getDate() - k);
    const iso = isoLocal(d);
    diasSemana.push({ iso, nome: NOMES[d.getDay()], reg: regs[iso] ? { ...REGISTRO_VAZIO, ...regs[iso] } : null });
  }
  const diasFeitos = diasSemana.filter((x) => x.reg && praticou(x.reg)).length;
  const calendario = el('div', { class: 'calendario', role: 'list', 'aria-label': 'Sua semana' },
    ...diasSemana.map((x) => {
      const feito = x.reg && praticou(x.reg);
      const paz = x.reg && x.reg.paz === true;
      return el('div', { role: 'listitem', class: 'dia' + (feito ? ' feito' : '') + (paz ? ' paz' : ''),
        'aria-label': `${x.nome}: ${feito ? 'praticou' : 'sem prática'}${paz ? ', com momento de paz' : ''}` },
      el('span', {}, x.nome), el('b', {}, paz ? '☼' : feito ? '•' : ''));
    }));
  const respirosSemana = diasSemana.flatMap((x) => (x.reg ? x.reg.respiros : []));
  const tensao = mediaTensao(respirosSemana);
  const virgula = (n) => n.toFixed(1).replace('.', ',');

  // Na semana 4, o retrato do começo ao lado de agora.
  const inicio = ler('inicio', null);
  const comparar = semana === 4 && inicio && s.nota !== null
    ? el('p', { class: 'resultado' }, `No começo: nota ${inicio.nota} e paz em ${inicio.dias_paz} de 7 dias. Agora: nota ${s.nota} e paz em ${s.dias_paz ?? '–'} de 7 dias.`)
    : null;

  const intencoes = ler('intencoes', {});
  const intencao = el('input', { type: 'text', id: 'intencao', maxlength: '160', value: intencoes[domingo] || '', placeholder: 'Nesta semana, eu escolho...' });
  intencao.addEventListener('input', () => {
    const todas = ler('intencoes', {});
    todas[domingo] = intencao.value;
    gravar('intencoes', todas);
  });
  const proximo = FOCOS[Math.min(3, semana)];

  mostrar(
    el('section', { class: 'cartao' },
      el('h2', {}, `Semana que termina em ${dataCurta(domingo)}`),
      calendario,
      el('p', { class: 'suave' }, `Você praticou em ${diasFeitos} de 7 dias. • prática · ☼ momento de paz`),
      tensao ? el('p', { class: 'resultado' }, `${respirosSemana.length === 1 ? 'No respiro' : `Nos ${respirosSemana.length} respiros`} da semana, sua tensão foi em média de ${virgula(tensao.antes)} para ${virgula(tensao.depois)}.`) : null,
      diasFeitos < 7 ? el('p', {}, 'Teve dia em branco? Tudo bem. Recomeçar sem culpa faz parte do método.') : null,
      audio(AUDIOS.domingo),
      el('label', {}, 'De 0 a 10, quão satisfeita você está com a sua vida?'),
      escala(0, 10, s.nota, (v) => { s.nota = v; }),
      el('div', { class: 'escala-rotulos' }, el('span', {}, '0 nada'), el('span', {}, '10 totalmente')),
      el('label', {}, 'Em quantos dias desta semana você sentiu paz?'),
      escala(0, 7, s.dias_paz, (v) => { s.dias_paz = v; }, 'oito'),
      el('label', {}, `O Encontro de Verdade aconteceu? (${PERGUNTAS[semana - 1].tema})`),
      simNao(s.encontro, (v) => { s.encontro = v; caixaCom.hidden = !v; }),
      caixaCom,
      el('label', {}, 'Alguma prática fez mal ou ficou difícil?'),
      simNao(s.efeito_ruim, (v) => { s.efeito_ruim = v; caixaEfeito.hidden = !v; }),
      caixaEfeito,
      el('label', { for: 'duvida' }, 'Tem alguma dúvida para o Vladimir?'), duvida,
      msg, botao,
      comparar,
    ),
    el('section', { class: 'cartao' },
      el('h2', {}, 'A intenção da semana'),
      el('p', {}, 'Uma frase em primeira pessoa. Confiança em si mesma se constrói cumprindo pequenas promessas que a gente faz para a gente.'),
      el('label', { for: 'intencao' }, 'Nesta semana, eu escolho...'), intencao,
      el('p', { class: 'suave' }, 'Fica só no seu celular.'),
      semana < 4 ? el('p', {}, `Na próxima semana, o foco é ${proximo.nome.toLowerCase()}. ${proximo.extra.replace(/^Nesta semana, /, '').replace(/^./, (c) => c.toUpperCase())}`) : null,
    ),
  );
}

// ---------- Cuidados ----------

function telaCuidados() {
  titulo.textContent = 'Cuidados';
  mostrar(
    el('section', { class: 'cartao socorro' },
      el('h2', {}, 'Se precisar de ajuda agora'),
      el('p', {}, el('a', { href: 'tel:188' }, 'CVV, ligue 188'), ': conversa com um voluntário, de graça, 24 horas, em todo o Brasil. Também há chat em ', el('a', { href: 'https://cvv.org.br/chat/', rel: 'noopener' }, 'cvv.org.br'), '.'),
      el('p', {}, el('a', { href: 'tel:192' }, 'SAMU, ligue 192'), ': em emergência médica, como dor no peito ou falta de ar forte.'),
      el('p', {}, 'Em risco imediato, vá ao pronto-socorro mais próximo.'),
    ),
    el('section', { class: 'cartao' },
      el('h2', {}, 'Antes de começar'),
      el('p', {}, 'O Método Bem Viver é um conjunto de práticas de bem-estar. Ele não substitui tratamento médico nem psicológico. Se você faz algum tratamento, continue com ele e não mude nenhum remédio por conta própria.'),
      el('p', {}, 'Converse com seu médico antes dos respiros se você tem doença no coração, pressão alta sem controle ou marca-passo; asma, bronquite, enfisema ou outra doença do pulmão; crises de pânico; ou se está grávida.'),
      el('h3', {}, 'Durante as práticas'),
      el('p', {}, 'A respiração é suave, nunca forçada. Pare e volte a respirar normal se sentir tontura, formigamento, vista escura, falta de ar, aperto no peito ou coração disparado.'),
      el('p', {}, 'Faça os respiros sentada ou deitada, nunca dirigindo, na água ou em pé num lugar alto.'),
      el('h3', {}, 'Movimento'),
      el('p', {}, 'O minuto de passo rápido é na Zona de Entusiasmo: a respiração acelera, mas dá para falar e sorrir. Se você tem doença no coração, marca-passo, pressão alta sem controle ou sente dor ou falta de ar ao esforço, converse com seu médico antes de acelerar o passo. Pare se sentir dor no peito, tontura ou falta de ar forte.'),
      el('h3', {}, 'Sentimentos que podem aparecer'),
      el('p', {}, 'Às vezes, ficar em silêncio ou pensar em pessoas queridas traz tristeza, saudade ou lembranças difíceis. Isso é comum e costuma passar. Se pesar, diminua, pule uma prática ou pare, e conte no domingo.'),
      el('p', {}, 'Se você está de luto, ou sem alguém por perto, o contato do dia pode doer. Vale escrever a mensagem sem enviar, ou conversar com um vizinho ou atendente. E se você dorme mal há semanas, procure tratamento: existe terapia específica para insônia.'),
    ),
  );
}

// ---------- Navegação ----------

const TELAS = { hoje: telaHoje, domingo: telaDomingo, cuidados: telaCuidados };

function irPara(aba) {
  abas.hidden = false;
  abas.querySelectorAll('button').forEach((b) => {
    if (b.dataset.aba === aba) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  gravar('aba', aba);
  TELAS[aba]();
}

abas.addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-aba]');
  if (b) irPara(b.dataset.aba);
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/dia/sw.js', { scope: '/dia/' }).catch(() => {});
}

if (!ler('id')) telaEntrar();
else {
  irPara(new Date().getDay() === 0 ? 'domingo' : 'hoje');
  esvaziarFila();
}
