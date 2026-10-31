# App do Método Bem Viver (Dia Bem Vivido)

App do piloto em `vladimirhersen.com.br/dia/`: as práticas do dia, a pausa guiada,
a nota de domingo e a tela de cuidados. O painel do Vladimir fica em
`/dia/painel?chave=...` (a chave é o secret `ADMIN_KEY`).

## Áudios

Coloque os áudios em `public/dia/audio/`, em MP3, com estes nomes exatos
(roteiros na versão 2, com os pilares revisados e a Zona de Entusiasmo):

- `1-boas-vindas.mp3`
- `2-comeco-do-dia.mp3`
- `3a-respiro-1-minuto.mp3`
- `3b-respiro-5-minutos.mp3`
- `4-noite.mp3`
- `5-domingo.mp3`

Enquanto um arquivo não existir, o app mostra "O áudio guiado chega em breve".

## Publicar

Vai ao ar sozinho pelo GitHub Actions (`.github/workflows/dia-deploy.yml`) quando algo
em `dia/` muda na `main`. Antes do primeiro uso, definir a chave do painel uma vez:

    npx wrangler secret put ADMIN_KEY
