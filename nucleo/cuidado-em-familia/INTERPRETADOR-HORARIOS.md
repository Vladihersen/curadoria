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

---

# Virada do dia, exclusão do histórico e lista recolhível

### O dia não virava

O estado do dia (doses desmarcadas, SOS marcados) era lido **uma única vez**,
quando o app carregava. Num celular com o app aberto a noite toda, à meia-noite
nada era relido: o mural amanhecia com as marcações da véspera e — pior — a
gravação seguinte salvava o estado de ontem sob a chave de HOJE, carimbando o
dia novo com a rotina do dia anterior.

`verificarViradaDoDia()` compara o dia da tela com o dia de agora e, se mudou,
recarrega tudo limpo. É chamada quando o app volta para a frente
(`visibilitychange` — o momento em que a pessoa de fato olha o mural), a cada
minuto, e antes de qualquer gravação de marcação ou confirmação. O registro dos
dias anteriores continua intacto: cada dia tem a sua própria chave.

### Excluir um remédio suspenso

Os remédios encerrados só ofereciam "Reativar". Agora há também "Excluir", com
confirmação nomeando o remédio — isso apaga histórico clínico, que é o que a
família mostra ao médico, então não pode sair por um toque errado.

Isso esbarrava na proteção do servidor: apagar o **último** suspenso manda um
array vazio, e a proteção o restauraria, fazendo a exclusão voltar sozinha na
sincronização seguinte. O app passou a enviar `esvaziadosDeProposito`, a lista
dos campos que a pessoa esvaziou deliberadamente, e o servidor pula a proteção
só para esses campos. Um aparelho com estado incompleto continua sem conseguir
apagar nada.

### Lista recolhível por horário

Um mural com oito remédios na manhã vira uma rolagem longa. Cada cartão ganhou
um botão que esconde a lista, deixando à vista o que quem está dando o remédio
precisa: quantos comprimidos separar e o botão de confirmar. A escolha é por
horário e é lembrada (`cf_turnos_recolhidos`).

`teste-dia-e-lista.mjs` cobre os três: a virada do dia limpando as marcações
sem apagar o registro de ontem, a exclusão do histórico com a marca de
intenção, e o recolher/mostrar sobrevivendo a um recarregamento.

---

# Registro dos remédios "se necessário"

Marcar um SOS no mural guardava apenas o **índice** do remédio na lista daquele
horário — sem hora, sem nome e sem histórico. Dois problemas:

1. **O "✓ Marcado" não era um registro.** Ele sumia na virada do dia sem deixar
   rastro. Para um remédio de resgate, é justamente o contrário do que importa:
   o médico precisa saber *quando* e *quantas vezes* ele foi preciso.
2. **O índice aponta para o remédio errado.** Acrescentar ou remover um remédio
   daquele horário desloca os índices, e a marca passava a valer para outro
   medicamento.

Agora cada toma vira um registro com nome, quantidade, horário e data, guardado
em `cf_sos_log_AAAA-MM-DD` e mantido depois — a chave por dia é o histórico. O
selo no mural passou de "✓ Marcado" para **"✓ Tomado às 19:13"**, com
"2ª vez hoje" quando se repete. Desmarcar remove a última toma daquele remédio
(é a correção de quem marcou sem querer), não o histórico inteiro.

O formato antigo (`cf_sos_<data>`) continua sendo gravado em paralelo, para que
nada do que já está marcado hoje se perca na atualização.

O histórico aparece em dois lugares que faltavam:

- **Pasta → Memória do Cuidado**: as tomas dos últimos 30 dias, agrupadas por
  dia, com horário de cada uma.
- **Relatório médico**: as tomas dos últimos 7 dias, para a consulta.

`teste-sos.mjs` cobre os cinco casos: registrar com hora, contar as vezes do
dia, sobreviver a uma mudança de ordem na lista, aparecer na Pasta e no
relatório, e a virada do dia reabrindo o mural sem apagar o histórico anterior.

---

# Blocos recolhíveis e "não se aplica"

### O botão de recolher era pequeno demais

Era um círculo de 30px com um "▾" de 13px — não dava para enxergar nem acertar
com o dedo. Virou `.btn-recolher`, de 42px, maior que o botão de áudio ao lado.

### Sinais vitais e mudança de posição ganham "não se aplica"

Nenhum dos dois some mais por inteiro: o cartão fica, encolhido para uma linha
com a caixa marcada. Sumir de vez esconderia da família uma coisa que ela talvez
precise **descobrir que existe** — no caso das escaras, isso importa.

Um bloco que já tem dado registrado nunca encolhe. Esconder uma pressão que
alguém anotou seria perder informação sem avisar.

### Mudança de posição (prevenção de escaras)

