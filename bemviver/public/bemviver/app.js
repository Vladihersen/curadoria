// App do Método Bem Viver: as práticas do dia e a nota de domingo do piloto.
// Tudo fica guardado no celular (localStorage) e é enviado para /bemviver/api/ quando há internet.
// As "três coisas boas" escritas à noite nunca saem do celular.
'use strict';

// ---------- Só na cópia de teste (*.workers.dev): simular a data ----------
// No endereço oficial este bloco não faz nada.
const COPIA_DE_TESTE = /\.workers\.dev$/.test(location.hostname);
if (COPIA_DE_TESTE) {
  let alvo = null;
  try { alvo = localStorage.getItem('bemviver.simular'); } catch { /* segue com a data real */ }
  if (alvo && /^\d{4}-\d{2}-\d{2}$/.test(alvo)) {
    const DataReal = Date;
    const agora = new DataReal();
    const [a, m, d] = alvo.split('-').map(Number);
    const desloc = new DataReal(a, m - 1, d, agora.getHours(), agora.getMinutes(), agora.getSeconds()) - agora;
    class DataSimulada extends DataReal {
      constructor(...args) { if (args.length) super(...args); else super(DataReal.now() + desloc); }
      static now() { return DataReal.now() + desloc; }
    }
    window.Date = DataSimulada;
  }
  document.addEventListener('DOMContentLoaded', () => {
    const opcoes = [
      ['', 'Data real (hoje)'],
      ['2026-11-18', '18/11: antes do início'],
      ['2026-11-24', '24/11: semana 1, dia comum'],
      ['2026-11-29', '29/11: 1º domingo'],
      ['2026-12-16', '16/12: semana 4'],
      ['2026-12-20', '20/12: último domingo'],
    ];
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Simular a data');
    for (const [v, t] of opcoes) {
      const o = document.createElement('option');
      o.value = v; o.textContent = t; o.selected = v === (alvo || '');
      sel.append(o);
    }
    sel.addEventListener('change', () => {
      try { if (sel.value) localStorage.setItem('bemviver.simular', sel.value); else localStorage.removeItem('bemviver.simular'); } catch { /* */ }
      location.reload();
    });
    const faixa = document.createElement('div');
    faixa.className = 'faixa-teste';
    const rot = document.createElement('span');
    rot.textContent = 'Cópia de teste · ';
    faixa.append(rot, sel);
    document.body.prepend(faixa);
  });
}

const INICIO_PILOTO = '2026-11-23'; // segunda-feira da semana 1 (piloto de 23/11 a 20/12/2026)

const PERGUNTAS = [
  { tema: 'Escutar sem consertar', pergunta: 'O que está pesando para você agora?', gesto: 'Ouça até o fim, sem dar conselho.' },
  { tema: 'Gratidão dita em voz alta', pergunta: 'Sabe o que eu nunca te disse?', gesto: 'Diga à pessoa o que ela fez de bom na sua vida.' },
  { tema: 'Pedir e oferecer ajuda', pergunta: 'Em que eu posso te ajudar esta semana?', gesto: 'Faça um pedido simples e aceite ajuda.' },
  { tema: 'Lembrar juntos', pergunta: 'Qual foi o dia mais feliz que vivemos juntos?', gesto: 'Revivam uma boa lembrança, com fotos ou objetos.' },
];

// Foco de cada semana do piloto: o ritual fica igual, um pilar ganha destaque e um extra.
const FOCOS = [
  { nome: 'Corpo', extra: 'Nesta semana, faça o suspiro fisiológico de 5 minutos todo dia e os três minutos de movimento.' },
  { nome: 'Pessoas', extra: 'Nesta semana, escreva uma carta de gratidão a alguém vivo, e leia para a pessoa ou envie.' },
  { nome: 'Encantamento', extra: 'Nesta semana, faça uma caminhada mais longa num lugar bonito, sem celular, por uns 30 minutos.' },
  { nome: 'Sentido', extra: 'Nesta semana, procure a sua Zona de Entusiasmo: para quem a minha vida faz diferença, e o que eu faço com jeito e entusiasmo que quero continuar fazendo?' },
];

const AUDIOS = {
  boasVindas: '/bemviver/audio/1-boas-vindas.mp3',
  manha: '/bemviver/audio/2-comeco-do-dia.mp3',
  respiro1: '/bemviver/audio/3a-respiro-1-minuto.mp3',
  respiro5: '/bemviver/audio/3b-respiro-5-minutos.mp3',
  noite: '/bemviver/audio/4-noite.mp3',
  domingo: '/bemviver/audio/5-domingo.mp3',
};

const TESTE_ZONA = 'Zona de Presença: firme e confortável. Teste: consigo respirar pelo nariz com calma e sorrir? Se não, recue um pouco.';

const VINCULOS = ['Filha ou filho', 'Marido, esposa ou companheiro(a)', 'Amiga ou amigo', 'Irmã ou irmão', 'Mãe ou pai', 'Neta ou neto', 'Outra pessoa'];

// ---------- Guardar no celular ----------

function ler(chave, padrao) {
  try {
    const v = localStorage.getItem('bemviver.' + chave);
    return v === null ? padrao : JSON.parse(v);
  } catch {
    return padrao;
  }
}

function gravar(chave, valor) {
  try { localStorage.setItem('bemviver.' + chave, JSON.stringify(valor)); } catch { /* modo privado: segue sem guardar */ }
}

// ---------- Datas (sempre no fuso do celular) ----------

