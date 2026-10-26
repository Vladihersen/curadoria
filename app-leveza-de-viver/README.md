# mentoria-leveza

API do app **Leveza de Viver** — backend Node.js/Express integrado ao IBM watsonx.ai,
publicado no IBM Code Engine.

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `WATSONX_API_KEY` | sim | — | Apikey do IBM Cloud. É trocada automaticamente por um access token IAM. |
| `WATSONX_URL` | sim | — | Endpoint regional do watsonx.ai (ex.: `https://us-south.ml.cloud.ibm.com`). |
| `WATSONX_PROJECT_ID` | sim | — | ID do projeto watsonx. `PROJECT_ID` é aceito como alternativa. |
| `WATSONX_MODEL_ID` | não | `ibm/granite-3-8b-instruct` | Modelo padrão. |
| `WATSONX_API_VERSION` | não | `2023-05-29` | Versão da API de inferência. |
| `WATSONX_TIMEOUT_MS` | não | `60000` | Tempo limite das chamadas ao watsonx e ao IAM. |
| `IAM_URL` | não | `https://iam.cloud.ibm.com/identity/token` | Endpoint de token do IBM Cloud IAM. |
| `CORS_ORIGIN` | não | `*` | Origem permitida para o app cliente. |
| `API_ACCESS_KEY` | não | — | Quando definida, exige o header `x-api-key` nas rotas `/api` (exceto `/api/health`). |
| `PORT` | não | `8080` | Porta HTTP (o Code Engine injeta automaticamente). |

## Rotas

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| `GET` | `/` | — | Metadados do serviço. |
| `GET` | `/api/health` | — | `200` se as credenciais estão presentes, `503` caso contrário. |
| `POST` | `/api/generate` | `{ prompt, model_id?, max_tokens? }` | `{ success, model_id, result }` |
| `POST` | `/api/chat` | `{ messages: [{ role, content }], model_id?, max_tokens? }` | `{ success, model_id, reply }` |

`role` aceita `system`, `user` e `assistant`. `max_tokens` é um inteiro entre 1 e 4096.
Erros sempre voltam como JSON no formato `{ error, details? }`.

## Rodando localmente

```bash
npm install
export WATSONX_API_KEY=...
export WATSONX_URL=https://us-south.ml.cloud.ibm.com
export WATSONX_PROJECT_ID=...
npm start
```

## Testes

```bash
npm test
```

A suíte sobe um IBM Cloud IAM e um watsonx.ai falsos, então roda offline e sem consumir
créditos.

## Notas de operação

- A apikey **não** é enviada como Bearer token: o serviço a troca por um access token IAM,
  guarda em cache e renova 5 minutos antes de expirar.
- O `SIGTERM` do Code Engine é tratado para não derrubar requisições em andamento.
- Sem `API_ACCESS_KEY` a API fica aberta na internet e qualquer pessoa pode consumir a
  cota do watsonx. Defina-a antes de divulgar a URL pública.