O cartão passou a aparecer para todos, com a orientação explícita: virar de 2 em
2 horas, alternando entre um lado, as costas e o outro lado. Um aviso conta o
tempo desde a última virada e fica vermelho ao passar das 2 horas — é o
intervalo em que a ferida começa a se formar. O contador é atualizado a cada
minuto junto com o resto do app.

### Gestão da Prescrição recolhível

Mesmo botão dos outros blocos, com a escolha lembrada.

### Uma armadilha que o teste pegou

"Não se aplica" e "recolher" mexiam no mesmo elemento e disputavam entre si: o
recolher reabria o que o "não se aplica" tinha fechado, e a escolha não
sobrevivia a um recarregamento. Agora cada bloco declara um `ocultoPor`, e o
"não se aplica" tem prioridade — quando ele está ligado, o botão de recolher
nem aparece.

`teste-blocos.mjs` cobre os quatro pedidos: tamanho do botão comparado ao de
áudio, o "não se aplica" dos dois blocos (inclusive persistindo e não escondendo
dado já anotado), o aviso das 2 horas, e o recolher da Gestão da Prescrição.

---

# O "Zerar" que se desfazia sozinho

Zerar o app numa aba não adiantava se **outra aba do app continuasse aberta**.
A aba antiga mantinha o código da família em memória e, no polling seguinte
(8 segundos), buscava os dados no servidor e gravava tudo de volta no
`localStorage` — que é compartilhado entre as abas do mesmo navegador. O reset
era desfeito sozinho, sem ninguém ver: a aba zerada mostrava o cadastro do
zero, e os remédios reapareciam assim que ela voltasse ao Mural.

Reproduzido em `teste-reset.mjs`: duas abas, zera numa, e 8 segundos depois o
`cf_medicamentos` está de volta.

A correção avisa as outras abas. O reset:

1. marca `resetEmAndamento` **antes** do primeiro `await`, para que uma
   resposta de sincronização que chegue no meio não regrave nada;
2. avisa as outras abas por `BroadcastChannel`, com o evento `storage` como
   rede de segurança para navegadores que não o tenham;
3. as outras abas param o polling, esquecem a família e recarregam.

`carregarEstadoFamilia()` e `sincronizarComServidor()` passaram a sair cedo
enquanto o reset está em andamento.

O teste também confere que a sincronização normal **não** foi quebrada: um
aparelho novo, com o código da família, continua recebendo os remédios. O
servidor falso do teste reproduz a mescla protetora do worker, senão mediria um
servidor que o app real não tem.

## O alcance do Zerar é só o aparelho

Regra dura, agora garantida por teste: **zerar o próprio celular nunca apaga os
remédios da pessoa cuidada no aparelho de mais ninguém.** Um irmão que zera o
celular dele não pode deixar a cuidadora sem a lista.

O reset limpa este aparelho e o desliga da família (passa a usar um código de
família novo), mas não toca no registro compartilhado no servidor. O aviso na
tela diz isso com todas as letras, porque "apagar TODOS os dados" sem dizer de
onde assusta quem cuida e esconde o que de fato acontece.

`teste-reset.mjs` cobre os três lados: o reset não é desfeito pela outra aba, a
sincronização normal continua funcionando, e depois do reset o registro da
família segue no servidor com os remédios intactos — com outro familiar ainda
recebendo a lista.

---

# Apagar não apagava — e a causa fui eu

Depois que a proteção contra perda de dados foi ligada no servidor, **apagar
deixou de funcionar**. A proteção recusa listas vazias para impedir que um
aparelho com estado incompleto apague dados reais, mas ela não distinguia dois
casos opostos:

- a lista chegou vazia porque o aparelho está com o estado quebrado — recusar;
- a lista chegou vazia porque **a pessoa apagou** — aceitar.

Apagar o último remédio mandava a lista vazia, o servidor devolvia a antiga, e
no polling seguinte (8 s) o remédio reaparecia no aparelho. O mesmo valia para
receitas, exames, vacinas e o histórico. Daí "o app não limpa, não elimina" e
"nem consegui apagar os remédios".

## A correção: número de revisão

O registro da família passou a ter um `rev`, que o servidor incrementa a cada
gravação e devolve junto do estado. O aparelho guarda o `rev` que conhece e o
manda de volta ao salvar:

- **`revBase` igual ao `rev` gravado** → o aparelho provou que sabe o que está
  sobrescrevendo, e a gravação dele é aceita inteira, exclusões incluídas.
- **`revBase` velho ou ausente** → o aparelho não sabe, e cai na mescla
  protetora exatamente como antes.

É a mesma pergunta que a proteção sempre quis fazer — "este aparelho sabe o que
está apagando?" — só que agora respondida por um fato, não por um palpite sobre
o conteúdo.

`teste-apagar.mjs` cobre os dois lados, que é o ponto:

