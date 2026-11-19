// src/watsonxClient.js
// Cliente REST do IBM watsonx.ai.
//
// A API do watsonx NÃO aceita a apikey crua como Bearer token. É preciso trocá-la
// por um access token do IBM Cloud IAM (válido ~1h) e renová-lo antes de expirar.

const IAM_URL = process.env.IAM_URL || 'https://iam.cloud.ibm.com/identity/token';
const API_VERSION = process.env.WATSONX_API_VERSION || '2023-05-29';
const TIMEOUT_MS = Number(process.env.WATSONX_TIMEOUT_MS) || 60000;

// Renova com folga para não usar um token que expire em trânsito.
const TOKEN_SKEW_MS = 5 * 60 * 1000;

let cachedToken = null; // { accessToken, expiresAt }
let inFlightToken = null; // evita corrida quando várias requisições chegam juntas

class WatsonxError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'WatsonxError';
    this.status = status;
    this.details = details;
  }
}

function readConfig() {
  return {
    apiKey: process.env.WATSONX_API_KEY,
    url: process.env.WATSONX_URL,
    // PROJECT_ID é o nome usado hoje no Code Engine; mantido como fallback.
    projectId: process.env.WATSONX_PROJECT_ID || process.env.PROJECT_ID,
  };
}

function requireConfig() {
  const { apiKey, url, projectId } = readConfig();
  const missing = [];
  if (!apiKey) missing.push('WATSONX_API_KEY');
  if (!url) missing.push('WATSONX_URL');
  if (!projectId) missing.push('WATSONX_PROJECT_ID');

  if (missing.length) {
    throw new WatsonxError(`Variáveis de ambiente ausentes: ${missing.join(', ')}`, 503);
  }
  return { apiKey, url: url.replace(/\/+$/, ''), projectId };
}

async function readBody(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// A IBM devolve erros em formatos diferentes conforme o serviço.
function extractMessage(body) {
  if (!body) return null;
  if (typeof body === 'string') return body.slice(0, 500) || null;
  return (
    body.errors?.[0]?.message ||
    body.error?.message ||
    body.errorMessage ||
    (typeof body.error === 'string' ? body.error : null) ||
    body.message ||
    null
  );
}

function wrapTransportError(err, contexto) {
  if (err instanceof WatsonxError) return err;
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    return new WatsonxError(`Tempo esgotado ao ${contexto} (${TIMEOUT_MS}ms)`, 504);
  }
  return new WatsonxError(`Falha de rede ao ${contexto}: ${err.message}`, 502);
}

async function fetchAccessToken(apiKey) {
  let response;
  try {
    response = await fetch(IAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: apiKey,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw wrapTransportError(err, 'autenticar no IBM Cloud IAM');
  }

  const body = await readBody(response);

  if (!response.ok) {
    throw new WatsonxError(
      extractMessage(body) || 'Falha ao autenticar no IBM Cloud IAM',
      response.status === 400 || response.status === 401 ? 401 : 502,
      body
    );
  }

  const accessToken = body?.access_token;
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new WatsonxError('IBM Cloud IAM não devolveu access_token', 502, body);
  }

  const expiresInMs = (Number(body.expires_in) || 3600) * 1000;
  return { accessToken, expiresAt: Date.now() + expiresInMs };
}

async function getAccessToken() {
  const { apiKey } = requireConfig();

  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_SKEW_MS) {
    return cachedToken.accessToken;
  }
  if (inFlightToken) return inFlightToken;

  inFlightToken = (async () => {
    try {
      cachedToken = await fetchAccessToken(apiKey);
      return cachedToken.accessToken;
    } finally {
      inFlightToken = null;
    }
  })();

  return inFlightToken;
}

async function generateText({ input, modelId, parameters = {} }) {
  const { url, projectId } = requireConfig();
  const token = await getAccessToken();

  let response;
  try {
    response = await fetch(`${url}/ml/v1/text/generation?version=${API_VERSION}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model_id: modelId,
        project_id: projectId,
        input,
        parameters,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw wrapTransportError(err, 'chamar o watsonx.ai');
  }

  const body = await readBody(response);

  if (!response.ok) {
    // Token revogado ou expirado: descarta o cache para a próxima tentativa.
    if (response.status === 401) cachedToken = null;
    throw new WatsonxError(
      extractMessage(body) || `watsonx.ai respondeu ${response.status}`,
      response.status,
      body
    );
  }

  const text = body?.results?.[0]?.generated_text;
  if (typeof text !== 'string') {
    throw new WatsonxError('Resposta do watsonx.ai sem texto gerado', 502, body);
  }

  return { text, raw: body };
}

// Usado pelos testes para isolar o cache entre casos.
function resetTokenCache() {
  cachedToken = null;
  inFlightToken = null;
}

module.exports = { generateText, getAccessToken, readConfig, resetTokenCache, WatsonxError };