function isoLocal(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

function hoje() { return isoLocal(new Date()); }

// Antes de 23/11 o app já funciona: a pessoa entra, instala, guarda os áudios e
// experimenta o suspiro, mas as práticas e o domingo só contam a partir do início.
function antesDoInicio() { return hoje() < INICIO_PILOTO; }

function diasParaComecar() {
  const a = new Date(hoje() + 'T12:00:00'), b = new Date(INICIO_PILOTO + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}

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
  const r = await fetch('/bemviver/api/' + rota, {
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

// ---------- Tela acesa e controles na tela bloqueada ----------
// Enquanto um áudio toca ou o suspiro guiado está na tela, o celular não apaga a tela
// (Screen Wake Lock). Nos celulares sem esse recurso, o app segue normalmente.

const motivosTelaAcesa = new Set();
let travaTela = null;

async function pedirTelaAcesa() {
  if (!('wakeLock' in navigator) || travaTela || document.visibilityState !== 'visible') return;
  try {
    travaTela = await navigator.wakeLock.request('screen');
    travaTela.addEventListener('release', () => { travaTela = null; });
  } catch { travaTela = null; /* economia de bateria ou sem permissão: segue sem */ }
}

function manterTelaAcesa(motivo, ligar) {
  if (ligar) motivosTelaAcesa.add(motivo); else motivosTelaAcesa.delete(motivo);
  if (motivosTelaAcesa.size) pedirTelaAcesa();
  else if (travaTela) { travaTela.release().catch(() => {}); travaTela = null; }
  if (!motivosTelaAcesa.size && typeof mostrarAvisoAtualizar === 'function') mostrarAvisoAtualizar();
}

// O navegador solta a trava quando a pessoa sai do app; ao voltar, pede de novo.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && motivosTelaAcesa.size) pedirTelaAcesa();
});

// Nome do áudio, do Vladimir e do método na tela bloqueada, com tocar, pausar e voltar 10 s.
function controlesTelaBloqueada(player, titulo) {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  try {
    ms.metadata = new MediaMetadata({
      title: titulo,
      artist: 'Vladimir Hersen',
      album: 'Método Bem Viver',
      artwork: [{ src: '/bemviver/icone-512.png', sizes: '512x512', type: 'image/png' }],
    });
    const acoes = {
      play: () => player.play(),
      pause: () => player.pause(),
      seekbackward: (d) => { player.currentTime = Math.max(0, player.currentTime - ((d && d.seekOffset) || 10)); },
      seekforward: (d) => { player.currentTime = Math.min(player.duration || Infinity, player.currentTime + ((d && d.seekOffset) || 10)); },
      seekto: (d) => { if (d && d.seekTime != null) player.currentTime = d.seekTime; },
    };
    for (const [acao, fn] of Object.entries(acoes)) {
      try { ms.setActionHandler(acao, fn); } catch { /* ação não suportada neste celular */ }
    }
  } catch { /* navegador antigo: segue sem controles */ }
}

// Player que dá lugar a um aviso enquanto o áudio não existir.
// Só um áudio toca por vez; enquanto toca, a tela fica acesa.
const audioExiste = {};
let playerAtivo = null;
function audio(src, titulo = 'Método Bem Viver') {
  const caixa = el('div');
  const emBreve = () => caixa.replaceChildren(el('p', { class: 'suave' }, 'O áudio guiado chega em breve.'));
  const tocar = () => {
    const player = el('audio', { controls: true, preload: 'none', src });
    player.addEventListener('play', () => {
      if (playerAtivo && playerAtivo !== player) playerAtivo.pause();
      playerAtivo = player;
      controlesTelaBloqueada(player, titulo);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      manterTelaAcesa('audio', true);
    });
    const parou = () => {
      if (playerAtivo !== player) return;
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      manterTelaAcesa('audio', false);
    };
    player.addEventListener('pause', parou);
    player.addEventListener('ended', parou);
    caixa.replaceChildren(player);
  };
  audioExiste[src] ??= fetch(src, { method: 'HEAD' }).then((r) => r.ok).catch(() => null);
  audioExiste[src].then((ok) => (ok === false ? emBreve() : tocar()));
  return caixa;
}

const app = document.getElementById('app');
const titulo = document.getElementById('titulo');
const abas = document.getElementById('abas');

function mostrar(...filhos) {
  // Ao trocar de tela, o áudio que estava tocando para (o elemento sai da página).
  if (playerAtivo) { playerAtivo.pause(); playerAtivo = null; manterTelaAcesa('audio', false); }
  manterTelaAcesa('pausa', false);
  app.replaceChildren(...filhos);
  window.scrollTo(0, 0);
}

// ---------- Entrada no piloto ----------

function telaEntrar() {
  abas.hidden = true;
  titulo.textContent = 'Método Bem Viver';
  const dados = { nota: null, dias_paz: null };
  // O link do email pode trazer o nome e o WhatsApp já preenchidos (?nome=...&whatsapp=...).
  const doLink = new URLSearchParams(location.search);
  const limpo = (v) => (v && !/^\{\$/.test(v) ? v.trim() : ''); // ignora campo vazio do MailerLite
  const nome = el('input', { type: 'text', id: 'nome', autocomplete: 'given-name', maxlength: '80', value: limpo(doLink.get('nome')) });
  const whats = el('input', { type: 'tel', id: 'whats', autocomplete: 'tel', inputmode: 'tel', placeholder: '(21) 99999-9999', maxlength: '30', value: limpo(doLink.get('whatsapp')) });
  const aceite = el('input', { type: 'checkbox', id: 'aceite' });
  const msg = el('p', { role: 'status' });
  const botao = el('button', { type: 'submit' }, 'Começar');

  const form = el('form', { class: 'cartao', novalidate: true },
    el('h2', {}, 'Boas-vindas ao piloto'),
    el('p', {}, 'Quatro semanas de práticas de poucos minutos por dia, com o Vladimir Hersen, de 23 de novembro a 20 de dezembro.'),
    el('label', { for: 'nome' }, 'Seu nome'), nome,
    el('label', { for: 'whats' }, 'WhatsApp com DDD'), whats,
    el('p', { class: 'suave' }, 'Só o Vladimir vê esse número, para falar com você se precisar.'),
    el('label', {}, 'De 0 a 10, qual é a sua satisfação com a sua vida hoje?'),
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
      el('p', {}, 'Cinco minutos com o Vladimir explicando como funciona.'),
      audio(AUDIOS.boasVindas, 'Boas-vindas'),
      el('h3', {}, 'Os quatro pilares'),
      el('p', {}, el('b', {}, 'Bem respirar'), ': o suspiro fisiológico, 1 minuto na hora do aperto, ou 5 minutos quando houver tempo.'),
      el('p', {}, el('b', {}, 'Bem fazer'), ': três minutos de movimento ao longo do dia e uma coisa pequena que te dá vida.'),
      el('p', {}, el('b', {}, 'Bem querer'), ': um gesto de carinho para alguém por dia (uma mensagem, uma ligação ou uma palavra ao vivo) e, uma vez por semana, um Encontro de Verdade.'),
      el('p', {}, el('b', {}, 'Bem ver'), ': à noite, três coisas boas do dia e desejar o bem a quem você ama.'),
      el('p', {}, 'Em dia corrido, faça a versão mínima: um minuto de cada já conta. Nunca zero, nunca forçado.'),
      el('p', { class: 'suave' }, TESTE_ZONA),
      el('p', { class: 'suave' }, '"A felicidade vem de uma vida significativa e não de uma vida fácil." Maria Nogueira Maia'),
      el('h3', {}, 'Experimente agora'),
      el('p', {}, 'Dê uma nota para a sua tensão, faça 1 minuto de suspiro fisiológico e dê a nota de novo. Veja com os seus próprios olhos o que um minuto faz.'),
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
  if (antesDoInicio()) return telaPreparacao();
  const dia = hoje();
  const reg = registroDe(dia);
  const semana = semanaDoPiloto();
  const foco = FOCOS[semana - 1];
  const enc = PERGUNTAS[semana - 1];
  titulo.textContent = `${saudacao()}${ler('nome') ? ', ' + ler('nome') : ''}`;
  const marcar = (cartao, feito) => cartao.classList.toggle('feito', feito);

  const cFoco = el('section', { class: 'cartao destaque' },
    el('p', { class: 'pilar' }, `Semana ${semana} de 4`),
    el('p', {}, foco.extra),
    el('p', { class: 'suave' }, TESTE_ZONA),
  );

  const m = mediaTensao(reg.respiros);
  const cRespiro = el('section', { class: 'cartao' + (reg.respiros.length ? ' feito' : '') },
    el('p', { class: 'pilar' }, 'Bem respirar · quando apertar'),
    el('h2', {}, 'Suspiro fisiológico'),
    el('p', {}, 'Inspire pelo nariz, inspire mais um pouquinho por cima e solte todo o ar pelo nariz, bem devagar. Antes e depois, uma nota para a sua tensão.'),
    m ? el('p', { class: 'resultado' }, `Hoje: ${reg.respiros.length} ${reg.respiros.length === 1 ? 'vez' : 'vezes'}, tensão média de ${m.antes.toFixed(1).replace('.', ',')} para ${m.depois.toFixed(1).replace('.', ',')}.`) : null,
    el('button', { type: 'button', onclick: () => fazerRespiro(60) }, '1 minuto'),
    el('button', { type: 'button', class: 'secundario', onclick: () => fazerRespiro(300) }, '5 minutos'),
    el('details', {}, el('summary', {}, 'Prefere ouvir o Vladimir?'), el('p', { class: 'suave' }, '1 minuto'), audio(AUDIOS.respiro1, 'Suspiro fisiológico de 1 minuto'), el('p', { class: 'suave' }, '5 minutos'), audio(AUDIOS.respiro5, 'Suspiro fisiológico de 5 minutos')),
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
    el('h2', {}, 'Três minutos de movimento'),
    el('p', {}, 'Três vezes hoje, 1 minuto de passo rápido ou escada, preso a algo que já acontece: ir ao ponto, subir para casa, esperar o café. A respiração acelera, mas dá para falar.'),
    el('p', { class: 'suave' }, 'Dia calmo? Uma caminhada ao ar livre vale pelos três. Andar enquanto conversa ao telefone também conta.'),
    audio(AUDIOS.manha, 'O começo do dia'),
    passos,
  );
  desenharPassos();

  const escolhida = (ler('amanha', {})[ontem()] || '').trim();
  const cVida = el('section', { class: 'cartao' + (reg.vida ? ' feito' : '') },
    el('p', { class: 'pilar' }, 'Bem fazer · a vida'),
    el('h2', {}, 'A coisa que me dá vida'),
    escolhida
      ? el('p', { class: 'pergunta' }, `Você escolheu ontem: "${escolhida}"`)
      : el('p', {}, 'Escolha agora uma coisa pequena que te dá prazer ou sentido: cozinhar ouvindo música, regar as plantas, ler dez páginas, visitar alguém. Na dúvida, repare no que te dá um entusiasmo tranquilo só de imaginar: é uma pista da sua Zona de Entusiasmo.'),
    botaoMarcar('Fiz a coisa que me dá vida', reg.vida, (v) => { reg.vida = v; salvarRegistro(dia, reg); marcar(cVida, v); }),
  );

  const cContato = el('section', { class: 'cartao' + (reg.contato ? ' feito' : '') },
    el('p', { class: 'pilar' }, 'Bem querer · durante o dia'),
    el('h2', {}, 'Um gesto de carinho'),
    el('p', {}, 'Um gesto de carinho para alguém: uma mensagem, uma ligação ou uma palavra ao vivo. Se puder, diga algo específico ("lembrei de você porque..."). Quem recebe costuma ficar mais feliz do que a gente imagina.'),
    el('p', { class: 'suave' }, 'Se hoje for difícil falar com alguém, escreva a mensagem sem enviar. Também conta.'),
    botaoMarcar('Fiz meu gesto de carinho hoje', reg.contato, (v) => { reg.contato = v; salvarRegistro(dia, reg); marcar(cContato, v); }),
  );

  const boas = ler('boas', {});
  const minhas = boas[dia] || ['', '', ''];
  const dicas = ['1. Algo bom de hoje, e por quê', '2. Algo bom que veio de uma pessoa', '3. Algo bom que eu fiz'];
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
    el('h2', {}, 'Três coisas boas e desejar o bem'),
    el('p', {}, 'Lembre três coisas boas do dia e por que aconteceram. Escolha uma e fique um minuto com ela, saboreando. Depois deseje o bem a quem você ama, e a você.'),
    ...campos,
    el('p', { class: 'suave' }, 'O que você escreve aqui fica só no seu celular.'),
    el('p', { class: 'frase' }, 'Que você esteja em paz. Que você tenha saúde. Que você seja feliz.'),
    el('p', { class: 'frase' }, 'Que eu esteja em paz. Que eu tenha saúde. Que eu seja feliz.'),
    el('p', { class: 'frase' }, 'Que todos os seres sejam felizes.'),
    el('label', { for: 'amanha' }, 'Amanhã, a coisa que vai me dar vida'), amanha,
    audio(AUDIOS.noite, 'A noite'),
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

  mostrar(cFoco, cRespiro, cCorpo, cVida, cContato, cNoite, cEncontro, ...cartoesPreparo(false));
}

// ---------- Antes do início: preparação ----------

function telaPreparacao() {
  const n = diasParaComecar();
  titulo.textContent = `${saudacao()}${ler('nome') ? ', ' + ler('nome') : ''}`;
  mostrar(
    el('section', { class: 'cartao destaque' },
      el('p', { class: 'pilar' }, n === 1 ? 'Começa amanhã' : `Faltam ${n} dias`),
      el('h2', {}, 'O piloto começa na segunda-feira, 23 de novembro'),
      el('p', {}, 'Sua inscrição no app está feita. Até lá, deixe tudo pronto com calma: são quatro passos de poucos minutos. No dia 23, esta tela passa a mostrar as práticas do dia.'),
    ),
    el('section', { class: 'cartao' },
      el('p', { class: 'pilar' }, 'Passo 1'),
      el('h2', {}, 'Ouça as boas-vindas'),
      el('p', {}, 'Cinco minutos com o Vladimir explicando como funciona cada dia.'),
      audio(AUDIOS.boasVindas, 'Boas-vindas'),
    ),
    ...cartoesPreparo(true),
    el('section', { class: 'cartao' },
      el('p', { class: 'pilar' }, 'Passo 4'),
      el('h2', {}, 'Experimente o suspiro fisiológico'),
      el('p', {}, 'Dê uma nota para a sua tensão, faça 1 minuto de suspiro fisiológico e dê a nota de novo. Pode repetir quantas vezes quiser até o dia 23: é só para conhecer.'),
      el('button', { type: 'button', onclick: () => fazerRespiro(60) }, 'Experimentar agora'),
    ),
    el('section', { class: 'cartao' },
      el('h2', {}, 'Ficou alguma dúvida?'),
      el('p', {}, 'Responda ao email do Vladimir: vale qualquer pergunta sobre o app ou sobre as práticas. Se você tem alguma condição de saúde, leia antes a aba Cuidados e, se for o caso, converse com o seu médico.'),
    ),
  );
}

// Instalar na tela do celular e guardar os áudios. Na preparação aparecem sempre;
// depois do início, só enquanto faltar algum dos dois.
let pedidoInstalar = null;
window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); pedidoInstalar = ev; });

function instalado() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function sistema() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'outro';
}

