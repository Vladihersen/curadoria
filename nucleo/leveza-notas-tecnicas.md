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

## Publicação

- `PUBLICAR_TUDO.bat` publica os dois apps a partir do mesmo `index.html`/`sw.js`:
  `levezadeviver-oficial` (grátis) e `levezadeviver-acesso` (pago, Kiwify).
  Sempre publicar por ele, para os dois ficarem iguais.
- No passo 4/9, "Resposta: 404" é normal: só testa se a internet chega na Cloudflare.
- Se o Wrangler perguntar sobre atualizar "Cloudflare skills": responder N; e em
  "parar de perguntar": Y. Não afeta o app.