1. apagar o último remédio apaga de verdade e não volta no polling;
2. apagar a última receita idem;
3. um aparelho com revisão velha (ou nenhuma) **continua sem conseguir apagar
   nada** — a proteção original está de pé;
4. depois de zerar, um cadastro novo começa limpo, com código de família novo,
   e a família antiga continua intacta no servidor.

> Publicar esta correção exige subir o `cuidado-worker.js` também, não só o
> `cuidado.html`: a revisão é acordo entre os dois.

---

# O código da família não era aceito

Quem terminava o cadastro, via o Código da Família e o mandava na hora para um
familiar recebia de volta um "código não encontrado". Não era erro de digitação:
**o código nunca tinha sido registrado no servidor.**

`concluirCadastro()` gravava tudo localmente mas não sincronizava. Como
`agendarSincronizacao()` começa com `if (!familiaId) return`, e `familiaId` só é
preenchido dentro de `sincronizarComServidor()`, nada era enviado — o registro
da família só nascia no carregamento seguinte da página. No meio desse intervalo
o código existia no aparelho e em nenhum outro lugar.

Provado antes de corrigir: ao fim do cadastro, `famílias registradas no
servidor: []` enquanto o app exibia o código `xwiiacoh`.

Correções:

- `concluirCadastro()` registra a família no servidor na hora;
- `atualizarCodigoFamiliaVisivel()` faz o mesmo antes de mostrar o código, que é
  justamente o instante em que ele vai ser passado para alguém.

## E ninguém mais fica preso no cadastro

O campo do código ficava no fim do PASSO 1, apesar de o comentário no HTML
dizer "entrar com código direto na capa". Quem errava o código e seguia adiante
não tinha como voltar — não havia botão de voltar em passo nenhum.

- Todos os passos ganharam **← Voltar**, e voltar do passo 1 devolve a capa
  inteira (o `irEtapa(0)` precisava restaurar a tela de boas-vindas).
- A capa passou a ter o campo do código, como o comentário já prometia: quem
  recebe um convite não está fazendo um cadastro novo, está entrando numa
  família que já existe.

`teste-convite.mjs` cobre o caminho inteiro: o responsável se cadastra e o
código vale imediatamente; o acompanhante entra com ele e recebe os dados; e
quem erra o código consegue voltar até o campo — pela capa ou pelo passo 1 — e
acertar na segunda tentativa.

## Excluir medicação (relato: "não estou conseguindo excluir medicação")

Reproduzido no navegador. Eram três defeitos somados, não um:

1. **A lista não se redesenhava.** O botão `✕` da Gestão da Prescrição chamava
   `renderizarResumoPrescricaoPasta()` na hora do clique — antes de a pessoa
   confirmar o motivo — e `confirmarRemocaoMedicamento()` redesenhava o Mural e o
   histórico, mas nunca a lista onde a pessoa acabou de clicar. O remédio era
   realmente excluído e ia para o histórico, mas continuava na tela. Para quem
   está usando, isso é exatamente "não consigo excluir".
2. **A exclusão do último remédio não chegava aos outros aparelhos.** O guard
   "não aceito lista vazia vinda do servidor" existia para não perder dados por
   uma resposta defeituosa, mas ele também recusava uma lista que ficou vazia
   *de propósito*: o outro celular da família guardava o remédio excluído e o
   devolvia ao servidor no ciclo seguinte. Agora a revisão desfaz o empate — se
   o servidor está numa revisão mais nova que a do aparelho, quem manda é o
   servidor, inclusive quando o que sobrou foi uma lista vazia.
3. **Quem entrou pelo código da família ficava na revisão 0 para sempre.** Dois
   dos três lugares que aplicavam os dados do servidor não guardavam a revisão,
   então toda gravação daquele aparelho caía na mesclagem protetora e ele nunca
   conseguia excluir nada. A gravação da revisão passou para dentro de
   `aplicarDadosFamiliaNoEstadoLocal()`, onde nenhum chamador pode esquecê-la.

De passagem: `medicamentosMudaram()` reúne os quatro redesenhos + a
sincronização num lugar só (antes cada ponto redesenhava um pedaço e esquecia
outro), acrescentar remédio passou a avisar o servidor, e o rótulo do histórico
saía como "Tratamentos do Passado0 passados)".

O histórico pedido já existia e continua: Pasta → Memória do Cuidado →
**Remédios Suspensos / Tratamentos do Passado**, com data, motivo, 🔄 Reativar e
🗑️ Excluir. A Gestão da Prescrição agora diz isso em uma linha, para a pessoa
saber que o `✕` guarda e não destrói.

Coberto por `teste-excluir-ui.mjs` (20 verificações), que dirige o `✕` de
verdade, com dois aparelhos abertos e um servidor falso que usa a mesma função
de mescla do worker publicado.