function cartaoInstalar(numerado) {
  const titulo = el('h2', {}, 'Coloque o app na tela do celular');
  const cartao = el('section', { class: 'cartao' }, numerado ? el('p', { class: 'pilar' }, 'Passo 2') : null, titulo);
  if (instalado()) {
    cartao.classList.add('feito');
    cartao.append(el('p', {}, 'Pronto: o app já está na tela do seu celular, com o ícone da borboleta.'));
    return cartao;
  }
  cartao.append(el('p', {}, 'Assim ele abre com um toque, como os outros aplicativos, sem precisar procurar o link.'));
  const so = sistema();
  const iphone = el('div', { class: 'passo-a-passo' },
    el('h3', {}, 'No iPhone'),
    el('ol', {},
      el('li', {}, 'Abra este link no Safari (o navegador da bússola azul).'),
      el('li', {}, 'Toque no botão de compartilhar: o quadrado com uma seta para cima, na barra de baixo.'),
      el('li', {}, 'Role a lista e toque em "Adicionar à Tela de Início".'),
      el('li', {}, 'Toque em "Adicionar", no canto de cima.'),
    ));
  const android = el('div', { class: 'passo-a-passo' },
    el('h3', {}, 'No Android'),
    el('ol', {},
      el('li', {}, 'Abra este link no Chrome (o navegador de bolinha colorida).'),
      el('li', {}, 'Toque nos três pontinhos, no canto de cima, à direita.'),
      el('li', {}, 'Toque em "Instalar app" ou em "Adicionar à tela inicial".'),
      el('li', {}, 'Confirme em "Instalar" ou "Adicionar".'),
    ));
  if (pedidoInstalar) {
    const botao = el('button', { type: 'button' }, 'Instalar o app agora');
    botao.addEventListener('click', async () => {
      if (!pedidoInstalar) return;
      pedidoInstalar.prompt();
      const r = await pedidoInstalar.userChoice.catch(() => null);
      pedidoInstalar = null;
      if (r && r.outcome === 'accepted') botao.replaceWith(el('p', { class: 'ok' }, 'Instalado. Procure o ícone da borboleta na tela do celular.'));
    });
    cartao.append(botao);
  }
  // O do próprio celular aparece primeiro; o outro fica logo abaixo, para quem ajuda alguém.
  cartao.append(...(so === 'android' ? [android, iphone] : [iphone, android]));
  cartao.append(el('p', { class: 'suave' }, 'Depois, procure na tela do celular o ícone da borboleta, escrito "Bem Viver".'));
  return cartao;
}

