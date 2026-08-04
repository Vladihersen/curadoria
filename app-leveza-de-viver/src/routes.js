// src/routes.js
const express = require('express');
const { generateText, readConfig, WatsonxError } = require('./watsonxClient');

const router = express.Router();

// granite-13b-chat-v2 foi retirado do watsonx.ai; este é o substituto suportado.
const DEFAULT_MODEL = process.env.WATSONX_MODEL_ID || 'ibm/granite-3-8b-instruct';
const MAX_TOKENS_LIMIT = 4096;
const DEFAULT_TEMPERATURE = 0.7;
const MAX_MESSAGES = 50;
const MAX_PROMPT_CHARS = 32000;

const ROLE_LABELS = { user: 'Usuário', assistant: 'Assistente' };
const VALID_ROLES = new Set(['system', 'user', 'assistant']);

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

// Express 4 não captura rejeições de handlers async — sem isto o erro vira timeout.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function parseModelId(value) {
  if (value === undefined) return DEFAULT_MODEL;
  if (typeof value !== 'string' || !/^[\w.\-/]{1,128}$/.test(value)) {
    throw new ValidationError('O campo "model_id" deve ser um identificador de modelo válido.');
  }
  return value;
}

function parseMaxTokens(value, fallback) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > MAX_TOKENS_LIMIT) {
    throw new ValidationError(`O campo "max_tokens" deve ser um inteiro entre 1 e ${MAX_TOKENS_LIMIT}.`);
  }
  return value;
}

function parsePrompt(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError('O campo "prompt" é obrigatório e deve ser um texto não vazio.');
  }
  if (value.length > MAX_PROMPT_CHARS) {
    throw new ValidationError(`O campo "prompt" excede o limite de ${MAX_PROMPT_CHARS} caracteres.`);
  }
  return value;
}

function parseMessages(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('O campo "messages" deve ser um array não vazio.');
  }
  if (value.length > MAX_MESSAGES) {
    throw new ValidationError(`O campo "messages" excede o limite de ${MAX_MESSAGES} mensagens.`);
  }

  return value.map((message, i) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw new ValidationError(`messages[${i}] deve ser um objeto { role, content }.`);
    }
    if (!VALID_ROLES.has(message.role)) {
      throw new ValidationError(`messages[${i}].role deve ser "system", "user" ou "assistant".`);
    }
    if (typeof message.content !== 'string' || !message.content.trim()) {
      throw new ValidationError(`messages[${i}].content deve ser um texto não vazio.`);
    }
    return { role: message.role, content: message.content.trim() };
  });
}

// Mensagens "system" viram preâmbulo — rotulá-las como "Assistente" corrompia o prompt.
function buildChatPrompt(messages) {
  const preamble = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');

  const turns = messages
    .filter((m) => m.role !== 'system')
    .map((m) => `${ROLE_LABELS[m.role]}: ${m.content}`);

  if (turns.length === 0) {
    throw new ValidationError('É necessária ao menos uma mensagem com role "user" ou "assistant".');
  }

  const prompt = `${preamble ? `${preamble}\n\n` : ''}${turns.join('\n')}\nAssistente:`;
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new ValidationError(`O histórico excede o limite de ${MAX_PROMPT_CHARS} caracteres.`);
  }
  return prompt;
}

// GET /api/health — não expõe valores das credenciais, apenas se estão presentes.
router.get('/health', (req, res) => {
  const { apiKey, url, projectId } = readConfig();
  const configured = Boolean(apiKey && url && projectId);

  res.status(configured ? 200 : 503).json({
    status: configured ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    model: DEFAULT_MODEL,
    env: {
      WATSONX_API_KEY: apiKey ? 'configurada' : 'ausente',
      WATSONX_URL: url ? 'configurada' : 'ausente',
      WATSONX_PROJECT_ID: projectId ? 'configurado' : 'ausente',
    },
  });
});

// POST /api/generate — geração de texto avulsa.
router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const prompt = parsePrompt(body.prompt);
    const modelId = parseModelId(body.model_id);
    const maxTokens = parseMaxTokens(body.max_tokens, 200);

    const { text } = await generateText({
      input: prompt,
      modelId,
      parameters: { max_new_tokens: maxTokens, temperature: DEFAULT_TEMPERATURE },
    });

    res.json({ success: true, model_id: modelId, result: text });
  })
);

// POST /api/chat — conversa com histórico.
router.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const messages = parseMessages(body.messages);
    const modelId = parseModelId(body.model_id);
    const maxTokens = parseMaxTokens(body.max_tokens, 300);

    const { text } = await generateText({
      input: buildChatPrompt(messages),
      modelId,
      parameters: {
        max_new_tokens: maxTokens,
        temperature: DEFAULT_TEMPERATURE,
        stop_sequences: ['\nUsuário:', 'Usuário:'],
      },
    });

    res.json({ success: true, model_id: modelId, reply: text.trim() });
  })
);

module.exports = { router, ValidationError, WatsonxError, DEFAULT_MODEL };
