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

---

## Passo 3 do cadastro: a rotina de cuidado

O cadastro passou de 3 para 4 passos. O passo novo pergunta, antes de entrar no
mural, três coisas que decidem o que aparece nele:

1. **Sinais vitais** — "vocês medem pressão, glicose ou oxigênio no dia a dia?"
   Se não, o cartão de sinais vitais não ocupa espaço no mural
   (`cf_acompanha_sinais`).
2. **Hidratação** — quantos litros por dia, e se a família prefere marcar em
   copos (250 ml) ou garrafas (500 ml). A conversão aparece na hora
   ("≈ 6 copos de 250 ml por dia") e alimenta o cartão de água
   (`cf_acompanha_agua`, `cf_config_agua`).
3. **Escaras** — "ela tem escaras?" Só quem responde que sim ganha o cartão de
   cuidado com escaras (`cf_escaras_na`, mantida com o sentido invertido que já
   tinha: `'true'` significa "não se aplica").

O cartão de escaras existia só no JavaScript — as funções
`alternarEscarasNaoAplica()` e `restaurarEscarasNaoAplica()` procuravam
elementos que nunca foram escritos no HTML. A tela dele foi construída, com
registro das mudanças de posição por dia em `cf_escaras_log_AAAA-MM-DD`.

Um bloco que já tem dado registrado **nunca** é escondido, mesmo que a família
tenha respondido que não acompanha: some da tela só o que está realmente vazio.
Quem já usava o app e nunca respondeu nada continua vendo exatamente os mesmos
cartões de antes, e não ganha nenhum cartão novo sem ter pedido.

## Revisão completa do app

- `teste-auditoria.mjs` — varredura estática (handlers de `onclick` sem função,
  `getElementById` de ids inexistentes, ids duplicados) mais um percurso no
  navegador pelo cadastro inteiro, as 3 abas e os 22 modais, coletando qualquer
  erro de JavaScript. **Zero erros.**
- `teste-preservacao.mjs` — carrega o app antigo e o novo com o mesmo estado de
  um usuário real e compara remédios, receitas e cartões visíveis, para provar
  que nada se perde na atualização.

A varredura estática aponta referências a elementos que não existem
(`banner-alerta-esquecimento`, `pos-atual`, `miniaturas-onboarding` e outras).
São anteriores a esta mudança e não quebram nada: estão todas protegidas por
`if (elemento)`, e as funções de alarme começam com `return;` porque foram
desativadas de propósito. Ficam registradas aqui como limpeza futura.

## Compatibilidade com o worker publicado

O `wrangler.toml` importa o HTML como texto (`[[rules]] type = "Text"`), então
publicar o mural novo é só substituir o `cuidado.html`: o `cuidado-worker.js`
não precisa mudar.

A leitura da receita pela IA, porém, acontece no worker. Se o prompt dele foi
escrito quando só existiam três turnos, a IA devolve `manha`/`almoco`/`noite`
para tudo — e um remédio "em jejum" chegaria marcado como manhã. Por isso
`normalizarTurno()` confere a posologia lida da receita: quando a IA devolve um
dos três turnos antigos mas o texto aponta claramente um horário que não existia
naquele vocabulário ("em jejum", "ao deitar", "antes do almoço", "se tiver
dor"), quem vale é a receita. Onde a IA teve escolha real, a resposta dela é
respeitada.

`teste-worker-antigo.mjs` cobre exatamente esse caso: simula o worker antigo
devolvendo só os três turnos e confere que os seis remédios caem no horário
certo.

A correção definitiva é ensinar os 10 `shiftKey` ao prompt do
`cuidado-worker.js` — fica para um passo seguinte, e não é necessária para
publicar.

---

# Correções no servidor (`cuidado-worker.js`)

O prompt que lê a receita **já conhecia os 10 horários** — nada a corrigir ali.
Mas a leitura do arquivo revelou três defeitos no servidor que, juntos, causam
perda de dados da família. Os três são anteriores a esta mudança.

### 1. A proteção contra perda de dados nunca era chamada

`mesclarDadosFamiliaComSeguranca()` existe justamente para impedir que um
aparelho com estado incompleto apague dados reais — o comentário dela diz que
isso "já apagou remédios reais de verdade". Só que ela estava **definida e nunca
usada**: `/api/familia/salvar` gravava `JSON.stringify(recebido)` direto por
cima do registro da família.

Agora `/salvar` lê o que está gravado e mescla. `/criar` também, porque o
`ON CONFLICT DO UPDATE` dele consegue sobrescrever uma família existente.

### 2. A proteção só enxergava três turnos

`medicamentosTemItensServidor()` checava apenas `manha`, `almoco` e `noite`.
Uma família com remédios só em jejum, ao deitar ou SOS era considerada "sem
remédio nenhum" — e a proteção acima virava do avesso, justamente no caso que
os 10 horários tornam comum. Passou a percorrer todas as chaves, inclusive as
que vierem no futuro.

### 3. `/api/familia/estado` estava declarada duas vezes

A segunda declaração, a que atende `?codigo=`, vinha depois de uma que sempre
responde — então **nunca executava**. O app chama exatamente com `?codigo=`
(`carregarEstadoFamilia`), recebia a resposta da rota por sessão, que tem outro
formato (sem `sucesso`), e descartava tudo em silêncio: a sincronização entre
aparelhos nunca carregava nada.

A busca por código passou para o início da rota, e o bloco morto foi removido.

**Juntos**, o 1 e o 3 explicam o relatado: um aparelho grava um estado
incompleto por cima do registro bom, e nenhum aparelho consegue carregar de
volta o que estava certo.

`teste-servidor.mjs` extrai essas funções do worker publicado e cobre os quatro
casos: reconhecer remédios em qualquer horário, um aparelho zerado não apagar
nada, uma alteração de verdade continuar passando, e remédios que existem só em
horários novos não serem apagados.

> Nota: `turnosAtivos` entrou na lista de campos protegidos. O efeito colateral
> é que desmarcar **todos** os períodos de uma vez não se propaga para os outros
> aparelhos da família. Foi uma escolha consciente: proteger o mural de ficar em
> branco vale mais do que sincronizar uma ação rara.

**Publicar estas correções exige subir o `cuidado-worker.js` também**, não só o
`cuidado.html`. O `wrangler deploy` envia os dois de uma vez.