// Os áudios são guardados pelo service worker logo na primeira abertura.
// Este cartão só mostra o andamento e, se faltar algum, deixa tentar de novo.
function perguntarAoSW(msg, tipoFim, aoAvancar) {
  return new Promise((ok) => {
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!sw) return ok(null);
    const ouvir = (ev) => {
      const d = ev.data || {};
      if (d.tipo === 'AUDIOS_PROGRESSO' && aoAvancar) aoAvancar(d);
      if (d.tipo === tipoFim) { navigator.serviceWorker.removeEventListener('message', ouvir); ok(d); }
    };
    navigator.serviceWorker.addEventListener('message', ouvir);
    sw.postMessage(msg);
  });
}

function audiosGuardados() {
  return perguntarAoSW({ tipo: 'AUDIOS_ESTADO' }, 'AUDIOS_ESTADO');
}

function cartaoAudios(numerado) {
  const estado = el('p', { role: 'status', class: 'suave' }, 'Conferindo…');
  const botao = el('button', { type: 'button', hidden: true }, 'Baixar os áudios que faltam');
  const cartao = el('section', { class: 'cartao' },
    numerado ? el('p', { class: 'pilar' }, 'Passo 3') : null,
    el('h2', {}, 'Os áudios no seu celular'),
    el('p', {}, 'Na primeira vez que você abre o app, os áudios (cerca de 25 MB) ficam guardados no celular. Depois disso eles tocam mesmo sem internet. De preferência, abra o app pela primeira vez no wi-fi.'),
    botao, estado,
  );
  const mostrarEstado = (d) => {
    if (!d) { estado.textContent = 'Os áudios tocam quando houver internet.'; return; }
    if (d.ok === d.total) {
      cartao.classList.add('feito');
      botao.hidden = true;
      estado.className = 'ok';
      estado.textContent = 'Pronto: os áudios estão no seu celular e tocam sem internet.';
    } else {
      botao.hidden = false;
      botao.disabled = false;
      estado.className = 'suave';
      estado.textContent = `${d.ok} de ${d.total} áudios guardados.`;
    }
  };
  // Logo depois da primeira abertura o service worker ainda está baixando: confere de novo.
  const conferir = () => audiosGuardados().then((d) => {
    mostrarEstado(d);
    if (d && d.ok < d.total && !conferir.vezes++) setTimeout(conferir, 8000);
  });
  conferir.vezes = 0;
  if (navigator.serviceWorker && !navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(() => setTimeout(conferir, 1500));
  }
  conferir();
  botao.addEventListener('click', async () => {
    botao.disabled = true;
    estado.className = 'suave';
    estado.textContent = 'Baixando…';
    const d = await perguntarAoSW({ tipo: 'GUARDAR_AUDIOS' }, 'AUDIOS_FIM',
      (p) => { estado.textContent = `Baixando ${p.feitos} de ${p.total}…`; });
    mostrarEstado(d);
    if (d && d.ok < d.total) {
      estado.className = 'erro';
      estado.textContent = navigator.onLine
        ? `${d.ok} de ${d.total} guardados. Tente de novo em instantes; os que já foram ficam.`
        : 'Você está sem internet. Conecte-se, de preferência no wi-fi, e tente de novo.';
    }
  });
  return cartao;
}

