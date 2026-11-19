// index.js
// Variáveis de ambiente injetadas pelo IBM Code Engine — sem dotenv.

const express = require('express');
const { router, ValidationError, WatsonxError, DEFAULT_MODEL } = require('./src/routes');
const { readConfig } = require('./src/watsonxClient');

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
// Opcional: quando definido, exige o header x-api-key nas rotas /api.
const API_ACCESS_KEY = process.env.API_ACCESS_KEY;
const SHUTDOWN_TIMEOUT_MS = 10000;

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

// O app cliente chama esta API pelo navegador — sem CORS o preflight barra tudo.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', CORS_ORIGIN);
  // Com origem específica a resposta varia por origem; sem Vary um cache
  // intermediário serviria a mesma resposta para outra origem.
  if (CORS_ORIGIN !== '*') res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/', (req, res) => {
  res.json({
    app: 'mentoria-leveza',
    version: require('./package.json').version,
    status: 'online',
    model: DEFAULT_MODEL,
    endpoints: {
      health: 'GET  /api/health',
      generate: 'POST /api/generate → { prompt, model_id?, max_tokens? }',
      chat: 'POST /api/chat     → { messages: [{role, content}], model_id?, max_tokens? }',
    },
  });
});

// /api/health fica fora da proteção para o Code Engine poder sondar o serviço.
app.use('/api', (req, res, next) => {
  if (!API_ACCESS_KEY || req.path === '/health' || req.method === 'OPTIONS') return next();
  if (req.get('x-api-key') === API_ACCESS_KEY) return next();
  res.status(401).json({ error: 'Credencial de acesso inválida ou ausente.' });
});

app.use('/api', router);

app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
});

// eslint-disable-next-line no-unused-vars -- o Express só reconhece o handler de erro com 4 argumentos
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message });
  }
  // Corpo JSON malformado: sem isto o Express devolveria uma página HTML.
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Corpo da requisição não é um JSON válido.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Corpo da requisição excede o limite de 256kb.' });
  }
  if (err instanceof WatsonxError) {
    console.error(`Erro watsonx (${err.status}):`, err.message, err.details ?? '');
    return res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({
      error: 'Erro ao chamar IBM watsonx.ai',
      details: err.message,
    });
  }

  console.error('Erro inesperado:', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

function start() {
  const { apiKey, url, projectId } = readConfig();
  const server = app.listen(PORT, HOST, () => {
    console.log('─────────────────────────────────────');
    console.log('🚀 mentoria-leveza iniciado');
    console.log(`📡 Escutando em http://${HOST}:${PORT}`);
    console.log(`🤖 Modelo padrão   : ${DEFAULT_MODEL}`);
    console.log(`🔑 WATSONX_API_KEY : ${apiKey ? 'ok' : 'ausente'}`);
    console.log(`🌐 WATSONX_URL     : ${url ? 'ok' : 'ausente'}`);
    console.log(`📁 PROJECT_ID      : ${projectId ? 'ok' : 'ausente'}`);
    console.log(`🔒 Acesso protegido: ${API_ACCESS_KEY ? 'sim (x-api-key)' : 'não'}`);
    console.log('─────────────────────────────────────');
  });

  // O Code Engine envia SIGTERM ao reescalonar; sem isto as requisições em voo caem.
  const shutdown = (signal) => {
    console.log(`${signal} recebido, encerrando...`);
    const timer = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
    server.close(() => {
      clearTimeout(timer);
      process.exit(0);
    });
    // Sem isto, conexões keep-alive ociosas seguram o close() até o timeout.
    server.closeIdleConnections();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

if (require.main === module) start();

module.exports = { app, start };
