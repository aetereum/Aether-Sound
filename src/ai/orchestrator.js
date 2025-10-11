const fs = require("node:fs");
const path = require("node:path");
const fetch = require("node-fetch");

const {
  GEMINI_API_KEY,
  GEMINI_MODEL = "gemini-1.5-flash",
  N8N_WEBHOOK_URL,
  N8N_AUTH_HEADER,
  N8N_API_KEY,
  AI_MAX_ITEMS = "10",
  DISABLE_N8N,
} = process.env;

async function callN8N({ query, maxItems, overrides }) {
  // Guard: desconectar n8n cuando se solicite
  if (String(DISABLE_N8N || "").toLowerCase() === "true") {
    return {
      sources: [],
      note: "n8n deshabilitado localmente (DISABLE_N8N=true)",
    };
  }
  const url = (overrides && overrides.n8nUrl) || N8N_WEBHOOK_URL;
  if (!url) {
    return {
      sources: [],
      note: "N8N_WEBHOOK_URL no definido (ni override), se omite búsqueda externa",
    };
  }
  const payload = { query, maxItems };
  const headers = { "Content-Type": "application/json" };
  const authHdr = (overrides && overrides.n8nAuth) || N8N_AUTH_HEADER;
  const apiKey = (overrides && overrides.n8nApiKey) || N8N_API_KEY;
  if (authHdr) headers.Authorization = authHdr;
  if (apiKey) headers["X-N8N-API-KEY"] = apiKey;
  const opts = { method: "POST", headers, body: JSON.stringify(payload) };

  // Intento principal: Production URL
  const res = await fetch(url, opts);
  if (res.ok) return await res.json();

  // Leer texto de error para diagnóstico
  let errText = "";
  try {
    errText = await res.text();
  } catch (_) {}

  // Fallback: si el workflow no está activado, intentar /webhook-test/
  if (url.includes("/webhook/") && !url.includes("/webhook-test/")) {
    const testUrl = url.replace("/webhook/", "/webhook-test/");
    try {
      const resTest = await fetch(testUrl, opts);
      if (resTest.ok) return await resTest.json();
      let errTextTest = "";
      try {
        errTextTest = await resTest.text();
      } catch (_) {}
      throw new Error(
        `n8n webhook error ${res.status}${errText ? `: ${errText}` : ""} | test ${resTest.status}${errTextTest ? `: ${errTextTest}` : ""}`,
      );
    } catch (err) {
      throw err;
    }
  }

  throw new Error(
    `n8n webhook error ${res.status}${errText ? `: ${errText}` : ""}`,
  );
}

async function wikipediaFallback({ query, maxItems }) {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(maxItems || 10),
    format: "json",
    origin: "*",
  });
  const url = `https://es.wikipedia.org/w/api.php?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`wikipedia error ${res.status}`);
  const data = await res.json();
  const items = data?.query?.search || [];
  const sources = items.map((it) => ({
    title: it.title,
    url: `https://es.wikipedia.org/wiki/${encodeURIComponent(it.title.replace(/ /g, "_"))}`,
    snippet: (it.snippet || "").replace(/<[^>]+>/g, ""),
  }));
  return { sources, note: "fallback: wikipedia local" };
}

async function promptGemini(messages) {
  if (!GEMINI_API_KEY) {
    return { text: "// Gemini no configurado; devolviendo guía local." };
  }
  // Minimal call sketch to Gemini Generative Language API (text-only)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: messages.join("\n") }] }],
  };
  const resGem = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resGem.ok) throw new Error(`Gemini error ${resGem.status}`);
  const data = await resGem.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { text };
}

function buildPrompt({ query, sources }) {
  const srcText =
    sources
      ?.map(
        (s, i) => `${i + 1}. ${s.title || s.url || "fuente"} — ${s.url || ""}`,
      )
      .join("\n") || "Sin fuentes externas.";
  return [
    `Eres un asesor de composición. Dada esta consigna: ${query}`,
    "Analiza las fuentes y devuelve una guía breve de estructura (BPM, compases, tonalidad, instrumentos).",
    "Fuentes:",
    srcText,
    "Formato sugerido: JSON con campos { bpm, key, scale, sections: [ { name, bars, instrumentation } ], notes }.",
  ];
}