function cartoesPreparo(naPreparacao) {
  if (naPreparacao) return [cartaoInstalar(true), cartaoAudios(true)];
  const lista = [];
  if (!instalado()) lista.push(cartaoInstalar(false));
  const audios = cartaoAudios(false);
  audios.hidden = true; // depois do início, só aparece se faltar algum áudio
  audiosGuardados().then((d) => { if (d && d.ok < d.total) audios.hidden = false; });
  lista.push(audios);
  return lista;
}

// Nota de tensão de 0 a 10, pedida antes e depois de cada respiro.
function telaTensao(momento, aoEscolher) {
  abas.hidden = true;
  titulo.textContent = momento === 'antes' ? 'Antes de começar' : 'E agora?';
  mostrar(el('section', { class: 'cartao' },
    el('h2', {}, momento === 'antes' ? 'Como está a sua tensão agora?' : 'Como está a sua tensão agora, depois do suspiro?'),
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
        if (!antesDoInicio()) { // antes de 23/11 é só experiência: não entra nos resultados
          const dia = hoje();
          const reg = registroDe(dia);
          reg.respiros = [...reg.respiros, { antes, depois }];
          salvarRegistro(dia, reg);
        }
        const frase = depois < antes
          ? `Você chegou em ${antes} e saiu em ${depois}.`
          : `Você chegou em ${antes} e saiu em ${depois}. Tudo bem: às vezes o corpo precisa de mais de uma rodada.`;
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

// Suspiro fisiológico guiado, com a taça tibetana marcando cada fase e uma paisagem
// sonora de brisa ao fundo (trilhas geradas por ferramentas/gerar-guia.py, com os
// MESMOS tempos de CONDUCAO). A tela segue o relógio da trilha; sem som, segue o relógio
// do celular. No fim, um tempo para a pessoa se observar e reconhecer a mudança.
const CONDUCAO = {
  entrada: 4,
  fases: [
    { texto: 'Inspire pelo nariz, devagar', s: 2.4, escala: 0.9 },
    { texto: 'Inspire mais um pouquinho, por cima', s: 1.5, escala: 1 },
    { texto: 'Solte todo o ar pelo nariz, bem devagar', s: 5.5, escala: 0.55 },
  ],
  observar: 30,
  frasesObservar: [
    [0, 'Pronto. Deixe a respiração voltar ao natural.'],
    [5, 'Fique um momento em silêncio, só observando.'],
    [11, 'Perceba o corpo agora: o rosto, os ombros, as mãos.'],
    [18, 'Repare na respiração. Como ela está agora?'],
    [24, 'Compare com o começo. O que mudou em você?'],
  ],
};
const TRILHAS = { 60: { src: '/bemviver/audio/guia-1-minuto.mp3', ciclos: 6 }, 300: { src: '/bemviver/audio/guia-5-minutos.mp3', ciclos: 32 } };

function telaPausa(segundos, aoTerminar) {
  abas.hidden = true;
  const trilha = TRILHAS[segundos >= 300 ? 300 : 60];
  titulo.textContent = segundos >= 300 ? 'Suspiro fisiológico, 5 minutos' : 'Suspiro fisiológico, 1 minuto';
  const ciclo = CONDUCAO.fases.reduce((t, f) => t + f.s, 0);
  const fimRespiracao = CONDUCAO.entrada + trilha.ciclos * ciclo;
  const fimTotal = fimRespiracao + CONDUCAO.observar;

  const bolha = el('div', { class: 'bolha', 'aria-hidden': 'true' });
  const fase = el('p', { class: 'fase', 'aria-live': 'polite' }, 'Sente-se ou deite-se. Deixe o corpo pesar.');
  const resta = el('p', { class: 'suave' }, segundos >= 300 ? '5 minutos' : '1 minuto');
  const aviso = el('p', { class: 'suave' }, 'Se sentir tontura, volte a respirar normal. A respiração é suave, nunca forçada.');
  const botao = el('button', { type: 'button', class: 'secundario' }, 'Parar');
  let comSom = ler('somGuia', true);
  const som = el('button', { type: 'button', class: 'som', 'aria-pressed': String(comSom) }, comSom ? 'Som da taça: ligado' : 'Som da taça: desligado');

  const guia = new Audio(trilha.src);
  guia.preload = 'auto';
  guia.muted = !comSom;
  let tocando = false;
  const inicioRelogio = Date.now();
  let desvio = 0; // se a trilha falhar no meio, o relógio do celular continua de onde ela parou
  const agora = () => (tocando && !guia.paused ? guia.currentTime : (Date.now() - inicioRelogio) / 1000 + desvio);

  let ativo = true, etapa = 'respirar', ultimo = '', intervalo;
  const fim = (completou) => {
    if (!ativo) return;
    ativo = false; clearInterval(intervalo);
    guia.pause();
    manterTelaAcesa('pausa', false);
    if (completou) aoTerminar(); else irPara('hoje');
  };
  botao.addEventListener('click', () => fim(etapa !== 'respirar'));
  som.addEventListener('click', () => {
    comSom = !comSom; gravar('somGuia', comSom); guia.muted = !comSom;
    som.setAttribute('aria-pressed', String(comSom));
    som.textContent = comSom ? 'Som da taça: ligado' : 'Som da taça: desligado';
  });

  const atualizar = () => {
    if (!ativo) return;
    const t = agora();
    if (t < CONDUCAO.entrada) return;
    if (t < fimRespiracao) {
      const dentro = (t - CONDUCAO.entrada) % ciclo;
      let acc = 0, k = 0;
      while (k < CONDUCAO.fases.length - 1 && dentro >= acc + CONDUCAO.fases[k].s) { acc += CONDUCAO.fases[k].s; k++; }
      const f = CONDUCAO.fases[k];
      const chave = Math.floor((t - CONDUCAO.entrada) / ciclo) + ':' + k;
      if (chave !== ultimo) {
        ultimo = chave;
        fase.textContent = f.texto;
        bolha.style.transitionDuration = Math.max(200, (acc + f.s - dentro) * 1000) + 'ms';
        bolha.style.transform = `scale(${f.escala})`;
      }
      const seg = Math.max(0, Math.ceil(fimRespiracao - t));
      resta.textContent = seg > 60 ? `${Math.ceil(seg / 60)} minutos` : `${seg} segundos`;
      return;
    }
    if (etapa === 'respirar') {
      etapa = 'observar';
      bolha.style.transitionDuration = '4000ms';
      bolha.style.transform = 'scale(.7)';
      resta.textContent = '';
      aviso.textContent = 'Sem pressa. Só observe.';
      botao.textContent = 'Já observei';
    }
    const dentro = t - fimRespiracao;
    let frase = CONDUCAO.frasesObservar[0][1];
    for (const [quando, txt] of CONDUCAO.frasesObservar) if (dentro >= quando) frase = txt;
    if (frase !== fase.textContent) fase.textContent = frase;
    if (t >= fimTotal && etapa === 'observar') {
      etapa = 'fim';
      clearInterval(intervalo);
      fase.textContent = 'Agora dê a sua nota de novo e veja o que mudou.';
      aviso.textContent = '';
      botao.className = '';
      botao.textContent = 'Dar a nota de agora';
    }
  };

  mostrar(el('section', { class: 'cartao guia' }, bolha, fase, resta, aviso, botao, som));
  manterTelaAcesa('pausa', true);
  playerAtivo = guia; // se a pessoa sair da tela, a trilha para junto
  guia.addEventListener('pause', () => { if (tocando && ativo) { desvio = guia.currentTime - (Date.now() - inicioRelogio) / 1000; tocando = false; } });
  controlesTelaBloqueada(guia, titulo.textContent);
  guia.play().then(() => { tocando = true; }).catch(() => { tocando = false; }); // sem som, a tela segue sozinha
  intervalo = setInterval(atualizar, 100);
}

// ---------- Domingo ----------

function telaDomingo() {
  if (antesDoInicio()) {
    titulo.textContent = 'Domingo';
    return mostrar(el('section', { class: 'cartao' },
      el('h2', {}, 'As perguntas de domingo começam em 29 de novembro'),
      el('p', {}, 'Todo domingo do piloto, aqui, você responde duas perguntas: uma nota de 0 a 10 para a sua satisfação com a vida e em quantos dias da semana você sentiu paz. Também tem um espaço livre, se quiser escrever.'),
      el('p', {}, 'A cada domingo respondido, você vê aqui um gráfico da sua evolução desde a inscrição.'),
    ));
  }
  const domingo = domingoDaSemana();
  const salvos = ler('semanas', {})[domingo] || {};
  const s = {
    nota: salvos.nota ?? null, dias_paz: salvos.dias_paz ?? null,
    encontro: salvos.encontro ?? null, encontro_com: salvos.encontro_com || '',
    efeito_ruim: salvos.efeito_ruim ?? null, efeito_texto: salvos.efeito_texto || '', duvida: salvos.duvida || '',
    livre: salvos.livre || '',
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

  // Espaço livre e opcional: um desabafo, um agradecimento, o que vier.
  const livre = el('textarea', { id: 'livre', maxlength: '2000', rows: '5', placeholder: 'Opcional' }, s.livre);
  livre.addEventListener('input', () => { s.livre = livre.value; });

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
      duvida: s.duvida, livre: s.livre,
    };
    const todas = ler('semanas', {});
    todas[domingo] = dados;
    gravar('semanas', todas);
    enfileirar('semana', domingo, dados);
    msg.className = 'ok';
    msg.textContent = navigator.onLine ? 'Recebido. Obrigado por responder.' : 'Guardado. Será enviado quando a internet voltar.';
    botao.textContent = 'Atualizar respostas';
    const novo = cartaoEvolucao();
    if (novo) { if (evolucao) evolucao.replaceWith(novo); else intencaoCartao.before(novo); evolucao = novo; }
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

  let evolucao = cartaoEvolucao();
  const intencaoCartao = el('section', { class: 'cartao' },
    el('h2', {}, 'A intenção da semana'),
    el('p', {}, 'Uma frase em primeira pessoa. A confiança em si se constrói cumprindo pequenas promessas que a gente faz para a gente.'),
    el('label', { for: 'intencao' }, 'Nesta semana, eu escolho...'), intencao,
    el('p', { class: 'suave' }, 'Fica só no seu celular.'),
    semana < 4 ? el('p', {}, `Na próxima semana: ${proximo.extra.replace(/^Nesta semana, /, '')}`) : null,
  );

  mostrar(
    el('section', { class: 'cartao' },
      el('h2', {}, `Semana que termina em ${dataCurta(domingo)}`),
      calendario,
      el('p', { class: 'suave' }, `Você praticou em ${diasFeitos} de 7 dias. • prática · ☼ momento de paz`),
      tensao ? el('p', { class: 'resultado' }, `${respirosSemana.length === 1 ? 'Na vez em que você fez o suspiro fisiológico' : `Nas ${respirosSemana.length} vezes em que você fez o suspiro fisiológico`} nesta semana, sua tensão foi em média de ${virgula(tensao.antes)} para ${virgula(tensao.depois)}.`) : null,
      diasFeitos < 7 ? el('p', {}, 'Teve dia em branco? Tudo bem. Recomeçar sem culpa faz parte do método.') : null,
      audio(AUDIOS.domingo, 'O domingo'),
      el('label', {}, 'De 0 a 10, qual é a sua satisfação com a sua vida hoje?'),
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
      el('label', { for: 'livre' }, 'Espaço livre'),
      el('p', { class: 'suave' }, 'Se quiser, escreva o que quiser: um desabafo, um agradecimento, algo que aconteceu na semana. Só o Vladimir lê.'),
      livre,
      msg, botao,
      comparar,
    ),
    evolucao,
    intencaoCartao,
  );
}

// ---------- Gráficos de evolução (domingo) ----------
// Mostra só as respostas da própria participante: a inscrição como ponto de partida
// e cada domingo respondido. Tudo vem do que está guardado no celular.

const SVG = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}, texto) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (texto != null) n.textContent = texto;
  return n;
}

