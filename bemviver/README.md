# App do Método Bem Viver

App do piloto em `vladimirhersen.com.br/bemviver/` (piloto de 23/11 a 20/12/2026):
as práticas do dia, o suspiro fisiológico guiado, as perguntas de domingo (com espaço
livre opcional) e a tela de cuidados. O painel do Vladimir fica em
`/bemviver/painel?chave=...` (a chave é o secret `ADMIN_KEY`).

A data de início fica em `INICIO_PILOTO`, no topo de `public/bemviver/app.js`. Antes dela,
a aba Hoje mostra a preparação (boas-vindas, instalar na tela do celular, guardar os áudios,
experimentar o suspiro sem contar nos resultados) e a aba Domingo só explica o que vem.

O link do email pode trazer o nome e o WhatsApp preenchidos:
`/bemviver/?nome=...&whatsapp=...` (no MailerLite, com os campos de personalização).

## Áudios

Os seis áudios aprovados ficam em `public/bemviver/audio/`, em MP3:

- `1-boas-vindas.mp3`
- `2-comeco-do-dia.mp3`
- `3a-respiro-1-minuto.mp3` (suspiro fisiológico de 1 minuto)
- `3b-respiro-5-minutos.mp3` (suspiro fisiológico de 5 minutos)
- `4-noite.mp3`
- `5-domingo.mp3`

Funciona como o Leveza de Viver: na primeira abertura, o app inteiro fica guardado no
celular, com os seis áudios, e passa a abrir e tocar sem internet (o `sw.js` responde aos
pedidos do player, inclusive os pedaços que o iPhone pede). Se um arquivo faltar, o app
mostra "O áudio guiado chega em breve". Enquanto um áudio toca, ou enquanto o suspiro
guiado está na tela, a tela do celular fica acesa, e a tela bloqueada mostra o nome do
áudio com os botões de tocar e pausar.

## Atualizações

A cada publicação, o GitHub Actions carimba uma versão nova no `sw.js` (`__VERSAO__`).
O celular de quem tem o app baixa a versão nova em segundo plano e mostra o aviso
"Há uma versão nova do app. Atualizar". Ela só entra quando a pessoa toca no aviso, e o
aviso espera terminar o áudio ou o suspiro em andamento. As marcações da pessoa ficam.

**Trocou um áudio?** Mantenha o mesmo nome de arquivo e suba `VERSAO_AUDIOS` no `sw.js`
(`a1` para `a2`). Na atualização, o celular baixa os seis áudios de novo e apaga os antigos.

## Publicar

Vai ao ar sozinho pelo GitHub Actions (`.github/workflows/bemviver-deploy.yml`) quando
algo em `bemviver/` muda na `main`. O Worker se chama `metodo-bem-viver`.

Depois da primeira publicação, definir a chave do painel uma vez, no painel da
Cloudflare: Workers e Pages, `metodo-bem-viver`, Configurações, Variáveis e segredos,
Adicionar, tipo Segredo, nome `ADMIN_KEY`. (Ou, no terminal: `npx wrangler secret put ADMIN_KEY`.)