function toLocalPlan(geminiText) {
  try {
    const m = geminiText.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch (err) {}
  // Fallback plan
  return {
    bpm: 100,
    key: "C",
    scale: "major",
    sections: [
      { name: "intro", bars: 4, instrumentation: ["pad", "drum"] },
      { name: "main", bars: 8, instrumentation: ["bass", "lead", "drum"] },
    ],
    notes: "Plan por defecto al no parsear respuesta de Gemini.",
  };
}

function estimateDurationSec({ plan }) {
  const bpm = plan?.bpm || 100;
  const beatsPerBar = 4; // asumimos 4/4
  const totalBars =
    (plan?.sections || []).reduce((acc, s) => acc + (s.bars || 0), 0) || 8;
  const beats = totalBars * beatsPerBar;
  const seconds = (60 / bpm) * beats;
  // clamp razonable
  return Math.max(4, Math.min(60, seconds));
}

async function renderFromPlan({ plan, outputDir }) {
  const composition = require("../../composition-generator");
  const drums = require("../../drum-generator");
  const synth = require("../../render-simple-synth");

  const durationSec = estimateDurationSec({ plan });
  const bpm = plan?.bpm || 100;
  const key = plan?.key || "C";
  const scale = plan?.scale || "major";

  // Render básicos existentes
  await composition.generateComposition({
    outputDir,
    bpm,
    key,
    scale,
    durationSec,
  });
  await drums.generateDrums({ outputDir });
  await synth.generateSynth({ outputDir });

  // TODO: Combinar stems según plan (por ahora devolvemos lista de archivos).
  const files = fs.readdirSync(outputDir).filter((f) => f.endsWith(".wav"));
  return { plan, files };
}

async function searchAndCompose({
  query,
  maxItems = parseInt(AI_MAX_ITEMS),
  outputDir,
  overrides,
}) {
  let sourcesPayload = { sources: [] };
  try {
    sourcesPayload = await callN8N({ query, maxItems, overrides });
  } catch (err) {
    console.warn("[n8n] fallo, aplicando fallback wikipedia:", err.message);
    try {
      sourcesPayload = await wikipediaFallback({ query, maxItems });
    } catch (err) {
      console.warn("fallback wikipedia falló:", err.message);
      sourcesPayload = {
        sources: [],
        note: "sin fuentes externas (n8n+fallback fallidos)",
      };
    }
  }

  const prompt = buildPrompt({ query, sources: sourcesPayload.sources || [] });
  const gem = await promptGemini(prompt);
  const plan = toLocalPlan(gem.text || "");
  const renderInfo = await renderFromPlan({ plan, outputDir });
  return {
    query,
    sources: sourcesPayload.sources || [],
    plan: renderInfo.plan,
    files: renderInfo.files,
  };
}

// NUEVO: Asistente de módulos (Creación, Publicación, Web3, Marketing)
async function assistModules({ module, context, selectedFiles = [] }) {
  const allowed = ["creacion", "publicacion", "web3", "marketing"];
  const mod = String(module || "").toLowerCase();
  if (!allowed.includes(mod)) {
    return {
      ok: false,
      error: "Módulo inválido. Usa: creacion | publicacion | web3 | marketing",
    };
  }
  const selText =
    Array.isArray(selectedFiles) && selectedFiles.length
      ? `Archivos seleccionados: ${selectedFiles.join(", ")}`
      : "Sin selección de archivos.";
  const sys =
    "Actúa como asistente experto en música y Web3. Devuelve respuestas breves y accionables en español. Siempre incluye una lista de pasos (bullet points) y un bloque JSON con parámetros clave.";
  const prompts = {
    creacion: `Módulo: Creación\nObjetivo: Producir música con ideas, análisis y sound design.\nContexto del usuario: ${context || "(vacío)"}\n${selText}\nIncluye: análisis de referencias, tonalidad/tempo sugeridos, paleta sonora (sintetizadores, drums), efectos recomendados, y un mini-plan de producción.\nSugiere cómo aprovechar funciones locales: /api/generate/composition, /api/effects/keysnap, mezclador A/B.\nFormato: 1) viñetas, 2) JSON { bpm, key, scale, soundDesign:[...], steps:[...] }`,
    publicacion: `Módulo: Publicación\nObjetivo: Llevar la música a streaming y Web3, unificar distribución y acuñación de NFTs.\nContexto del usuario: ${context || "(vacío)"}\n${selText}\nIncluye: check de metadatos, portada, export masters; subir a IPFS; y guía para mint (Hedera) con royalties y gobernanza.\nMenciona endpoints disponibles: /api/ipfs/upload, /api/hedera/token/create.\nFormato: 1) viñetas, 2) JSON { ipfs:{required:true}, hedera:{collectionName, symbol, royaltyBps, splits:[{account, bps}]}, steps:[...] }`,
    web3: `Módulo: Web3\nObjetivo: Monetizar y crear comunidad con NFTs y tienda.\nContexto del usuario: ${context || "(vacío)"}\n${selText}\nIncluye: estrategia de colecciones/ediciones, utilidades (acceso, stems, merch), drops y calendar, redacción de contratos (licencias), y KPI básicos.\nFormato: 1) viñetas, 2) JSON { collections:[{name, size, priceUSD, utility}], shop:{platforms:[...]}, contracts:{notes:...}, kpis:[...] }`,
    marketing: `Módulo: Marketing\nObjetivo: Promocionar y analizar.\nContexto del usuario: ${context || "(vacío)"}\n${selText}\nIncluye: análisis de datos y campañas, contenido para redes, calendario de lanzamientos, y cómo usar /api/analytics/summary para medir.\nFormato: 1) viñetas, 2) JSON { audience:{segments:[...]}, campaigns:[{channel, goal, cadence}] , contentIdeas:[...], metrics:[...] }`,
  };

  if (!GEMINI_API_KEY) {
    const txt = `Gemini no configurado. Borrador local para ${mod}:\n${prompts[mod]}`;
    return {
      ok: true,
      module: mod,
      context: context || "",
      selectedFiles,
      advice: txt,
    };
  }

  const messages = [sys, prompts[mod]];
  try {
    const gem = await promptGemini(messages);
    return {
      ok: true,
      module: mod,
      context: context || "",
      selectedFiles,
      advice: gem.text || "",
    };
  } catch (err) {
    const txt = `Borrador local (Gemini falló: ${err.message}).\n${prompts[mod]}`;
    return {
      ok: true,
      module: mod,
      context: context || "",
      selectedFiles,
      advice: txt,
    };
  }
}

module.exports = { searchAndCompose, assistModules };