function pontosEvolucao() {
  const pontos = [];
  const inicio = ler('inicio', null);
  if (inicio && inicio.nota != null) pontos.push({ rotulo: 'Início', nota: inicio.nota, dias_paz: inicio.dias_paz });
  const semanas = ler('semanas', {});
  for (const domingo of Object.keys(semanas).sort()) {
    const x = semanas[domingo];
    if (x && x.nota != null) pontos.push({ rotulo: dataCurta(domingo), nota: x.nota, dias_paz: x.dias_paz });
  }
  return pontos;
}

// Linha simples com o valor escrito em cada ponto: fácil de ler sem tocar em nada.
function graficoLinha(pontos, campo, max, nome) {
  const L = 320, A = 170, esq = 30, dir = 22, topo = 26, base = 34;
  const larg = L - esq - dir, alt = A - topo - base;
  const n = pontos.length;
  const x = (i) => esq + (n === 1 ? larg / 2 : (i * larg) / (n - 1));
  const y = (v) => topo + alt - (v / max) * alt;
  const validos = pontos.map((p, i) => ({ ...p, i })).filter((p) => p[campo] != null);
  const descricao = validos.map((p) => `${p.rotulo}: ${p[campo]}`).join('; ');
  const g = svg('svg', { viewBox: `0 0 ${L} ${A}`, class: 'grafico', role: 'img', 'aria-label': `${nome}. ${descricao}.` });

  for (const v of (max % 2 === 0 ? [0, max / 2, max] : [0, max])) {
    const vv = v;
    g.append(svg('line', { x1: esq, x2: L - dir, y1: y(v), y2: y(v), class: v === 0 ? 'eixo' : 'grade' }));
    g.append(svg('text', { x: esq - 8, y: y(v) + 4, class: 'escala-num', 'text-anchor': 'end' }, String(vv).replace('.', ',')));
  }
  if (validos.length > 1) {
    g.append(svg('polyline', { points: validos.map((p) => `${x(p.i)},${y(p[campo])}`).join(' '), class: 'linha' }));
  }
  validos.forEach((p, k) => {
    const ultimo = k === validos.length - 1;
    g.append(svg('circle', { cx: x(p.i), cy: y(p[campo]), r: ultimo ? 7 : 5, class: ultimo ? 'ponto atual' : 'ponto' }));
    g.append(svg('text', { x: x(p.i), y: y(p[campo]) - 12, class: 'valor', 'text-anchor': 'middle' }, String(p[campo])));
  });
  pontos.forEach((p, i) => {
    g.append(svg('text', { x: x(i), y: A - 10, class: 'rotulo-x', 'text-anchor': 'middle' }, p.rotulo));
  });
  return g;
}

