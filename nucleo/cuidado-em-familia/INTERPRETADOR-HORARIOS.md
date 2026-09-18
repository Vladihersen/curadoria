# Interpretador de Horários da Receita + Mural de 10 Horários

Aplicativo: <https://cuidado-em-familia.vladihersen.workers.dev/>
Arquivo publicado: `cuidado.html` (deploy via `PUBLICAR_APP.bat` → `npx wrangler deploy`).

## O que mudou

### A. Interpretador de horários (`interpretarHorarios`)
Lê o texto da posologia — digitado ou vindo do OCR/IA — e devolve a quais dos
10 horários clínicos aquele remédio pertence, com a evidência textual de cada
decisão.

| `shiftKey` | Reconhece |
|---|---|
| `madrugada` | 02:00, 03:00, "madrugada", intervalos de 4/4h e 6/6h |
| `jejum` | "jejum", "ao acordar", "antes do café", "30 min antes de comer", 05:00–06:59 |
| `manha` | "manhã", "café da manhã", 07:00–10:59 |
| `antes_almoco` | "15 a 30 min antes do almoço", "antes do meio-dia", 11:00–11:59 |
| `almoco` | "após o almoço", "junto ao almoço", "meio-dia", 12:00–13:59 |
| `tarde` | "lanche", "tarde", 14:00–17:59 |
| `antes_jantar` | "antes do jantar", 18:00–18:59 |
| `noite` | "noite", "jantar", 19:00–21:59 |
| `deitar` | "ao deitar", "antes de dormir", 22:00–23:59 |
| `extra_sos` | "se necessário", "se tiver dor", "em caso de febre", "SOS" |

Como funciona: o texto é normalizado (sem acento, minúsculo); então são lidos
**primeiro os intervalos** (`4/4h`, `de 8 em 8 horas`), **depois os horários**
(`08:00`, `20h`) e **por último as regras de texto**, da mais específica para a
mais genérica. Cada trecho reconhecido é consumido — é isso que impede
"antes do almoço" de ser recapturado pela regra de "almoço".

A ordem dos intervalos antes dos horários importa: em `4/4h` existe um "4h"
embutido que, lido como hora do relógio, prenderia o remédio só na madrugada em
vez de espalhá-lo pelo dia.

### B. Mural com os 10 cartões
Os cartões são montados por `renderizarCartoesTurnos()` a partir da matriz
`TURNOS`. Cada cartão tem cabeçalho com ícone e horário, copinho dosador
(`X comprimidos para separar`), botão de áudio (`SpeechSynthesis`), a `med-list`
e o botão de ação dual.

**O mural não vem pré-selecionado.** Quem cuida escolhe em quais períodos a
pessoa toma remédio e em que horário (botão *🕒 Meus períodos e horários*), e o
que a IA lê nas receitas fotografadas acende esses horários sozinho
(`ativarTurnos`). Um período com remédio cadastrado nunca some do mural sem
aviso.

### C. Marcação / desmarcação
Estado do dia em `cf_doses_log_AAAA-MM-DD`, um registro por turno com
`confirmado`, `hora`, `dataBr` e um `historico` de todas as confirmações e
reaberturas. O botão é dual: confirma quando está aberto, reabre quando já está
confirmado — a correção não apaga o histórico estrutural.

Tirar um remédio só de hoje continua em `cf_desm_<data>`: como a chave carrega a
data, amanhã ele volta ao mural normalmente.

## Compatibilidade com o que já está rodando
Nada é zerado nem renomeado:

- `cf_medicamentos` mantém as chaves `manha`/`almoco`/`noite` como sempre;
  `garantirTurnos()` só **acrescenta** os sete horários novos, vazios, e
  preserva qualquer chave desconhecida.
- As confirmações antigas (`cf_confirmado_*`) continuam sendo gravadas e lidas
  em paralelo ao log novo, então uma confirmação feita na versão anterior
  aparece normalmente e um aparelho ainda na versão antiga continua enxergando
  as confirmações desta.
- Para quem já usa o app e ainda não escolheu períodos, eles são deduzidos dos
  remédios já cadastrados — o mural abre igual ao que era.
- A sincronização da família leva os períodos escolhidos, os horários
  personalizados e o log do dia junto do payload que já existia.

## Testes
- `teste-parser.mjs` — 40 verificações do interpretador (todos os termos da
  especificação, faixas horárias e a migração aditiva).
- `teste-mural.mjs` — 6 cenários no navegador (usuário existente com dados da
  versão antiga, botão dual, família nova, escolha de períodos, importação da
  IA, pular um remédio só hoje).

```
node --check <script extraído>   # sintaxe
node teste-parser.mjs
node teste-mural.mjs             # precisa de playwright
```
