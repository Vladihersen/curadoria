# Leveza de Viver — notas técnicas (aprendizados que não podem se perder)

## Bug "Iniciar/Reiniciar não funciona no iPhone, só o Retomar" — resolvido em 26/out/2026

**Sintoma:** no iPhone 12 (app instalado na tela de início), ao tocar em Iniciar ou
Reiniciar a prática ficava travada, sem som e sem o círculo andar. Só começava
depois de tocar em Pausar e depois em Retomar.

**Causa:** o `startBreath()` ainda chamava a voz sintética do sistema
(`speechSynthesis.speak`), sobra de uma versão antiga. No iOS isso toma a sessão
de áudio e deixa o AudioContext no estado `"interrupted"` (que só existe no
Safari). O código só religava o áudio quando o estado era `"suspended"`, então
nada acontecia. O Retomar funcionava porque não chama a voz sintética e religa o
áudio dentro de um toque real.

**Correção:**
1. Removido o "aquecimento" da voz sintética no `startBreath()`.
2. `stopSay()` só cancela a voz sintética se ela estiver falando.
3. `getACtx()` religa o áudio também no estado `"interrupted"`.
4. Rede de segurança `destravaAudio()`: se a prática está rodando com o áudio
   parado, qualquer toque na tela religa o som.
5. Se depois de 1,5 s o áudio ainda não andou, o círculo mostra
   "Toque na tela para começar".

**Regra que fica:** NÃO usar `speechSynthesis` (voz sintética) em nenhum lugar do
app. Todas as falas são gravadas. As funções `say()` e `sayMantra()` estão no
código mas ninguém as chama — não reativar.

**Tentativas que NÃO resolveram (para não repetir):**
- Conferir `bgAudio.paused` 600 ms depois do `play()` em `ensureAudioRunning()`.
- Chamar `bgAudio.play()` de novo no `comContexto()`, depois que a voz decodifica.
  (Os dois ficaram no código como proteção extra, mas não eram a causa.)

## Android picotando (Moto G23, Samsung A53)

**25/out/2026:** o `tickVisual()` passou a guardar os elementos da tela e a rodar
a cada 100 ms (antes 50 ms). Não bastou: o picote seguia até "carregar tudo" e a
jornada trepidava.

**26/out/2026 — causa principal:** a prática inteira era agendada de uma vez (no
Entretenimento de 23 min, ~400 sons + filtros criados no início, esperando no
grafo de áudio). Android mais fraco não dá conta.

**Correção (só no Android, `IS_ANDROID`):**
- `lazyDefer()`/`lazyPump()`: `scheduleSound`, `scheduleVoiceClip` e
  `scheduleCrest` só criam o som se ele começa nos próximos 25 s
  (`LAZY_AHEAD`); o resto vai pra fila `lazyQ`, esvaziada pelo `tickVisual`.
  Guarda o `bMode` do momento (as jornadas trocam o `bMode` ao montar).
- Ao apagar a tela (`visibilitychange` hidden), agenda tudo o que falta de uma vez.
- `AudioContext` com `latencyHint:"playback"` (buffer maior).
- iPhone continua agendando tudo de uma vez — lá o JS para com a tela apagada.

Teste no Chromium simulando Android: ~30 sons vivos por vez em vez de ~400.

**Voz aguda/estridente no Android (26/out/2026):** só no Android, a presença da
voz (`ensureVoiceBus`, 2,8 kHz) caiu de +6 dB para +1,5 dB, ganhou um corte suave
de -4 dB acima de 6 kHz, e o realce de agudo dos clipes "brilhantes" caiu de +11 dB
para +4 dB (oração: +2 dB). iPhone sem mudança.

## Volumes e oração — 26/out/2026

- Anúncio das práticas (`isNameAnn` em `announceVolumeFor`): 0.9125 → 0.45625 →
  0.228125 (duas reduções de 50% no mesmo dia).
- Condução do Suspiro (`fisioVol`): `GUIDE_VOL*2.25` → `GUIDE_VOL*1.6875` (-25%).
- Ruído no fim da prática (resto da paisagem depois do "Desfrute"): o
  `finishBreath()` chamava `stopSoundscape()` gradual, que cancelava o fade final
  e relia o volume — podia voltar ao volume cheio por um instante. Agora
  `stopSoundscape(true)` (corte direto; a paisagem já está em silêncio ali).