function cartaoEvolucao() {
  const pontos = pontosEvolucao();
  if (!pontos.length) return null;
  const primeiro = pontos[0], ultimo = pontos[pontos.length - 1];
  const variacao = (campo, um, varios) => {
    if (pontos.length < 2 || primeiro[campo] == null || ultimo[campo] == null) return null;
    const d = ultimo[campo] - primeiro[campo];
    const qtd = (k) => `${k} ${k === 1 ? um : varios}`;
    return d === 0 ? 'igual ao começo' : d > 0 ? `${qtd(d)} a mais que no começo` : `${qtd(-d)} a menos que no começo`;
  };
  const vNota = variacao('nota', 'ponto', 'pontos'), vPaz = variacao('dias_paz', 'dia', 'dias');
  return el('section', { class: 'cartao evolucao' },
    el('h2', {}, 'Sua evolução'),
    pontos.length === 1
      ? el('p', { class: 'suave' }, 'Este é o seu ponto de partida. A cada domingo respondido, o gráfico ganha um ponto.')
      : el('p', { class: 'suave' }, 'Começa na sua inscrição e ganha um ponto a cada domingo respondido.'),
    el('h3', {}, 'Satisfação com a vida (0 a 10)'),
    graficoLinha(pontos, 'nota', 10, 'Satisfação com a vida, de 0 a 10'),
    vNota ? el('p', { class: 'resultado' }, `Agora: ${ultimo.nota}, ${vNota}.`) : null,
    el('h3', {}, 'Dias de paz na semana (0 a 7)'),
    graficoLinha(pontos, 'dias_paz', 7, 'Dias de paz na semana, de 0 a 7'),
    vPaz ? el('p', { class: 'resultado' }, `Agora: paz em ${ultimo.dias_paz} de 7 dias, ${vPaz}.`) : null,
    pontos.length > 1 ? el('p', { class: 'suave' }, 'Semanas difíceis acontecem e fazem parte. O que conta é a direção ao longo das quatro semanas.') : null,
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
      el('p', {}, 'Converse com seu médico antes do suspiro fisiológico se você tem doença no coração, pressão alta sem controle ou marca-passo; asma, bronquite, enfisema ou outra doença do pulmão; crises de pânico; ou se está grávida.'),
      el('h3', {}, 'Durante as práticas'),
      el('p', {}, 'A respiração é suave, nunca forçada. Pare e volte a respirar normal se sentir tontura, formigamento, vista escura, falta de ar, aperto no peito ou coração disparado.'),
      el('p', {}, 'Faça o suspiro fisiológico sentado ou deitado, nunca dirigindo, na água ou em pé num lugar alto.'),
      el('h3', {}, 'Movimento'),
      el('p', {}, 'O minuto de passo rápido é na Zona de Presença: a respiração acelera, mas dá para falar e sorrir. Se você tem doença no coração, marca-passo, pressão alta sem controle ou sente dor ou falta de ar ao esforço, converse com seu médico antes de acelerar o passo. Pare se sentir dor no peito, tontura ou falta de ar forte.'),
      el('h3', {}, 'Sentimentos que podem aparecer'),
      el('p', {}, 'Às vezes, ficar em silêncio ou pensar em pessoas queridas traz tristeza, saudade ou lembranças difíceis. Isso é comum e costuma passar. Se pesar, diminua, pule uma prática ou pare, e conte no domingo.'),
      el('p', {}, 'Se você está de luto, ou sem alguém por perto, o gesto de carinho do dia pode doer. Vale escrever a mensagem sem enviar, ou conversar com um vizinho ou atendente. E se você dorme mal há semanas, procure tratamento: existe terapia específica para insônia.'),
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

// ---------- Instalado no celular e atualizações (o mesmo modelo do Leveza de Viver) ----------
// A versão nova chega em segundo plano e só entra quando a pessoa toca em "Atualizar".
// Nunca no meio de um áudio ou de um suspiro guiado, porque atualizar recarrega a tela.

var registroSW = null; // var: pode ser lido antes desta linha rodar

function mostrarAvisoAtualizar() {
  if (!registroSW || !registroSW.waiting || !navigator.serviceWorker.controller) return;
  if (motivosTelaAcesa.size) return; // praticando: o aviso espera terminar
  const aviso = document.getElementById('aviso-atualizar');
  if (!aviso.hidden) return;
  const botao = aviso.querySelector('button');
  botao.disabled = false;
  botao.textContent = 'Atualizar';
  botao.onclick = () => {
    botao.disabled = true;
    botao.textContent = 'Atualizando…';
    if (registroSW.waiting) registroSW.waiting.postMessage({ tipo: 'SKIP_WAITING' });
  };
  aviso.hidden = false;
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/bemviver/sw.js', { scope: '/bemviver/' }).then((reg) => {
    registroSW = reg;
    reg.update().catch(() => {}); // procura versão nova a cada abertura
    mostrarAvisoAtualizar();
    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      if (!novo) return;
      novo.addEventListener('statechange', () => {
        if (novo.state === 'installed') mostrarAvisoAtualizar();
      });
    });
    // O app instalado pode ficar dias aberto em segundo plano: ao voltar, procura de novo.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {}); // sem service worker o app segue normal, só que precisa de internet

  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Na primeira instalação não há o que recarregar; na atualização, recarrega uma vez.
    if (recarregando || !document.getElementById('aviso-atualizar').querySelector('button').disabled) return;
    recarregando = true;
    location.reload();
  });
}

if (!ler('id')) telaEntrar();
else {
  irPara(new Date().getDay() === 0 && !antesDoInicio() ? 'domingo' : 'hoje');
  esvaziarFila();
}
