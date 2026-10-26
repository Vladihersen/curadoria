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

## Android picotando (Moto G23) — 25/out/2026

O `tickVisual()` rodava a cada 50 ms buscando elementos da tela toda vez. Passou
a guardar os elementos (`elOrbArc`, `elOrbRem`, `elOrbCyc`) e a rodar a cada
100 ms. Ainda falta confirmação do usuário de que resolveu.

## Publicação

- `PUBLICAR_TUDO.bat` publica os dois apps a partir do mesmo `index.html`/`sw.js`:
  `levezadeviver-oficial` (grátis) e `levezadeviver-acesso` (pago, Kiwify).
  Sempre publicar por ele, para os dois ficarem iguais.
- No passo 4/9, "Resposta: 404" é normal: só testa se a internet chega na Cloudflare.
- Se o Wrangler perguntar sobre atualizar "Cloudflare skills": responder N; e em
  "parar de perguntar": Y. Não afeta o app.