- "Desfrute em silêncio…" (`ann4`): 0.585 → 0.2925 → 0.365625 (+25%).
- Oração "Que todos os seres…" (`mantra_todos`) estava metálica: a
  `MANTRA_LEVEL_CURVE` foi medida no WAV de 25,75 s, mas o arquivo atual tem
  31,02 s — a curva esticada dava até +15 dB em trechos já fortes e o limitador
  esmagava. Curva desligada. Agudo (high-shelf) da oração de +11 dB → +4 dB.
  **Se o arquivo da oração for reeditado, nunca reaproveitar curva antiga.**
  Depois, a pedido do usuário, `MANTRA_VOL` 0.605 → 0.847 (+40%).

## Entretenimento Meditativo de 15 minutos — 02/nov/2026

- Nova jornada `jornada3`: 3 min Coerente → 2 min Suspiro → 7 min SoHam (ordem e
  Meditação de 7 min pedidas pelo usuário). Diferente das outras, aqui o rótulo é a
  duração REAL: 15min00s exatos com anúncios, pausas, sinos e encerramento.
  Histórico: 5/3/7 dava 18 min; 4,5/2,5/5 dava 15 mas a Meditação ficava curta.
  `totalMin:15` no BMODES faz a tela mostrar "~15 min".
- SoHam da jornada3 (divisão padrão de 7 min): 7 ciclos (58s) → voz → silêncio 51s →
  7 ciclos → voz → silêncio 1min10 → 4 ciclos (33s) → voz → silêncio final 1min50 →
  3 sinos. `fixedSoham` aceita `s1`/`s2` opcionais (hoje ninguém usa).
- `JOURNEY_SEQ.jornada3`, `buildJornada3Timeline()` (cópia da estrutura da
  jornada2, pausas de 15 s), `journeyKeyOf()` substitui os ternários que só
  conheciam jornada/jornada2. Botões na tela inicial (entre 10 e 23) e na tela
  Respirar; nome na tela de bloqueio (`setMediaSession`).
- Anúncios: as três só pelo nome (não há gravações de "três"/"dois"/"sete minutos"
  para essas práticas).
- Testado: jornadas de 10 e 23 min e SoHam avulso (5/10/15/20) idênticos aos de antes.
- Manual (Parte 10) ainda não menciona a jornada de 15 min.
- Backup da versão anterior: `backups/leveza/index-BACKUP-funcionando-26out.html`.

## Publicação

- `PUBLICAR_TUDO.bat` publica os dois apps a partir do mesmo `index.html`/`sw.js`:
  `levezadeviver-oficial` (grátis) e `levezadeviver-acesso` (pago, Kiwify).
  Sempre publicar por ele, para os dois ficarem iguais.
- No passo 4/9, "Resposta: 404" é normal: só testa se a internet chega na Cloudflare.
- Se o Wrangler perguntar sobre atualizar "Cloudflare skills": responder N; e em
  "parar de perguntar": Y. Não afeta o app.

## Manual — 02/nov/2026

- As jornadas ficam descritas na **Parte 6** (`#s06`, áudio `audio/06-entretenimento.mp3`).
  A Parte 10 (`10-jornada.mp3`) é só o sentido da jornada, sem tempos.
- Parte 6 e sumário corrigidos para 10, 15 e 23 minutos (antes diziam "12 e 25" e
  "10 e 25"). Backup do manual anterior em `backups/leveza/`.
- Falta regravar `06-entretenimento.mp3` e o `manual-completo.mp3`.

### Revisão completa do manual — 02/nov/2026
- Índice: era `<ol>` numerando 1–15 sozinho, mas as seções vão 1–5, ✦, 6–14 → tudo a
  partir do 6 ficava com número errado. Item ✦ agora sem número (`li.extra`) e
  `<li value="6">` no seguinte.
- Modo escuro do celular deixava o topo ilegível (branco sobre cinza) e títulos
  apagados. Bloco `prefers-color-scheme: dark` removido: o manual fica sempre claro,
  igual ao app.
- Textos corrigidos: Parte 3 (faltava o Entretenimento na tela Início), Parte 4
  (menu se chama "Respirar"; 4:7:8 escolhe repetições), Parte 5 (Coerente é 5s/5,5s
  com toque de cristal, não "mesmo tempo"), Parte 11 (Shanti é IA: texto vai pela
  internet; conversas ficam no aparelho em `lv_shanti_log`), Parte 12 (acompanhamento
  automático envia práticas e TEXTO DO DIÁRIO ao painel — `syncDiarios`), Parte 13
  (Shanti e Manual precisam de internet — /manual/ fica fora do cache do sw.js),
  Parte 14 (dica "toque na tela" do `destravaAudio`).
- localStorage do tamanho de letra protegido com try/catch.
- Áudios que não batem mais com o texto: 03, 04, 05, 11 (e 12, 13, 14 só nas notas novas).
