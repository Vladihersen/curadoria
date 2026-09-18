var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// _worker.js

async function garantirTabelasD1(env) {
  if (!env || !env.DB) return;
  try {
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS familias (id TEXT PRIMARY KEY, dados TEXT, criado_em TEXT, atualizado_em TEXT);
      CREATE TABLE IF NOT EXISTS membros (email TEXT PRIMARY KEY, familia_id TEXT, papel TEXT, entrou_em TEXT);
      CREATE TABLE IF NOT EXISTS eventos_acesso (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT, quando TEXT);
      CREATE TABLE IF NOT EXISTS visitantes_identificados (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, nome TEXT, quando TEXT);
    `);
  } catch (e) {}
}
__name(garantirTabelasD1, "garantirTabelasD1");

import html from "./cuidado.html";
function calcularStatusPremium(registro) {
  if (!registro) return { premiumAtivo: false, trialAte: null, trialExpirado: false };
  if (registro.origem === "trial" && registro.trialAte) {
    const aindaValido = /* @__PURE__ */ new Date() < new Date(registro.trialAte);
    return { premiumAtivo: aindaValido, trialAte: registro.trialAte, trialExpirado: !aindaValido };
  }
  return { premiumAtivo: !!registro.premium, trialAte: registro.trialAte || null, trialExpirado: false };
}
__name(calcularStatusPremium, "calcularStatusPremium");
function gerarToken() {
  return crypto.randomUUID().replace(/-/g, "");
}
__name(gerarToken, "gerarToken");
function lerCookie(request, nome) {
  const cabecalho = request.headers.get("Cookie") || "";
  const partes = cabecalho.split(";").map((p) => p.trim());
  for (const parte of partes) {
    if (parte.startsWith(nome + "=")) return decodeURIComponent(parte.slice(nome.length + 1));
  }
  return null;
}
__name(lerCookie, "lerCookie");
async function emailDaSessao(request, env) {
  const sessao = lerCookie(request, "cf_sessao");
  if (!sessao) return null;
  return await env.USUARIOS_PREMIUM.get("sessao:" + sessao);
}
__name(emailDaSessao, "emailDaSessao");
function gerarCodigoFamilia() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}
__name(gerarCodigoFamilia, "gerarCodigoFamilia");
async function obterModelosDisponiveis(env, apiKey) {
  const CHAVE_CACHE = "gemini:modelos_disponiveis";
  const DOZE_HORAS_MS = 12 * 60 * 60 * 1e3;
  try {
    const cache = await env.USUARIOS_PREMIUM.get(CHAVE_CACHE, "json");
    if (cache && cache.modelos && cache.modelos.length && Date.now() - cache.quando < DOZE_HORAS_MS) {
      return cache.modelos;
    }
  } catch (e) {
  }
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const candidatos = (data.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => (m.name || "").replace("models/", "")).filter((nome) => /^gemini-[\d.]+-(flash|pro)$/.test(nome) || nome === "gemini-flash-latest" || nome === "gemini-pro-latest").sort((a, b) => {
        const versaoDe = /* @__PURE__ */ __name((n) => parseFloat((n.match(/[\d.]+/) || ["0"])[0]), "versaoDe");
        const diff = versaoDe(b) - versaoDe(a);
        if (diff !== 0) return diff;
        return a.includes("flash") ? -1 : 1;
      }).slice(0, 3);
      if (candidatos.length > 0) {
        try {
          await env.USUARIOS_PREMIUM.put(CHAVE_CACHE, JSON.stringify({ modelos: candidatos, quando: Date.now() }), {
            expirationTtl: 60 * 60 * 24
            // guarda até 24h, mas revalidamos a cada 12h
          });
        } catch (e) {
        }
        return candidatos;
      }
    }
  } catch (e) {
  }
  return ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-flash-latest", "gemini-pro-latest"];
}
__name(obterModelosDisponiveis, "obterModelosDisponiveis");
async function enviarEmailLinkMagico(env, email, link) {
  const apiKey = env.RESEND_API_KEY ? env.RESEND_API_KEY.trim() : "";
  if (!apiKey) {
    return { enviado: false, linkDebug: link };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.RESEND_FROM || "Cuidado em Fam\xEDlia <onboarding@resend.dev>",
        to: [email],
        subject: "Seu link de acesso \u2014 Cuidado em Fam\xEDlia",
        html: `<p>Toque no link abaixo para entrar no app <strong>Cuidado em Fam\xEDlia</strong>:</p>
               <p><a href="${link}">${link}</a></p>
               <p style="color:#888;font-size:12px;">Se voc\xEA n\xE3o pediu este link, pode ignorar este e-mail.</p>`
      })
    });
    if (!res.ok) {
      return { enviado: false, erro: await res.text() };
    }
    return { enviado: true };
  } catch (e) {
    return { enviado: false, erro: e.message };
  }
}
__name(enviarEmailLinkMagico, "enviarEmailLinkMagico");
async function verificarAssinaturaMercadoPago(request, url, segredo) {
  try {
    const xSignature = request.headers.get("x-signature") || "";
    const xRequestId = request.headers.get("x-request-id") || "";
    const dataId = (url.searchParams.get("data.id") || url.searchParams.get("id") || "").toLowerCase();
    const partes = {};
    xSignature.split(",").forEach((p) => {
      const [k, v] = p.split("=");
      if (k && v) partes[k.trim()] = v.trim();
    });
    const ts = partes.ts;
    const v1 = partes.v1;
    if (!ts || !v1) return false;
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const chave = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(segredo),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const assinaturaCalculada = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(manifest));
    const hex = Array.from(new Uint8Array(assinaturaCalculada)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return hex === v1;
  } catch (e) {
    return false;
  }
}
__name(verificarAssinaturaMercadoPago, "verificarAssinaturaMercadoPago");
async function registrarEvento(env, tipo) {
  try {
    await env.DB.prepare("INSERT INTO eventos_acesso (tipo, quando) VALUES (?, ?)").bind(tipo, (/* @__PURE__ */ new Date()).toISOString()).run();
  } catch (e) {
  }
}
__name(registrarEvento, "registrarEvento");
const PLANILHA_ACESSOS_ID = "1lXCRF5u5SUt5y8CC0tbRedYj43okorCW-RCDs1IK4Uo";
function base64url(bufferOuTexto) {
  let str;
  if (typeof bufferOuTexto === "string") {
    str = btoa(bufferOuTexto);
  } else {
    str = btoa(String.fromCharCode(...new Uint8Array(bufferOuTexto)));
  }
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64url, "base64url");
async function obterTokenGoogleSheets(env) {
  const CHAVE_CACHE = "google_sheets_token";
  try {
    const cache = await env.USUARIOS_PREMIUM.get(CHAVE_CACHE, "json");
    if (cache && cache.token && Date.now() < cache.expiraEm) return cache.token;
  } catch (e) {
  }
  const clientEmail = env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKeyPem = env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!clientEmail || !privateKeyPem) return null;
  try {
    const agora = Math.floor(Date.now() / 1e3);
    const header = { alg: "RS256", typ: "JWT" };
    const claim = {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: agora,
      exp: agora + 3600
    };
    const naoAssinado = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(claim));
    const pemCorpo = privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
    const derBinario = Uint8Array.from(atob(pemCorpo), (c) => c.charCodeAt(0));
    const chaveCripto = await crypto.subtle.importKey(
      "pkcs8",
      derBinario.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const assinatura = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      chaveCripto,
      new TextEncoder().encode(naoAssinado)
    );
    const jwt = naoAssinado + "." + base64url(assinatura);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + jwt
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    try {
      await env.USUARIOS_PREMIUM.put(CHAVE_CACHE, JSON.stringify({ token: data.access_token, expiraEm: Date.now() + 3300 * 1e3 }), { expirationTtl: 3300 });
    } catch (e) {
    }
    return data.access_token;
  } catch (e) {
    return null;
  }
}
__name(obterTokenGoogleSheets, "obterTokenGoogleSheets");
// Registra uma linha na Planilha Google em tempo real, a cada acesso —
// silencioso: se a credencial não estiver configurada ou o Google falhar por
// qualquer motivo, nunca deixa isso quebrar a experiência do app.
async function registrarNaPlanilha(env, tipo, nome, email) {
  try {
    const token = await obterTokenGoogleSheets(env);
    if (!token) return;
    const dataHora = (/* @__PURE__ */ new Date()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const linha = [dataHora, tipo, nome || "", email || ""];
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${PLANILHA_ACESSOS_ID}/values/A:D:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [linha] })
      }
    );
  } catch (e) {
  }
}
__name(registrarNaPlanilha, "registrarNaPlanilha");
function medicamentosTemItensServidor(m) {
  if (!m || typeof m !== "object" || Array.isArray(m)) return false;
  // Qualquer horário conta. Olhar só manha/almoco/noite fazia uma família com
  // remédios apenas em jejum, ao deitar ou SOS parecer vazia — e a proteção
  // abaixo, que existe justamente para não apagar remédio real, virava do
  // avesso. Percorrer todas as chaves cobre também as que vierem depois.
  return Object.keys(m).some((k) => Array.isArray(m[k]) && m[k].length > 0);
}
__name(medicamentosTemItensServidor, "medicamentosTemItensServidor");
// Última linha de defesa contra perda de dados: o cliente (celular) É QUEM
// DEVERIA mandar sempre dados corretos, mas já vimos bugs (e podem surgir
// outros) que fazem um aparelho enviar um estado incompleto/vazio por engano
// — e como o servidor até aqui aceitava e SOBRESCREVIA cegamente, isso já
// apagou remédios reais de verdade. Esta função recusa a substituir um campo
// que já tem conteúdo real por um valor vazio vindo do cliente.
function mesclarDadosFamiliaComSeguranca(atual, recebido) {
  const resultado = { ...atual, ...recebido };
  if (recebido.medicamentos !== void 0 && !medicamentosTemItensServidor(recebido.medicamentos) && medicamentosTemItensServidor(atual.medicamentos)) {
    resultado.medicamentos = atual.medicamentos;
  }
  const camposArray = ["medicamentosEncerrados", "fotosReceitas", "examesSalvos", "vacinasSalvas", "chatMensagens", "historicoDoses", "profissionaisMultidisciplinares", "sinaisVitaisHistorico", "turnosAtivos"];
  // Lista que o aparelho manda dizendo quais campos a pessoa esvaziou DE
  // PROPÓSITO (ex.: apagou o último remédio suspenso do histórico). Sem isto,
  // a proteção abaixo desfaria a exclusão que a família pediu, e o item
  // reapareceria sozinho na próxima sincronização.
  const esvaziadosDeProposito = Array.isArray(recebido.esvaziadosDeProposito) ? recebido.esvaziadosDeProposito : [];
  for (const campo of camposArray) {
    if (esvaziadosDeProposito.indexOf(campo) !== -1) continue;
    const novo = recebido[campo];
    const antigo = atual[campo];
    if (novo !== void 0 && Array.isArray(novo) && novo.length === 0 && Array.isArray(antigo) && antigo.length > 0) {
      resultado[campo] = antigo;
    }
  }
  return resultado;
}
__name(mesclarDadosFamiliaComSeguranca, "mesclarDadosFamiliaComSeguranca");
const PAGINA_PRIVACIDADE = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pol\xEDtica de Privacidade — Cuidado em Fam\xEDlia</title>
<style>
  body { font-family: -apple-system, 'DM Sans', sans-serif; background:#F8FAF9; color:#3A4B48; line-height:1.6; margin:0; padding:0; }
  .wrap { max-width:680px; margin:0 auto; padding:32px 20px 60px; }
  h1 { font-family: 'Cormorant Garamond', serif; color:#005F6B; font-size:28px; margin-bottom:4px; }
  .atualizado { color:#6A7B78; font-size:13px; margin-bottom:28px; }
  h2 { color:#005F6B; font-size:18px; margin-top:28px; margin-bottom:8px; }
  p, li { font-size:14px; }
  ul { padding-left:20px; }
  a { color:#0A8F9D; }
  .voltar { display:inline-block; margin-top:32px; padding:10px 18px; background:#0A8F9D; color:#FFF; text-decoration:none; border-radius:8px; font-weight:700; font-size:14px; }
</style></head>
<body>
  <div class="wrap">
    <h1>Pol\xEDtica de Privacidade</h1>
    <div class="atualizado">Cuidado em Fam\xEDlia — \xFAltima atualiza\xE7\xE3o: setembro de 2026</div>

    <p>Esta pol\xEDtica explica, de forma simples, quais dados o <strong>Cuidado em Fam\xEDlia</strong> coleta, para que servem, e quais s\xE3o os seus direitos. O app \xE9 uma iniciativa com pesquisa e estrutura desenvolvidas por Intelig\xEAncia Artificial sob a curadoria direta de <strong>Vladimir Hersen</strong>.</p>

    <h2>1. Quais dados coletamos</h2>
    <ul>
      <li><strong>Dados de cadastro:</strong> nome da pessoa cuidada, nome de quem cuida, e seu e-mail (para login).</li>
      <li><strong>Dados de sa\xFAde:</strong> remédios e hor\xE1rios, fotos de receitas m\xE9dicas, exames, carteira de vacina\xE7\xE3o, sinais vitais (press\xE3o, glicose, oxigena\xE7\xE3o), tipo sangu\xEDneo e alergias.</li>
      <li><strong>Mensagens da equipe:</strong> o que \xE9 escrito no chat de cuidado entre os membros da fam\xEDlia.</li>
      <li><strong>Espa\xE7o de Apoio Emocional:</strong> o que voc\xEA escreve ali \xE9 enviado \xE0 IA do Google apenas para gerar uma resposta na hora — <strong>n\xE3o \xE9 salvo em nenhum banco de dados</strong>, nem nosso nem do Google, e desaparece da tela sozinho.</li>
      <li><strong>Dados de pagamento:</strong> se voc\xEA assina o Premium, o pagamento \xE9 processado inteiramente pelo Mercado Pago — n\xF3s nunca vemos nem armazenamos n\xFAmero de cart\xE3o.</li>
      <li><strong>Estat\xEDsticas de uso:</strong> data de acesso e, quando voc\xEA est\xE1 logado, seu nome e e-mail, para sabermos quantas pessoas usam o app.</li>
    </ul>

    <h2>2. Para que usamos esses dados</h2>
    <p>Exclusivamente para fazer o app funcionar: organizar os remédios e a rotina de cuidado, compartilhar essas informa\xE7\xF5es com os membros da fam\xEDlia que voc\xEA mesmo convidar, ler receitas m\xE9dicas por foto usando Intelig\xEAncia Artificial, enviar seu link de acesso por e-mail, e processar sua assinatura Premium.</p>

    <h2>3. Com quem compartilhamos</h2>
    <ul>
      <li><strong>Sua fam\xEDlia:</strong> apenas as pessoas que voc\xEA convidar com o c\xF3digo da fam\xEDlia veem os dados de sa\xFAde cadastrados.</li>
      <li><strong>Google (Gemini):</strong> recebe a foto da receita (ou o texto do Apoio Emocional) só para gerar a resposta, na hora da an\xE1lise.</li>
      <li><strong>Resend:</strong> envia o e-mail com seu link de acesso.</li>
      <li><strong>Mercado Pago:</strong> processa pagamentos da assinatura Premium.</li>
    </ul>
    <p><strong>N\xF3s nunca vendemos ou alugamos seus dados para terceiros.</strong></p>

    <h2>4. Onde os dados ficam guardados</h2>
    <p>Em servidores da Cloudflare (infraestrutura usada pelo app), com prote\xE7\xF5es de acesso e conex\xE3o segura (HTTPS) em todas as comunica\xE7\xF5es.</p>

    <h2>5. Seus direitos (Lei Geral de Prote\xE7\xE3o de Dados — LGPD)</h2>
    <p>Voc\xEA pode, a qualquer momento:</p>
    <ul>
      <li><strong>Apagar tudo do seu aparelho:</strong> bot\xE3o "Zerar" dentro do app.</li>
      <li><strong>Pedir a exclus\xE3o dos seus dados do servidor</strong> (fam\xEDlia compartilhada, cadastro), ou tirar d\xFAvidas sobre seus dados: escreva para <a href="mailto:vladihersen@gmail.com">vladihersen@gmail.com</a>.</li>
    </ul>

    <h2>6. Crian\xE7as e adolescentes</h2>
    <p>O Cuidado em Fam\xEDlia \xE9 destinado a adultos respons\xE1veis pelo cuidado de familiares. N\xE3o coletamos intencionalmente dados de crian\xE7as.</p>

    <h2>7. Altera\xE7\xF5es nesta pol\xEDtica</h2>
    <p>Podemos atualizar este texto conforme o app evolui. A data no topo desta p\xE1gina sempre mostra a \xFAltima atualiza\xE7\xE3o.</p>

    <h2>8. Contato</h2>
    <p>D\xFAvidas, pedidos de exclus\xE3o de dados, ou qualquer outra quest\xE3o sobre privacidade: <a href="mailto:vladihersen@gmail.com">vladihersen@gmail.com</a></p>

    <a class="voltar" href="/">← Voltar ao app</a>
  </div>
</body></html>`;
var worker_default = {
  async fetch(request, env, ctx) {
    if (ctx && ctx.waitUntil) { ctx.waitUntil(garantirTabelasD1(env)); }

    const url = new URL(request.url);
    if (url.pathname === "/api/auth/pedir-link" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const email = (body.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        return new Response(JSON.stringify({ sucesso: false, erro: "E-mail inv\xE1lido." }), {
          status: 400,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
      const token = gerarToken();
      await env.USUARIOS_PREMIUM.put("login:" + token, email, { expirationTtl: 900 });
      const link = `${url.origin}/entrar?token=${token}`;
      const resultado = await enviarEmailLinkMagico(env, email, link);
      return new Response(JSON.stringify({ sucesso: true, ...resultado }), {
        headers: { "Content-Type": "application/json;charset=UTF-8" }
      });
    }
    if (url.pathname === "/entrar") {
      const token = url.searchParams.get("token") || "";
      const email = token ? await env.USUARIOS_PREMIUM.get("login:" + token) : null;
      if (!email) {
        return new Response("Link inv\xE1lido ou expirado. Volte ao app e pe\xE7a um novo link.", {
          status: 400,
          headers: { "Content-Type": "text/plain;charset=UTF-8" }
        });
      }
      // NÃO consumimos o token aqui ainda. O Mail/iOS (e outros apps de
      // e-mail) buscam o link sozinhos, em segundo plano, só para gerar a
      // prévia bonita do link — isso é um GET de verdade no servidor, e se
      // já entrássemos com a sessão aqui, o token seria "gasto" pela prévia
      // antes da pessoa sequer tocar, e o link pareceria inválido depois.
      // Por isso mostramos uma página simples pedindo um toque humano, e só
      // consumimos o token de verdade em "/entrar/confirmar".
      return new Response(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Entrar — Cuidado em Fam\xEDlia</title>
<style>
  body { font-family: -apple-system, sans-serif; background:#F8FAF9; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:20px; }
  .box { background:#FFF; border-radius:16px; padding:32px 24px; text-align:center; max-width:360px; box-shadow:0 4px 20px rgba(0,0,0,0.08); }
  h1 { font-size:20px; color:#005F6B; margin-bottom:10px; }
  p { font-size:14px; color:#3A4B48; margin-bottom:24px; line-height:1.5; }
  a.btn { display:block; background:#0A8F9D; color:#FFF; text-decoration:none; padding:14px; border-radius:10px; font-weight:700; font-size:15px; }
</style></head>
<body>
  <div class="box">
    <h1>Cuidado em Fam\xEDlia ✦</h1>
    <p>Toque no bot\xE3o abaixo para entrar no app com seguran\xE7a.</p>
    <a class="btn" href="/entrar/confirmar?token=${encodeURIComponent(token)}">Entrar no App</a>
  </div>
</body></html>`, {
        headers: { "Content-Type": "text/html;charset=UTF-8", "cache-control": "no-store" }
      });
    }
    if (url.pathname === "/entrar/confirmar") {
      const token = url.searchParams.get("token") || "";
      const email = token ? await env.USUARIOS_PREMIUM.get("login:" + token) : null;
      if (!email) {
        return new Response("Link inv\xE1lido ou expirado. Volte ao app e pe\xE7a um novo link.", {
          status: 400,
          headers: { "Content-Type": "text/plain;charset=UTF-8" }
        });
      }
      await env.USUARIOS_PREMIUM.delete("login:" + token);
      const sessao = gerarToken();
      await env.USUARIOS_PREMIUM.put("sessao:" + sessao, email, { expirationTtl: 60 * 60 * 24 * 90 });
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/",
          "Set-Cookie": `cf_sessao=${sessao}; Path=/; Max-Age=7776000; HttpOnly; Secure; SameSite=Lax`
        }
      });
    }
    if (url.pathname === "/api/auth/eu") {
      const sessao = lerCookie(request, "cf_sessao");
      const email = sessao ? await env.USUARIOS_PREMIUM.get("sessao:" + sessao) : null;
      if (!email) {
        return new Response(JSON.stringify({ logado: false }), {
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
      const registro = await env.USUARIOS_PREMIUM.get("usuario:" + email, "json");
      const { premiumAtivo, trialAte, trialExpirado } = calcularStatusPremium(registro);
      return new Response(JSON.stringify({
        logado: true,
        email,
        premium: premiumAtivo,
        trialAte,
        trialExpirado,
        jaUsouTeste: !!(registro && registro.origem === "trial")
      }), {
        headers: { "Content-Type": "application/json;charset=UTF-8" }
      });
    }
    if (url.pathname === "/api/auth/ativar-teste" && request.method === "POST") {
      const sessao = lerCookie(request, "cf_sessao");
      const email = sessao ? await env.USUARIOS_PREMIUM.get("sessao:" + sessao) : null;
      if (!email) {
        return new Response(JSON.stringify({ sucesso: false, erro: "Fa\xE7a login primeiro." }), {
          status: 401,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
      const registroAtual = await env.USUARIOS_PREMIUM.get("usuario:" + email, "json");
      if (registroAtual && registroAtual.origem === "trial") {
        return new Response(JSON.stringify({ sucesso: false, erro: "Este e-mail j\xE1 usou o teste gr\xE1tis." }), {
          status: 400,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
      if (registroAtual && registroAtual.premium && registroAtual.origem !== "trial") {
        return new Response(JSON.stringify({ sucesso: false, erro: "Este e-mail j\xE1 \xE9 assinante Premium." }), {
          status: 400,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
      const DIAS_TESTE = 30;
      const trialAte = new Date(Date.now() + DIAS_TESTE * 24 * 60 * 60 * 1e3).toISOString();
      await env.USUARIOS_PREMIUM.put("usuario:" + email, JSON.stringify({
        premium: true,
        trialAte,
        atualizadoEm: (/* @__PURE__ */ new Date()).toISOString(),
        origem: "trial"
      }));
      return new Response(JSON.stringify({ sucesso: true, trialAte }), {
        headers: { "Content-Type": "application/json;charset=UTF-8" }
      });
    }
    if (url.pathname === "/api/auth/sair" && request.method === "POST") {
      const sessao = lerCookie(request, "cf_sessao");
      if (sessao) await env.USUARIOS_PREMIUM.delete("sessao:" + sessao);
      return new Response(JSON.stringify({ sucesso: true }), {
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "Set-Cookie": "cf_sessao=; Path=/; Max-Age=0"
        }
      });
    }
    if (url.pathname === "/api/familia/estado") {
      // Busca por código da família primeiro. Este é o caminho que o app usa
      // (carregarEstadoFamilia manda ?codigo=), e antes ele caía na busca por
      // sessão abaixo, que responde num formato diferente — sem "sucesso" —,
      // então o app descartava a resposta em silêncio e nunca carregava os
      // dados compartilhados.
      const codigoConsulta = (url.searchParams.get("codigo") || "").trim().toLowerCase();
      if (codigoConsulta) {
        let dadosConsulta = null;
        try {
          const row = await env.DB.prepare("SELECT dados FROM familias WHERE LOWER(id) = ?").bind(codigoConsulta).first();
          if (row && row.dados) dadosConsulta = JSON.parse(row.dados);
        } catch (e) {}
        if (!dadosConsulta) {
          try {
            dadosConsulta = await env.USUARIOS_PREMIUM.get("familia:" + codigoConsulta, "json");
          } catch (e) {}
        }
        if (dadosConsulta) {
          return new Response(JSON.stringify({ sucesso: true, temFamilia: true, familiaId: codigoConsulta, dados: dadosConsulta }), {
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        }
        return new Response(JSON.stringify({ sucesso: false }), {
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }

      const email = await emailDaSessao(request, env);
      if (!email) {
        return new Response(JSON.stringify({ logado: false }), {
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
      const membro = await env.DB.prepare("SELECT familia_id, papel FROM membros WHERE email = ?").bind(email).first();
      if (!membro) {
        return new Response(JSON.stringify({ logado: true, temFamilia: false }), {
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
      const familia = await env.DB.prepare("SELECT dados FROM familias WHERE id = ?").bind(membro.familia_id).first();
      let dados = {};
      try {
        dados = JSON.parse(familia && familia.dados || "{}");
      } catch (e) {
        dados = {};
      }
      return new Response(JSON.stringify({
        logado: true,
        temFamilia: true,
        familiaId: membro.familia_id,
        papel: membro.papel,
        dados
      }), { headers: { "Content-Type": "application/json;charset=UTF-8" } });
    }
    if (url.pathname === "/api/familia/criar" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const codigo = (body.codigo || "").trim().toLowerCase() || gerarCodigoFamilia();
      const agora = (new Date()).toISOString();

      // "Criar" com um código que já existe atualiza o registro (ON CONFLICT
      // DO UPDATE mais abaixo), então aqui vale a mesma mescla protegida.
      let atualCriar = {};
      try {
        const row = await env.DB.prepare("SELECT dados FROM familias WHERE LOWER(id) = ?").bind(codigo).first();
        if (row && row.dados) atualCriar = JSON.parse(row.dados) || {};
      } catch (e) {}
      const dadosJson = JSON.stringify(mesclarDadosFamiliaComSeguranca(atualCriar, body.dados || {}));

      try {
        await env.DB.prepare(`
          INSERT INTO familias (id, dados, criado_em, atualizado_em) 
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em
        `).bind(codigo, dadosJson, agora, agora).run();
      } catch (e) {
        console.error("D1 erro criar:", e);
      }
      try {
        await env.USUARIOS_PREMIUM.put("familia:" + codigo, dadosJson);
      } catch (e) {}

      return new Response(JSON.stringify({ sucesso: true, familiaId: codigo, papel: "administrador" }), {
        headers: { "Content-Type": "application/json;charset=UTF-8" }
      });
    }

    if (url.pathname === "/api/familia/entrar" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const codigo = (body.codigo || "").trim().toLowerCase();
      if (!codigo) {
        return new Response(JSON.stringify({ sucesso: false, erro: "Digite o código da família." }), {
          status: 400,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }

      let dados = null;
      try {
        const row = await env.DB.prepare("SELECT dados FROM familias WHERE LOWER(id) = ?").bind(codigo).first();
        if (row && row.dados) dados = JSON.parse(row.dados);
      } catch (e) {
        console.error("D1 erro entrar:", e);
      }

      if (!dados) {
        try {
          const kvData = await env.USUARIOS_PREMIUM.get("familia:" + codigo, "json");
          if (kvData) dados = kvData;
        } catch (e) {}
      }

      if (!dados) {
        return new Response(JSON.stringify({ sucesso: false, erro: "Código não encontrado. Certifique-se de que o responsável já abriu o app e salvou os remédios." }), {
          status: 404,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }

      return new Response(JSON.stringify({ sucesso: true, familiaId: codigo, papel: "acompanhante", dados }), {
        headers: { "Content-Type": "application/json;charset=UTF-8" }
      });
    }

    if (url.pathname === "/api/familia/salvar" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const codigo = (body.codigo || body.familiaId || "").trim().toLowerCase();
      if (!codigo) {
        return new Response(JSON.stringify({ sucesso: false, erro: "Código da família não informado." }), {
          status: 400,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }

      const recebido = body.dados || {};
      const agora = (new Date()).toISOString();

      // Lê o que já está gravado e MESCLA, em vez de sobrescrever. Sem isto,
      // um aparelho que abrisse o app com o estado ainda incompleto (ou que
      // tivesse um erro de leitura) gravava esse estado por cima do registro
      // bom da família, apagando remédios e receitas de todo mundo.
      let atual = {};
      try {
        const row = await env.DB.prepare("SELECT dados FROM familias WHERE LOWER(id) = ?").bind(codigo).first();
        if (row && row.dados) atual = JSON.parse(row.dados) || {};
      } catch (e) {}
      if (!atual || Object.keys(atual).length === 0) {
        try {
          const kv = await env.USUARIOS_PREMIUM.get("familia:" + codigo, "json");
          if (kv) atual = kv;
        } catch (e) {}
      }
      const dados = mesclarDadosFamiliaComSeguranca(atual, recebido);
      const dadosJson = JSON.stringify(dados);

      try {
        await env.DB.prepare(`
          INSERT INTO familias (id, dados, criado_em, atualizado_em) 
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em
        `).bind(codigo, dadosJson, agora, agora).run();
      } catch (e) {
        console.error("D1 erro salvar:", e);
      }

      try {
        await env.USUARIOS_PREMIUM.put("familia:" + codigo, dadosJson);
      } catch (e) {}

      return new Response(JSON.stringify({ sucesso: true, atualizadoEm: agora }), {
        headers: { "Content-Type": "application/json;charset=UTF-8" }
      });
    }

    if (url.pathname === "/api/webhook/kiwify" && request.method === "POST") {
      const tokenEsperado = env.KIWIFY_WEBHOOK_TOKEN ? env.KIWIFY_WEBHOOK_TOKEN.trim() : "";
      const tokenRecebido = url.searchParams.get("token") || "";
      if (tokenEsperado && tokenRecebido !== tokenEsperado) {
        return new Response("N\xE3o autorizado", { status: 401 });
      }
      const body = await request.json().catch(() => ({}));
      const email = (body?.Customer?.email || body?.customer?.email || body?.buyer?.email || body?.email || "").trim().toLowerCase();
      const status = (body?.webhook_event_type || body?.order_status || body?.status || "").toLowerCase();
      const statusAtivam = ["order_approved", "approved", "paid", "subscription_renewed", "active"];
      const statusDesativam = ["order_refunded", "refunded", "chargeback", "subscription_canceled", "subscription_cancelled", "canceled", "cancelled", "expired"];
      if (!email) {
        return new Response(JSON.stringify({ sucesso: false, erro: "Payload sem e-mail reconhec\xEDvel.", payloadRecebido: body }), {
          status: 400,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
      let premium = null;
      if (statusAtivam.includes(status)) premium = true;
      if (statusDesativam.includes(status)) premium = false;
      if (premium === null) {
        return new Response(JSON.stringify({ sucesso: false, erro: "Status n\xE3o reconhecido: " + status, payloadRecebido: body }), {
          status: 200,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
      await env.USUARIOS_PREMIUM.put("usuario:" + email, JSON.stringify({
        premium,
        atualizadoEm: (/* @__PURE__ */ new Date()).toISOString(),
        origem: "kiwify"
      }));
      return new Response(JSON.stringify({ sucesso: true, email, premium }), {
        headers: { "Content-Type": "application/json;charset=UTF-8" }
      });
    }
    if (url.pathname === "/api/premium/assinar" && request.method === "POST") {
      const email = await emailDaSessao(request, env);
      if (!email) {
        return new Response(JSON.stringify({ sucesso: false, erro: "Fa\xE7a login primeiro." }), {
          status: 401,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
      const tokenMP = env.MERCADOPAGO_ACCESS_TOKEN ? env.MERCADOPAGO_ACCESS_TOKEN.trim() : "";
      if (!tokenMP) {
        return new Response(JSON.stringify({ sucesso: false, erro: "Pagamentos ainda n\xE3o configurados." }), {
          status: 500,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
      try {
        const resMP = await fetch("https://api.mercadopago.com/preapproval", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + tokenMP
          },
          body: JSON.stringify({
            reason: "Cuidado em Fam\xEDlia — Premium",
            auto_recurring: {
              frequency: 1,
              frequency_type: "months",
              transaction_amount: 29.9,
              currency_id: "BRL"
            },
            payer_email: email,
            back_url: url.origin + "/",
            status: "pending"
          })
        });
        const dataMP = await resMP.json();
        if (!resMP.ok || !dataMP.init_point) {
          return new Response(JSON.stringify({ sucesso: false, erro: "N\xE3o foi poss\xEDvel iniciar a assinatura.", detalheMP: dataMP }), {
            status: 500,
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        }
        return new Response(JSON.stringify({ sucesso: true, initPoint: dataMP.init_point }), {
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ sucesso: false, erro: "Erro: " + err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
    }
    if (url.pathname === "/api/webhook/mercadopago" && request.method === "POST") {
      const tokenMP = env.MERCADOPAGO_ACCESS_TOKEN ? env.MERCADOPAGO_ACCESS_TOKEN.trim() : "";
      const segredoWebhook = env.MERCADOPAGO_WEBHOOK_SECRET ? env.MERCADOPAGO_WEBHOOK_SECRET.trim() : "";
      if (segredoWebhook) {
        const assinaturaOk = await verificarAssinaturaMercadoPago(request, url, segredoWebhook);
        if (!assinaturaOk) {
          return new Response(JSON.stringify({ sucesso: false, erro: "Assinatura inv\xE1lida." }), {
            status: 401,
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        }
      }
      try {
        const body = await request.json().catch(() => ({}));
        const tipo = body.type || body.topic || url.searchParams.get("type") || url.searchParams.get("topic") || "";
        const id = body.data?.id || url.searchParams.get("id") || url.searchParams.get("data.id");
        if (tipo !== "preapproval" || !id || !tokenMP) {
          return new Response(JSON.stringify({ sucesso: true, ignorado: true }), {
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        }
        const resDetalhe = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
          headers: { "Authorization": "Bearer " + tokenMP }
        });
        const detalhe = await resDetalhe.json();
        const emailPagador = (detalhe.payer_email || "").trim().toLowerCase();
        const status = detalhe.status || "";
        if (!emailPagador) {
          return new Response(JSON.stringify({ sucesso: true, semEmail: true }), {
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        }
        let premium = null;
        if (status === "authorized") premium = true;
        if (status === "cancelled" || status === "paused") premium = false;
        if (premium !== null) {
          await env.USUARIOS_PREMIUM.put("usuario:" + emailPagador, JSON.stringify({
            premium,
            atualizadoEm: (/* @__PURE__ */ new Date()).toISOString(),
            origem: "mercadopago",
            preapprovalId: id
          }));
        }
        return new Response(JSON.stringify({ sucesso: true, email: emailPagador, status, premium }), {
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ sucesso: false, erro: "Erro: " + err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
    }
    if (url.pathname === "/api/analisar-receita" && request.method === "POST") {
      try {
        const apiKey = env.GEMINI_API_KEY ? env.GEMINI_API_KEY.trim() : "";
        if (!apiKey) {
          return new Response(JSON.stringify({
            sucesso: false,
            erro: "Chave GEMINI_API_KEY n\xE3o encontrada nas vari\xE1veis do Cloudflare."
          }), {
            headers: { "Content-Type": "application/json;charset=UTF-8" },
            status: 500
          });
        }
        const body = await request.json();
        const imagesList = body.images || (body.image ? [body.image] : []);
        if (imagesList.length === 0) {
          return new Response(JSON.stringify({ sucesso: false, erro: "Nenhuma imagem enviada." }), {
            headers: { "Content-Type": "application/json;charset=UTF-8" },
            status: 400
          });
        }
        const prompt = `Voc\xEA \xE9 um assistente farmac\xEAutico e m\xE9dico altamente rigoroso analisando receitas m\xE9dicas brasileiras reais.
Analise a(s) imagem(ns) com m\xE1xima precis\xE3o e fidelidade.

REGRA ABSOLUTA DE SEGURAN\xC7A (A MAIS IMPORTANTE DE TODAS):
- NUNCA invente, complete ou "adivinhe" nomes de rem\xE9dios que n\xE3o estejam CLARA e LITERALMENTE escritos na imagem.
- Se a imagem estiver em branco, ileg\xEDvel, borrada, cortada, ou n\xE3o for uma receita m\xE9dica de verdade, voc\xEA DEVE retornar exatamente {"sucesso": false, "medicamentos": [], "observacoes": "N\xE3o foi poss\xEDvel ler nenhum medicamento com seguran\xE7a nesta imagem."} e nada mais.
- Os nomes de rem\xE9dios usados como EXEMPLO de formata\xE7\xE3o mais abaixo (ex.: "Amoxicilina 500mg") s\xE3o apenas ilustra\xE7\xF5es de como formatar a resposta \u2014 NUNCA copie, repita ou reutilize esses nomes de exemplo no resultado real. Use-os somente como refer\xEAncia de formato, nunca como conte\xFAdo.
- Em caso de d\xFAvida sobre um nome, dosagem ou turno, \xE9 prefer\xEDvel omitir aquele item (ou retornar sucesso:false) a arriscar inventar informa\xE7\xE3o m\xE9dica incorreta.

REGRA CR\xCDTICA DE DIVIS\xC3O DE DOSES POR TURNO (a mais frequentemente esquecida — preste aten\xE7\xE3o extra):
1. Se um medicamento for prescrito para tomar '2 vezes ao dia', 'no caf\xE9 da manh\xE3 e no jantar', 'de 12 em 12 horas', '12/12h', ou 'a cada 12 horas', voc\xEA DEVE desmembrar em DUAS entradas SEPARADAS no array JSON — uma para 'manha' e outra para 'noite', cada uma com a mesma quantidade da receita. Exemplo real muito comum: 'Glifage XR 500mg — 1 comprimido de 12/12h' deve gerar DUAS entradas (Glifage XR 500mg \xE0s manha E Glifage XR 500mg \xE0 noite), NUNCA s\xF3 uma.
   - NUNCA junte doses de turnos diferentes em uma s\xF3 (ex: NUNCA coloque a soma do dia inteiro na manh\xE3).
   - NUNCA gere s\xF3 a entrada da manh\xE3 e esque\xE7a a da noite (ou vice-versa) quando a instru\xE7\xE3o for de 2x ao dia.
2. REGRA DE CLASSIFICAÇÃO CIRÚRGICA DE HORÁRIOS E TURNOS:
   Você deve atribuir o campo "turno" exatamente ao período clínico correto, escolhendo ESTRITAMENTE uma destas chaves:
   - "jejum": quando a receita disser "em jejum", "ao acordar", "30 minutos antes do café", etc.
   - "manha": quando a receita disser "pela manhã", "no café da manhã", "após o café", etc.
   - "antes_almoco": quando disser "antes do almoço", "15 a 30 min antes da refeição do meio-dia", etc.
   - "almoco": quando disser "no almoço", "com o almoço", "após o almoço", "ao meio-dia", etc.
   - "tarde": quando disser "à tarde", "no lanche", "às 16h", etc.
   - "antes_jantar": quando disser "antes do jantar", "30 min antes da refeição da noite", etc.
   - "noite": quando disser "à noite", "no jantar", "com o jantar", "após o jantar", etc.
   - "deitar": quando disser "ao deitar", "antes de dormir", "à noite ao deitar", etc.
   - "madrugada": quando a posologia for de 6/6h ou 4/4h com dose na madrugada (ex.: 00h, 04h, 06h).
   - "extra_sos": quando disser "se dor", "se febre", "se necessário", "sob demanda", "SOS", etc.
5. ANTES DE FINALIZAR a resposta, revise cada medicamento da lista um por um: se a instru\xE7\xE3o dele mencionar 2 hor\xE1rios (2x ao dia, 12/12h, manh\xE3 e noite, etc.) e voc\xEA s\xF3 gerou 1 entrada para ele, isso \xE9 um ERRO — volte e adicione a entrada que falta antes de responder.


REGRA OBRIGATÓRIA PARA REMÉDIOS "SE NECESSÁRIO" / SOS (Atenção especial):
- Se o medicamento tiver posologia condicional como "se necessário", "se dor", "se febre", "em caso de náusea/crise", "SOS", "sob demanda", ou similar, você DEVE:
  1. Preencher "tipo": "se_necessario" (nunca "continuo").
  2. No campo "sub", deixar explícito: "Tomar apenas se necessário (se dor/sintoma)".
  3. No campo "turno", se a receita indicar um período específico (ex.: "à noite se dor"), use esse turno; se for para tomar a qualquer hora do dia sob demanda, use "extra_sos".

REGRA DE DURA\xC7\xC3O DE TRATAMENTO TEMPOR\xC1RIO (ex.: antibi\xF3ticos de outro m\xE9dico, uso pontual):
- Se o medicamento for de uso tempor\xE1rio e a receita disser explicitamente por quantos dias usar (ex.: "por 7 dias", "uso por 10 dias", "durante 5 dias"), preencha "duracaoDias" com esse n\xFAmero.
- Se for cont\xEDnuo, ou se a receita N\xC3O disser claramente a dura\xE7\xE3o, preencha "duracaoDias" como null. NUNCA estime ou invente um n\xFAmero de dias que n\xE3o esteja escrito na receita.

Retorne ESTRITAMENTE um objeto JSON v\xE1lido (sem markdown ou texto fora do json) com o formato (os valores abaixo s\xE3o s\xF3 EXEMPLO DE FORMATO, nunca copie esses nomes):
{
  "sucesso": true,
  "medicamentos": [
    {
      "nome": "Nome do rem\xE9dio e dosagem exatamente como est\xE1 escrito na foto (ex.: formato 'Amoxicilina 500mg')",
      "sub": "Instru\xE7\xE3o exata de uso daquele turno, como est\xE1 na receita",
      "qtd": "Quantidade da dose daquele turno (ex: 1 comprimido, 2 comprimidos, 0.5 comprimido)",
      "turno": "jejum" | "manha" | "antes_almoco" | "almoco" | "tarde" | "antes_jantar" | "noite" | "deitar" | "madrugada" | "extra_sos",
      "tipo": "continuo" | "temporario" | "se_necessario",
      "duracaoDias": null
    }
  ],
  "observacoes": "Observa\xE7\xF5es gerais das p\xE1ginas lidas"
}`;
        const parts = [{ text: prompt }];
        for (const rawBase64 of imagesList) {
          let mimeType = "image/jpeg";
          let base64Data = rawBase64;
          if (rawBase64.includes(";base64,")) {
            const p = rawBase64.split(";base64,");
            mimeType = p[0].replace("data:", "") || "image/jpeg";
            base64Data = p[1];
          }
          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          });
        }
        const geminiPayload = {
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: "application/json"
          }
        };
        const modelos = await obterModelosDisponiveis(env, apiKey);
        let respostaApi = null;
        let ultimoErro = "";
        let ultimoStatus = 0;
        for (const mod of modelos) {
          const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${apiKey}`;
          const controladorModelo = new AbortController();
          const tempoLimiteModelo = setTimeout(() => controladorModelo.abort(), 15e3);
          try {
            const res = await fetch(targetUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
              },
              body: JSON.stringify(geminiPayload),
              signal: controladorModelo.signal
            });
            if (res.ok) {
              respostaApi = res;
              break;
            }
            ultimoStatus = res.status;
            ultimoErro = await res.text();
          } catch (e) {
            ultimoErro = e.name === "AbortError" ? "Modelo demorou mais de 15s para responder" : e.message;
            ultimoStatus = 0;
          } finally {
            clearTimeout(tempoLimiteModelo);
          }
        }
        if (!respostaApi) {
          // 429 com "quota" no corpo é o LIMITE DE USO DA CHAVE (diário/por
          // minuto) — muito diferente de uma instabilidade passageira do
          // Google. Tentar de novo não resolve nada nesse caso (o limite só
          // libera depois de um tempo), então avisamos a verdade em vez de
          // sugerir "tente novamente" — isso já confundiu a família achando
          // que era problema de internet quando na real o sinal estava ótimo.
          const cotaEsgotada = ultimoStatus === 429 && /quota/i.test(ultimoErro);
          const sobrecarregado = !cotaEsgotada && (ultimoStatus === 429 || ultimoStatus === 503 || /demorou/i.test(ultimoErro));
          let mensagemErro;
          if (cotaEsgotada) {
            mensagemErro = "O limite de uso gratuito da Intelig\xEAncia Artificial do Google foi atingido por hoje. N\xE3o \xE9 problema do seu sinal de internet — \xE9 um limite da conta do app. As fotos j\xE1 est\xE3o salvas na Pasta de Sa\xFAde; tente ler com IA novamente mais tarde, ou cadastre os rem\xE9dios manualmente por enquanto.";
          } else if (sobrecarregado) {
            mensagemErro = "Os servidores de Intelig\xEAncia Artificial do Google est\xE3o temporariamente lentos ou sobrecarregados. Tente novamente em alguns instantes.";
          } else {
            mensagemErro = "Aviso do Google Gemini: " + ultimoErro;
          }
          return new Response(JSON.stringify({
            sucesso: false,
            erro: mensagemErro,
            transitorio: sobrecarregado
          }), {
            headers: { "Content-Type": "application/json;charset=UTF-8" },
            status: 500
          });
        }
        const data = await respostaApi.json();
        let texto = "";
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
          texto = data.candidates[0].content.parts[0].text || "";
        }
        let limpo = (texto || "").trim();
        if (limpo.startsWith("```json")) limpo = limpo.slice(7);
        else if (limpo.startsWith("```")) limpo = limpo.slice(3);
        if (limpo.endsWith("```")) limpo = limpo.slice(0, -3);
        limpo = limpo.trim();
        let parsed = null;
        try {
          parsed = JSON.parse(limpo);
        } catch (e) {
          const matchJson = limpo.match(/\{[\s\S]*\}/);
          if (matchJson) {
            try { parsed = JSON.parse(matchJson[0]); } catch (e2) {}
          }
        }
        if (!parsed) {
          return new Response(JSON.stringify({
            sucesso: false,
            medicamentos: [],
            observacoes: "Não foi possível estruturar a resposta da IA. Tente enviar a foto novamente com boa iluminação."
          }), {
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        }
        return new Response(JSON.stringify(parsed), {
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          sucesso: false,
          erro: "Erro: " + err.message
        }), {
          headers: { "Content-Type": "application/json;charset=UTF-8" },
          status: 500
        });
      }
    }
    if (url.pathname === "/api/apoio-emocional" && request.method === "POST") {
      try {
        const body = await request.json();
        const textoUsuario = (body.texto || "").toString().trim().slice(0, 2e3);
        if (!textoUsuario) {
          return new Response(JSON.stringify({ sucesso: false, erro: "Escreva um pouco sobre como voc\xEA est\xE1 se sentindo." }), {
            status: 400,
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        }
        const padraoRisco = /(quero\s+morrer|n[ãa]o\s+quero\s+mais\s+viver|vou\s+me\s+matar|acabar\s+com\s+(a\s+minha\s+vida|tudo|minha\s+vida)|n[ãa]o\s+aguento\s+mais\s+viver|n[ãa]o\s+vejo\s+mais\s+sentido|me\s+machucar|me\s+cortar|automutila|suicid)/i;
        if (padraoRisco.test(textoUsuario)) {
          return new Response(JSON.stringify({
            sucesso: true,
            risco: true,
            resposta: "Sinto muito que voc\xEA esteja passando por um momento t\xE3o dif\xEDcil \u2014 e \xE9 importante que voc\xEA n\xE3o fique sozinho(a) com isso agora. Por favor, ligue para o CVV: 188 (gratuito, sigiloso, 24 horas). Se sentir que est\xE1 em perigo agora, procure o pronto-socorro mais pr\xF3ximo ou pe\xE7a ajuda a algu\xE9m de confian\xE7a perto de voc\xEA. Voc\xEA tamb\xE9m merece cuidado."
          }), { headers: { "Content-Type": "application/json;charset=UTF-8" } });
        }
        const apiKey = env.GEMINI_API_KEY ? env.GEMINI_API_KEY.trim() : "";
        if (!apiKey) {
          return new Response(JSON.stringify({ sucesso: false, erro: "IA indispon\xEDvel no momento." }), {
            status: 500,
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        }
        const prompt = `Voc\xEA \xE9 um espa\xE7o de escuta e acolhimento dentro de um aplicativo de cuidado familiar, para cuidadores de pessoas idosas ou doentes \u2014 pessoas frequentemente exaustas e sobrecarregadas.

REGRAS ABSOLUTAS:
- Voc\xEA N\xC3O \xE9 psic\xF3logo, terapeuta ou m\xE9dico. Nunca diga que fez um "diagn\xF3stico". Se a pessoa perguntar, deixe claro que voc\xEA \xE9 um espa\xE7o de apoio de um aplicativo, n\xE3o um profissional de sa\xFAde.
- Nunca mencione f\xEDsica qu\xE2ntica, "energias", produtos, suplementos, cursos, mentorias ou qualquer venda. Isto n\xE3o \xE9 uma ferramenta comercial.
- Acolha o sentimento da pessoa primeiro, com valida\xE7\xE3o genu\xEDna, sem minimizar ("\xE9 normal se sentir assim", "faz sentido estar cansado").
- Quando fizer sentido, sugira UMA t\xE9cnica simples e real baseada em neuroci\xEAncia: respira\xE7\xE3o lenta (ex.: inspirar 4s, segurar 4s, soltar 6s) para reduzir a rumina\xE7\xE3o mental, ou uma pequena pausa de aten\xE7\xE3o plena (mindfulness) observando a respira\xE7\xE3o sem julgamento.
- Quando a pessoa parecer sobrecarregada com tarefas demais de uma vez, ofere\xE7a a ideia de "apoio do tamanho certo para este momento": sugira o MENOR pr\xF3ximo passo poss\xEDvel agora (n\xE3o a solu\xE7\xE3o inteira, n\xE3o a vida toda resolvida), inspirado no conceito de Zona de Desenvolvimento Proximal e andaime (scaffolding) de Vygotsky e Bruner \u2014 mas NUNCA cite esses nomes t\xE9cnicos para a pessoa, \xE9 s\xF3 a l\xF3gica por tr\xE1s do conselho.
- Tom: humano, caloroso, simples, direto. Frases curtas. No m\xE1ximo 1 emoji, ou nenhum.
- Responda em portugu\xEAs do Brasil, no m\xE1ximo 100 palavras.

Mensagem da pessoa: "${textoUsuario}"`;
        const modelos = await obterModelosDisponiveis(env, apiKey);
        let respostaTexto = "";
        let ultimoErro = "";
        let ultimoStatus = 0;
        for (const mod of modelos) {
          const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${apiKey}`;
          const controladorModelo = new AbortController();
          const tempoLimiteModelo = setTimeout(() => controladorModelo.abort(), 15e3);
          try {
            const res = await fetch(targetUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.6 }
              }),
              signal: controladorModelo.signal
            });
            if (res.ok) {
              const data = await res.json();
              respostaTexto = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (respostaTexto) break;
            } else {
              ultimoStatus = res.status;
              ultimoErro = await res.text();
            }
          } catch (e) {
            ultimoErro = e.name === "AbortError" ? "Modelo demorou mais de 15s para responder" : e.message;
            ultimoStatus = 0;
          } finally {
            clearTimeout(tempoLimiteModelo);
          }
        }
        if (!respostaTexto) {
          return new Response(JSON.stringify({
            sucesso: false,
            erro: "N\xE3o consegui responder agora. Tente novamente em instantes."
          }), { status: 500, headers: { "Content-Type": "application/json;charset=UTF-8" } });
        }
        return new Response(JSON.stringify({ sucesso: true, risco: false, resposta: respostaTexto.trim() }), {
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ sucesso: false, erro: "Erro: " + err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
    }
    if (url.pathname === "/api/eventos/uso" && request.method === "POST") {
      ctx.waitUntil(registrarEvento(env, "app_em_uso"));
      const emailSessao = await emailDaSessao(request, env);
      let nome = "";
      if (emailSessao) {
        const body = await request.json().catch(() => ({}));
        nome = (body.nome || "").toString().trim().slice(0, 100);
        ctx.waitUntil(
          env.DB.prepare("INSERT INTO visitantes_identificados (email, nome, quando) VALUES (?, ?, ?)").bind(emailSessao, nome, (/* @__PURE__ */ new Date()).toISOString()).run().catch(() => {})
        );
      }
      ctx.waitUntil(registrarNaPlanilha(env, "app_em_uso", nome, emailSessao || ""));
      return new Response(JSON.stringify({ sucesso: true }), {
        headers: { "Content-Type": "application/json;charset=UTF-8" }
      });
    }
    if (url.pathname === "/api/estatisticas" && request.method === "GET") {
      const email = await emailDaSessao(request, env);
      if (email !== "vladihersen@gmail.com") {
        return new Response(JSON.stringify({ sucesso: false, erro: "N\xE3o autorizado." }), {
          status: 403,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      }
      const totais = await env.DB.prepare("SELECT tipo, COUNT(*) as total FROM eventos_acesso GROUP BY tipo").all();
      const porDia = await env.DB.prepare(
        "SELECT substr(quando, 1, 10) as dia, tipo, COUNT(*) as total FROM eventos_acesso WHERE quando >= datetime('now', '-14 days') GROUP BY dia, tipo ORDER BY dia DESC"
      ).all();
      return new Response(JSON.stringify({ sucesso: true, totais: totais.results, porDia: porDia.results }), {
        headers: { "Content-Type": "application/json;charset=UTF-8" }
      });
    }
    if (url.pathname === "/privacidade" && request.method === "GET") {
      return new Response(PAGINA_PRIVACIDADE, {
        headers: { "content-type": "text/html;charset=UTF-8", "cache-control": "no-store" }
      });
    }
    if (url.pathname === "/" && request.method === "GET") {
      ctx.waitUntil(registrarEvento(env, "abriu_link"));
      ctx.waitUntil(registrarNaPlanilha(env, "abriu_link", "", ""));
    }
    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
        // Sem isso, o iPhone (principalmente o app instalado na Tela de
        // Início) guarda essa página em cache por conta própria e não busca
        // a versão nova sozinho — a pessoa fica presa numa versão antiga do
        // app mesmo depois de nós publicarmos uma atualização.
        "cache-control": "no-store, must-revalidate"
      }
    });
  }
};
export {
  worker_default as default
};
