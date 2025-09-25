// Simple Express server to serve UI and generation API
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { Client, PrivateKey, PublicKey, AccountId, TokenId, TokenCreateTransaction, TokenType, TokenSupplyType, TokenMintTransaction, TokenAssociateTransaction, TransferTransaction, Hbar, AccountInfoQuery, AccountBalanceQuery, KeyList, CustomRoyaltyFee, CustomFixedFee, Transaction, AccountCreateTransaction, TokenNftInfoQuery, NftId } = require('@hashgraph/sdk');
const https = require('https');
const fetch = require('node-fetch');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// NUEVO: Healthcheck simple
app.get('/api/health', (req, res) => {
  try {
    res.json({ ok: true, port: Number(PORT), envPort: process.env.PORT ? Number(process.env.PORT) : null, hederaNetwork: (process.env.HEDERA_NETWORK || 'testnet'), uptimeSec: Math.round(process.uptime()) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: Créditos - listar
app.get('/api/credits/list', async (req, res) => {
  try {
    ensureDir(CREDITS_DIR);
    const files = fs.readdirSync(CREDITS_DIR).filter(f => f.endsWith('.json')).sort();
    const list = files.map(f => {
      const p = path.join(CREDITS_DIR, f);
      let m = {};
      try { m = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) {}
      const st = fs.statSync(p);
      return {
        id: m.id || f.replace(/\.json$/, ''),
        title: m.title || '',
        artist: m.artist || '',
        updatedAt: m.updatedAt || st.mtimeMs,
        path: `/community/credits/${f}`
      };
    });
    writeAnalytics({ type: 'credits_list', file: null, data: { count: list.length } });
    res.json({ ok: true, items: list });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: EPK - generar HTML estático desde créditos
app.post('/api/epk/generate', async (req, res) => {
  try {
    ensureDir(EPK_DIR);
    const b = req.body || {};
    let manifest;
    if (b.id && /^[a-z0-9\-]+$/.test(String(b.id))) {
      const jp = path.join(CREDITS_DIR, `${b.id}.json`);
      if (!fs.existsSync(jp)) return res.status(404).json({ ok: false, error: 'Créditos no encontrados' });
      try { manifest = JSON.parse(fs.readFileSync(jp, 'utf8')); } catch (_) { return res.status(500).json({ ok: false, error: 'Manifiesto inválido' }); }
    } else {
      if (!b.title || !b.artist) return res.status(400).json({ ok: false, error: 'Faltan title y artist' });
      manifest = {
        id: slugify(`${b.title}-${b.artist}`),
        title: b.title,
        artist: b.artist,
        cover: b.cover || '',
        isrc: b.isrc || '',
        people: Array.isArray(b.people) ? b.people.map(x => ({ role: x.role || '', name: x.name || '' })) : [],
        splits: Array.isArray(b.splits) ? b.splits.map(x => ({ party: x.party || '', bps: Number(x.bps) || 0 })) : [],
        updatedAt: Date.now(),
      };
    }

    const idOut = manifest.id || slugify(`${manifest.title}-${manifest.artist}`);
    const outPath = path.join(EPK_DIR, `${idOut}.html`);

    const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pct = bps => `${((Number(bps) || 0) / 100).toFixed(((Number(bps) || 0) % 100) ? 2 : 0)}%`;

    const peopleHtml = (manifest.people || []).map(p => `<li>${esc(p.role)} — ${esc(p.name)}</li>`).join('');
    const splitsHtml = (manifest.splits || []).map(s => `<li>${esc(s.party)} — ${pct(s.bps)}</li>`).join('');
    const coverTag = manifest.cover ? `<img src="${esc(manifest.cover)}" alt="Cover" style="max-width:220px;border-radius:8px"/>` : '';

    const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(manifest.title)} — ${esc(manifest.artist)} | EPK</title><style>body{font-family:system-ui,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;padding:24px;line-height:1.5;background:#f7f7f8}h1{margin:0}h2{margin:.25rem 0 0;color:#555}.card{max-width:860px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 10px 24px rgba(0,0,0,.06);overflow:hidden}.head{display:flex;gap:20px;padding:20px;border-bottom:1px solid #eee}.sec{padding:16px 20px}.badge{display:inline-block;background:#eef2ff;color:#3730a3;border-radius:999px;padding:4px 10px;font-size:12px;margin-right:8px}</style><div class="card"><div class="head">${coverTag}<div><h1>${esc(manifest.title)}</h1><h2>${esc(manifest.artist)}</h2><div>${manifest.isrc?`<span class="badge">ISRC: ${esc(manifest.isrc)}</span>`:''}<span class="badge">ID: ${esc(idOut)}</span></div></div></div><div class="sec"><h3>Créditos</h3><ul>${peopleHtml||'<li>(vacío)</li>'}</ul></div><div class="sec"><h3>Splits</h3><ul>${splitsHtml||'<li>(vacío)</li>'}</ul></div></div>`;

    await fs.promises.writeFile(outPath, html, 'utf8');
    writeAnalytics({ type: 'epk_generate', file: `${idOut}.html` });
    res.json({ ok: true, id: idOut, path: `/community/epk/${idOut}.html` });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: Créditos - obtener uno
app.get('/api/credits/:id', async (req, res) => {
  try {
    const id = (req.params.id || '').toString();
    if (!id || !/^[a-z0-9-_]+$/i.test(id)) return res.status(400).json({ ok: false, error: 'id inválido' });
    const p = path.join(CREDITS_DIR, `${id}.json`);
    if (!fs.existsSync(p)) return res.status(404).json({ ok: false, error: 'No encontrado' });
    const m = JSON.parse(fs.readFileSync(p, 'utf8'));
    writeAnalytics({ type: 'credits_get', file: `${id}.json` });
    res.json({ ok: true, manifest: m });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Ensure output directory exists
const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}
// TMP upload directory for multer
const TMP_UPLOAD_DIR = path.join(__dirname, 'tmp');
if (!fs.existsSync(TMP_UPLOAD_DIR)) {
  fs.mkdirSync(TMP_UPLOAD_DIR);
}
const upload = multer({ dest: TMP_UPLOAD_DIR });

// NUEVO: Ensure analytics directory exists
const ANALYTICS_DIR = path.join(__dirname, 'analytics');
if (!fs.existsSync(ANALYTICS_DIR)) {
  fs.mkdirSync(ANALYTICS_DIR);
}
const ANALYTICS_LOG = path.join(ANALYTICS_DIR, 'events.log');
function writeAnalytics(evt) {
  try {
    const line = JSON.stringify({ ...evt, ts: Date.now() }) + '\n';
    fs.appendFile(ANALYTICS_LOG, line, () => {});
  } catch (_) {}
}
// NUEVO: Community/Pulses directories
const COMMUNITY_DIR = path.join(__dirname, 'community');
if (!fs.existsSync(COMMUNITY_DIR)) { try { fs.mkdirSync(COMMUNITY_DIR); } catch (_) {} }
const PULSES_DIR = path.join(COMMUNITY_DIR, 'pulses');
if (!fs.existsSync(PULSES_DIR)) { try { fs.mkdirSync(PULSES_DIR); } catch (_) {} }
// NUEVO: otros subdirectorios de comunidad
const REMIXHUB_DIR = path.join(COMMUNITY_DIR, 'remixhub');
if (!fs.existsSync(REMIXHUB_DIR)) { try { fs.mkdirSync(REMIXHUB_DIR); } catch (_) {} }
const MARKETPLACE_DIR = path.join(COMMUNITY_DIR, 'marketplace');
if (!fs.existsSync(MARKETPLACE_DIR)) { try { fs.mkdirSync(MARKETPLACE_DIR); } catch (_) {} }
const BI_DIR = path.join(COMMUNITY_DIR, 'bi');
if (!fs.existsSync(BI_DIR)) { try { fs.mkdirSync(BI_DIR); } catch (_) {} }
const CREDITS_DIR = path.join(COMMUNITY_DIR, 'credits');
if (!fs.existsSync(CREDITS_DIR)) { try { fs.mkdirSync(CREDITS_DIR); } catch (_) {} }
const EPK_DIR = path.join(COMMUNITY_DIR, 'epk');
if (!fs.existsSync(EPK_DIR)) { try { fs.mkdirSync(EPK_DIR); } catch (_) {} }
// Serve static frontend
app.use(express.static(__dirname));

// NUEVO: Upload de archivo hacia OUTPUT_DIR
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Archivo no recibido' });
    const allowed = new Set(['.wav', '.mp3', '.ogg', '.flac']);
    const orig = (req.file.originalname || 'audio').replace(/[\\/:*?"<>|]+/g, '_');
    const ext = (path.extname(orig) || '').toLowerCase();
    if (!allowed.has(ext)) return res.status(400).json({ ok: false, error: 'Formato no soportado (WAV/MP3/OGG/FLAC)' });
    const base = orig.replace(/\.[^.]+$/, '');
    const finalName = `${base}_${Date.now()}${ext}`;
    const finalPath = path.join(OUTPUT_DIR, finalName);
    await fs.promises.rename(req.file.path, finalPath);
    writeAnalytics({ type: 'upload', file: finalName });
    res.json({ ok: true, file: finalName, url: `/output/${finalName}` });
  } catch (e) {
    console.error('upload error:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// API: list output files
app.get('/api/output', (req, res) => {
  fs.readdir(OUTPUT_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'No se pudo leer la carpeta output' });
    const exts = ['.wav', '.mp3', '.ogg', '.flac'];
    const audioFiles = files.filter(f => exts.includes(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
    res.json({ files: audioFiles });
  });
});

// API: generate composition
app.post('/api/generate/composition', async (req, res) => {
  try {
    const gen = require('./composition-generator');
    const { bpm, key, scale, durationSec } = req.body || {};
    const payload = { outputDir: OUTPUT_DIR };
    if (bpm !== undefined && bpm !== null && !isNaN(Number(bpm))) payload.bpm = Number(bpm);
    if (key) payload.key = String(key).toUpperCase();
    if (scale) payload.scale = String(scale).toLowerCase();
    if (durationSec !== undefined && durationSec !== null && !isNaN(Number(durationSec))) payload.durationSec = Number(durationSec);
    const filePath = await gen.generateComposition(payload);
    res.json({ ok: true, file: path.basename(filePath) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// API: generate simple synth
app.post('/api/generate/synth', async (req, res) => {
  try {
    const gen = require('./render-simple-synth');
    const filePath = await gen.generateSynth({ outputDir: OUTPUT_DIR });
    res.json({ ok: true, file: path.basename(filePath) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// API: generate drums
app.post('/api/generate/drums', async (req, res) => {
  try {
    const gen = require('./drum-generator');
    const filePath = await gen.generateDrums({ outputDir: OUTPUT_DIR });
    res.json({ ok: true, file: path.basename(filePath) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// API: IA search + compose via n8n + Gemini (fallback local)
app.post('/api/ai/search-compose', async (req, res) => {
  try {
    const orchestrator = require('./src/ai/orchestrator');
    const { query = 'ambient generative', maxItems = 10, overrides = {} } = req.body || {};
    const result = await orchestrator.searchAndCompose({ query, maxItems, outputDir: OUTPUT_DIR, overrides });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// NUEVO: Asistente Gemini por módulos
app.post('/api/ai/assist', async (req, res) => {
  try {
    const orchestrator = require('./src/ai/orchestrator');
    const { module: mod, context = '', selectedFiles = [] } = req.body || {};
    const result = await orchestrator.assistModules({ module: mod, context, selectedFiles });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// API: Álbum (placeholder)
app.post('/api/album/create', async (req, res) => {
  try {
    const { title, artist, description, tracks = [] } = req.body || {};
    if (!tracks || tracks.length === 0) return res.status(400).json({ ok: false, error: 'Sin pistas seleccionadas' });
    const albumId = `alb_${Date.now()}`;
    const manifest = { id: albumId, title, artist, description, tracks };
    const manifestPath = path.join(OUTPUT_DIR, `${albumId}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    res.json({ ok: true, albumId, manifest: `/output/${albumId}.json` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// API: Crear colección NFT con gobernanza y royalties
app.post('/api/hedera/token/create', async (req, res) => {
  try {
    const {
      name,
      symbol,
      artistAccountId,
      artistPublicKey,
      treasuryAccountId,
      governance = { mode: 'project' },
      royalties = { artistBps: 0, projectBps: 0, minHbar: 0 },
    } = req.body || {};

    const { HEDERA_NETWORK = 'testnet', HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY } = process.env;
    if (!HEDERA_ACCOUNT_ID || !HEDERA_PRIVATE_KEY) {
      return res.status(400).json({ ok: false, error: 'Faltan credenciales de Hedera en .env (HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY)' });
    }

    const client = (HEDERA_NETWORK.toLowerCase() === 'mainnet') ? Client.forMainnet() : Client.forTestnet();
    const operatorId = AccountId.fromString(HEDERA_ACCOUNT_ID);
    const operatorKey = PrivateKey.fromString(HEDERA_PRIVATE_KEY);
    client.setOperator(operatorId, operatorKey);

    const projectPubKey = operatorKey.publicKey;
    let artistPubKey = null;
    if (artistPublicKey) {
      try { artistPubKey = PublicKey.fromString(artistPublicKey); } catch (_) {
        try { artistPubKey = PublicKey.fromBytes(Buffer.from(artistPublicKey.replace(/^0x/i, ''), 'hex')); } catch (e) {
          return res.status(400).json({ ok: false, error: 'artistPublicKey inválida' });
        }
      }
    }

    const mode = (governance?.mode || 'project').toLowerCase();
    let supplyKey = projectPubKey;
    let adminKey = projectPubKey;
    let feeScheduleKey = projectPubKey;

    if (mode === 'artist') {
      if (!artistPubKey) {
        supplyKey = projectPubKey;
      } else {
        supplyKey = artistPubKey;
      }
    } else if (mode === '1of2' || mode === '2of2') {
      if (!artistPubKey) {
        supplyKey = projectPubKey;
      } else {
        const kl = new KeyList([projectPubKey, artistPubKey]);
        kl.setThreshold(mode === '1of2' ? 1 : 2);
        supplyKey = kl;
      }
    }

    let treasuryId = operatorId;
    if (treasuryAccountId && treasuryAccountId !== operatorId.toString()) {
      console.warn('Solicitud de tesorería distinta al operador; usando operador como treasury');
    }

    const customFees = [];
    const artistBps = Number(royalties?.artistBps) || 0;
    const projectBps = Number(royalties?.projectBps) || 0;
    const minHbar = Number(royalties?.minHbar) || 0;
    if (artistBps > 0 && artistAccountId) {
      const rf = new CustomRoyaltyFee()
        .setNumerator(artistBps)
        .setDenominator(10000)
        .setFeeCollectorAccountId(AccountId.fromString(artistAccountId));
      if (minHbar > 0) rf.setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(minHbar)));
      customFees.push(rf);
    }
    if (projectBps > 0) {
      const rf2 = new CustomRoyaltyFee()
        .setNumerator(projectBps)
        .setDenominator(10000)
        .setFeeCollectorAccountId(operatorId);
      if (minHbar > 0) rf2.setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(minHbar)));
      customFees.push(rf2);
    }

    if (!name || !symbol) return res.status(400).json({ ok: false, error: 'Parámetros requeridos: name y symbol' });

    const tx = new TokenCreateTransaction()
      .setTokenName(String(name).slice(0, 100))
      .setTokenSymbol(String(symbol).slice(0, 6).toUpperCase())
      .setDecimals(0)
      .setInitialSupply(0)
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(TokenSupplyType.Infinite)

      .setTreasuryAccountId(treasuryId)
      .setAdminKey(adminKey)
      .setSupplyKey(supplyKey)
      .setMaxTransactionFee(new Hbar(20));

    if (customFees.length > 0) {
      tx.setFeeScheduleKey(feeScheduleKey).setCustomFees(customFees);
    }

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    const tokenId = receipt.tokenId;

    return res.json({
      ok: true,
      network: HEDERA_NETWORK.toLowerCase(),
      tokenId: tokenId?.toString(),
      governance: { mode, adminKey: 'project', feeScheduleKey: customFees.length > 0 ? 'project' : null },
      treasury: treasuryId.toString(),
      royalties: { artistBps, projectBps, minHbar },
      notes: treasuryAccountId && treasuryAccountId !== operatorId.toString() ? 'Se ignoró treasuryAccountId distinto al operador por falta de firma' : undefined,
    });
  } catch (e) {
    console.error('Hedera token/create error:', e?.message || e);
    res.status(500).json({ ok: false, error: 'Fallo al crear token: ' + (e?.message || e) });
  }
});

// NUEVO: Crear colección NFT con múltiples splits de royalties (colaboradores)
app.post('/api/hedera/split-nft/create', async (req, res) => {
  try {
    const {
      name,
      symbol,
      treasuryAccountId,
      minHbar = 0,
      splits = [], // [{ accountId: string, bps: number, minHbar?: number }]
    } = req.body || {};

    const { HEDERA_NETWORK = 'testnet', HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY } = process.env;
    if (!HEDERA_ACCOUNT_ID || !HEDERA_PRIVATE_KEY) {
      return res.status(400).json({ ok: false, error: 'Faltan credenciales de Hedera en .env (HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY)' });
    }

    if (!name || !symbol) return res.status(400).json({ ok: false, error: 'Parámetros requeridos: name y symbol' });
    if (!Array.isArray(splits) || splits.length === 0) return res.status(400).json({ ok: false, error: 'Debes proporcionar al menos un split en "splits"' });

    // Inicializar cliente
    const client = (HEDERA_NETWORK.toLowerCase() === 'mainnet') ? Client.forMainnet() : Client.forTestnet();
    const operatorId = AccountId.fromString(HEDERA_ACCOUNT_ID);
    const operatorKey = PrivateKey.fromString(HEDERA_PRIVATE_KEY);
    client.setOperator(operatorId, operatorKey);

    // Claves básicas
    const adminKey = operatorKey.publicKey;
    const supplyKey = operatorKey.publicKey;
    const feeScheduleKey = operatorKey.publicKey;

    // Tesorería
    let treasuryId = operatorId;
    if (treasuryAccountId && treasuryAccountId !== operatorId.toString()) {
      console.warn('Solicitud de tesorería distinta al operador; usando operador como treasury');
    }

    // Construir CustomRoyaltyFee por split
    const customFees = [];
    const normalizedSplits = [];
    let totalBps = 0;
    for (const s of splits) {
      const bps = Number(s?.bps) || 0;
      const acct = s?.accountId;
      if (!acct || bps <= 0) continue;
      let collector;
      try { collector = AccountId.fromString(String(acct)); } catch (_) {
        return res.status(400).json({ ok: false, error: `accountId inválido en split: ${acct}` });
      }
      // Verificar que el collector exista en la red para evitar errores INVALID_CUSTOM_FEE_COLLECTOR
      try {
        await new AccountInfoQuery().setAccountId(collector).execute(client);
      } catch (err) {
        return res.status(400).json({ ok: false, error: `Fee collector no existe o es inválido: ${collector.toString()}` });
      }
      if (bps > 10000) return res.status(400).json({ ok: false, error: `bps inválido (>10000) para collector ${collector.toString()}` });
      totalBps += bps;
      const rf = new CustomRoyaltyFee()
        .setNumerator(bps)
        .setDenominator(10000)
        .setFeeCollectorAccountId(collector);
      const fb = Number(s?.minHbar ?? minHbar) || 0;
      if (fb > 0) rf.setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(fb)));
      customFees.push(rf);
      normalizedSplits.push({ accountId: collector.toString(), bps, minHbar: fb || 0 });
    }

    if (customFees.length === 0) return res.status(400).json({ ok: false, error: 'Ningún split válido (revisa accountId/bps)' });
    if (totalBps > 10000) return res.status(400).json({ ok: false, error: `La suma de bps (${totalBps}) supera 10000 (100%).` });

    const tx = new TokenCreateTransaction()
      .setTokenName(String(name).slice(0, 100))
      .setTokenSymbol(String(symbol).slice(0, 6).toUpperCase())
      .setDecimals(0)
      .setInitialSupply(0)
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTreasuryAccountId(treasuryId)
      .setAdminKey(adminKey)
      .setSupplyKey(supplyKey)
      .setMaxTransactionFee(new Hbar(20));

    if (customFees.length > 0) {
      tx.setFeeScheduleKey(feeScheduleKey).setCustomFees(customFees);
    }

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    const tokenId = receipt.tokenId;

    return res.json({
      ok: true,
      network: HEDERA_NETWORK.toLowerCase(),
      tokenId: tokenId?.toString(),
      treasury: treasuryId.toString(),
      splits: normalizedSplits,
    });
  } catch (e) {
    console.error('Hedera split-nft/create error:', e?.message || e);
    res.status(500).json({ ok: false, error: 'Fallo en split-nft/create: ' + (e?.message || e) });
  }
});

// Mint de un NFT para un token existente (metadata simple)
app.post('/api/hedera/split-nft/mint', async (req, res) => {
  try {
    const { tokenId, metadata, metadataBase64, metadataJson } = req.body || {};
    const { HEDERA_NETWORK = 'testnet', HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY } = process.env;
    if (!HEDERA_ACCOUNT_ID || !HEDERA_PRIVATE_KEY) {
      return res.status(400).json({ ok: false, error: 'Faltan credenciales de Hedera en .env (HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY)' });
    }
    if (!tokenId) return res.status(400).json({ ok: false, error: 'Parámetro requerido: tokenId' });

    const client = (HEDERA_NETWORK.toLowerCase() === 'mainnet') ? Client.forMainnet() : Client.forTestnet();
    const operatorId = AccountId.fromString(HEDERA_ACCOUNT_ID);
    const operatorKey = PrivateKey.fromString(HEDERA_PRIVATE_KEY);
    client.setOperator(operatorId, operatorKey);

    let token;
    try { token = TokenId.fromString(String(tokenId)); } catch (_) {
      return res.status(400).json({ ok: false, error: 'tokenId inválido' });
    }

    let metaBuf;
    if (metadataBase64) {
      try { metaBuf = Buffer.from(String(metadataBase64), 'base64'); } catch (_) {
        return res.status(400).json({ ok: false, error: 'metadataBase64 inválido' });
      }
    } else if (metadataJson) {
      try { metaBuf = Buffer.from(JSON.stringify(metadataJson), 'utf8'); } catch (_) {
        return res.status(400).json({ ok: false, error: 'metadataJson inválido' });
      }
    } else if (metadata) {
      metaBuf = Buffer.from(String(metadata), 'utf8');
    } else {
      metaBuf = Buffer.from('Aether Sound NFT', 'utf8');
    }

    const tx = new TokenMintTransaction()
      .setTokenId(token)
      .setMetadata([metaBuf])
      .setMaxTransactionFee(new Hbar(20));

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    const serials = (receipt.serials || []).map(x => Number(x?.toString?.() || x));

    return res.json({ ok: true, network: HEDERA_NETWORK.toLowerCase(), tokenId: token.toString(), serials });
  } catch (e) {
    console.error('Hedera split-nft/mint error:', e?.message || e);
    res.status(500).json({ ok: false, error: 'Fallo en split-nft/mint: ' + (e?.message || e) });
  }
});

// Asociar un token (FT/NFT) a una cuenta (requiere firma de la cuenta)
app.post('/api/hedera/token/associate', async (req, res) => {
  try {
    const { tokenId, accountId, accountPrivateKey } = req.body || {};
    const { HEDERA_NETWORK = 'testnet', HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY } = process.env;
    if (!HEDERA_ACCOUNT_ID || !HEDERA_PRIVATE_KEY) {
      return res.status(400).json({ ok: false, error: 'Faltan credenciales de Hedera en .env (HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY)' });
    }
    if (!tokenId || !accountId) return res.status(400).json({ ok: false, error: 'Parámetros requeridos: tokenId, accountId' });

    const client = (HEDERA_NETWORK.toLowerCase() === 'mainnet') ? Client.forMainnet() : Client.forTestnet();
    const operatorId = AccountId.fromString(HEDERA_ACCOUNT_ID);
    const operatorKey = PrivateKey.fromString(HEDERA_PRIVATE_KEY);
    client.setOperator(operatorId, operatorKey);

    let token;
    try { token = TokenId.fromString(String(tokenId)); } catch (_) {
      return res.status(400).json({ ok: false, error: 'tokenId inválido' });
    }

    const assocTx = new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(String(accountId)))
      .setTokenIds([token])
      .setMaxTransactionFee(new Hbar(10))
      .freezeWith(client);

    if (String(accountId) === operatorId.toString()) {
      const signed = await assocTx.sign(operatorKey);
      const resp = await signed.execute(client);
      const rec = await resp.getReceipt(client);
      return res.json({ ok: true, status: rec.status?.toString?.() || String(rec.status), accountId: operatorId.toString(), tokenId: token.toString() });
    } else {
      if (!accountPrivateKey) return res.status(400).json({ ok: false, error: 'accountPrivateKey requerido para firmar la asociación' });
      let userKey;
      try { userKey = PrivateKey.fromString(String(accountPrivateKey)); } catch (_) {
        return res.status(400).json({ ok: false, error: 'accountPrivateKey inválida' });
      }
      const signed = await assocTx.sign(userKey);
      const resp = await signed.execute(client);
      const rec = await resp.getReceipt(client);
      return res.json({ ok: true, status: rec.status?.toString?.() || String(rec.status), accountId: String(accountId), tokenId: token.toString() });
    }
  } catch (e) {
    console.error('Hedera token/associate error:', e?.message || e);
    res.status(500).json({ ok: false, error: 'Fallo en token/associate: ' + (e?.message || e) });
  }
});

// Transferencia de un NFT (requiere firma del emisor)
app.post('/api/hedera/nft/transfer', async (req, res) => {
  try {
    const { tokenId, serial, fromAccountId, toAccountId, fromPrivateKey } = req.body || {};
    const { HEDERA_NETWORK = 'testnet', HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY } = process.env;
    if (!HEDERA_ACCOUNT_ID || !HEDERA_PRIVATE_KEY) {
      return res.status(400).json({ ok: false, error: 'Faltan credenciales de Hedera en .env (HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY)' });
    }
    if (!tokenId || !serial || !toAccountId) return res.status(400).json({ ok: false, error: 'Parámetros requeridos: tokenId, serial, toAccountId' });

    const client = (HEDERA_NETWORK.toLowerCase() === 'mainnet') ? Client.forMainnet() : Client.forTestnet();
    const operatorId = AccountId.fromString(HEDERA_ACCOUNT_ID);
    const operatorKey = PrivateKey.fromString(HEDERA_PRIVATE_KEY);
    client.setOperator(operatorId, operatorKey);

    let token;
    try { token = TokenId.fromString(String(tokenId)); } catch (_) {
      return res.status(400).json({ ok: false, error: 'tokenId inválido' });
    }

    const fromId = fromAccountId ? AccountId.fromString(String(fromAccountId)) : operatorId;
    const toId = AccountId.fromString(String(toAccountId));

    if (fromId.toString() === toId.toString()) {
      return res.status(400).json({ ok: false, error: 'fromAccountId y toAccountId no pueden ser iguales' });
    }

    const tx = new TransferTransaction()
      .addNftTransfer(token, Number(serial), fromId, toId)
      .setMaxTransactionFee(new Hbar(10))
      .freezeWith(client);

    if (fromId.toString() === operatorId.toString()) {
      const resp = await tx.execute(client);
      const rec = await resp.getReceipt(client);
      return res.json({ ok: true, status: rec.status?.toString?.() || String(rec.status), tokenId: token.toString(), serial: Number(serial), from: fromId.toString(), to: toId.toString() });
    } else {
      if (!fromPrivateKey) return res.status(400).json({ ok: false, error: 'fromPrivateKey requerido para firmar la transferencia' });
      let fromKey;
      try { fromKey = PrivateKey.fromString(String(fromPrivateKey)); } catch (_) {
        return res.status(400).json({ ok: false, error: 'fromPrivateKey inválida' });
      }
      const signed = await tx.sign(fromKey);
      const resp = await signed.execute(client);
      const rec = await resp.getReceipt(client);
      return res.json({ ok: true, status: rec.status?.toString?.() || String(rec.status), tokenId: token.toString(), serial: Number(serial), from: fromId.toString(), to: toId.toString() });
    }
  } catch (e) {
    console.error('Hedera nft/transfer error:', e?.message || e);
    res.status(500).json({ ok: false, error: 'Fallo en nft/transfer: ' + (e?.message || e) });
  }
});

// Crear cuenta de Hedera (utilidad para pruebas). Si no se provee publicKey, el servidor generará una nueva clave ED25519.
app.post('/api/hedera/account/create', async (req, res) => {
  try {
    const { initialHbar = 0, publicKey, memo } = req.body || {};
    const { HEDERA_NETWORK = 'testnet', HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY } = process.env;

    if (!HEDERA_ACCOUNT_ID || !HEDERA_PRIVATE_KEY) {
      return res.status(400).json({ ok: false, error: 'Faltan credenciales de Hedera en .env (HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY)' });
    }

    const client = (HEDERA_NETWORK.toLowerCase() === 'mainnet') ? Client.forMainnet() : Client.forTestnet();
    const operatorId = AccountId.fromString(HEDERA_ACCOUNT_ID);
    const operatorKey = PrivateKey.fromString(HEDERA_PRIVATE_KEY);
    client.setOperator(operatorId, operatorKey);

    let pubKey;
    let generatedPrivKey;
    if (publicKey) {
      try {
        pubKey = PublicKey.fromString(String(publicKey));
      } catch (_) {
        return res.status(400).json({ ok: false, error: 'publicKey inválida' });
      }
    } else {
      generatedPrivKey = PrivateKey.generateED25519();
      pubKey = generatedPrivKey.publicKey;
    }

    let initialBalanceH = 0;
    const n = Number(initialHbar);
    if (Number.isFinite(n) && n > 0) initialBalanceH = n;

    const tx = new AccountCreateTransaction()
      .setKey(pubKey)
      .setInitialBalance(new Hbar(initialBalanceH))
      .setMaxTransactionFee(new Hbar(5));

    if (memo) tx.setAccountMemo(String(memo).slice(0, 100));

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    const newAccountId = receipt.accountId?.toString?.() || String(receipt.accountId);

    return res.json({
      ok: true,
      network: HEDERA_NETWORK.toLowerCase(),
      accountId: newAccountId,
      publicKey: pubKey?.toString?.() || String(pubKey),
      // Sólo devolvemos la privateKey si fue generada por el servidor en esta llamada (para facilitar pruebas en testnet)
      privateKey: generatedPrivKey ? generatedPrivKey.toString() : undefined,
    });
  } catch (e) {
    console.error('Hedera account/create error:', e?.message || e);
    res.status(500).json({ ok: false, error: 'Fallo en account/create: ' + (e?.message || e) });
  }
});

// Nuevo: efecto Pitch-Shift simple por remuestreo lineal
app.post('/api/effects/pitch-shift', async (req, res) => {
  try {
    const { file, semitones = 0, preserveDuration = false } = req.body || {};
    if (!file) return res.status(400).json({ ok: false, error: 'Parámetro "file" requerido' });
    const safe = path.basename(file);
    const srcPath = path.join(OUTPUT_DIR, safe);
    if (!fs.existsSync(srcPath)) return res.status(404).json({ ok: false, error: 'Archivo no encontrado en output' });

    const { readWav, writeWav } = require('./audio-renderer');
    let { samples, sampleRate } = readWav(srcPath);

    const st = Number(semitones) || 0;
    let factor = Math.pow(2, st / 12);
    if (!isFinite(factor) || factor <= 0) factor = 1;

    // Prefiltro simple (pasa-bajos) para minimizar aliasing cuando reducimos (factor < 1)
    if (factor < 1) {
      const W = Math.max(3, (Math.ceil(1 / factor) * 2 + 1)); // ventana impar
      const half = Math.floor(W / 2);
      const out = new Array(samples.length);
      let acc = 0;
      for (let i = -half; i <= half; i++) acc += samples[Math.min(samples.length - 1, Math.max(0, i))] || 0;
      out[0] = acc / W;
      for (let n = 1; n < samples.length; n++) {
        const addIdx = Math.min(samples.length - 1, n + half);
        const remIdx = Math.max(0, n - half - 1);
        acc += (samples[addIdx] || 0) - (samples[remIdx] || 0);
        out[n] = acc / W;
      }
      samples = out;
    }

    // Interpolación cúbica Catmull-Rom
    function cubic(p0, p1, p2, p3, t) {
      const a0 = -0.5*p0 + 1.5*p1 - 1.5*p2 + 0.5*p3;
      const a1 = p0 - 2.5*p1 + 2*p2 - 0.5*p3;
      const a2 = -0.5*p0 + 0.5*p2;
      const a3 = p1;
      const t2 = t * t;
      const t3 = t2 * t;
      return a0*t3 + a1*t2 + a2*t + a3;
    }

    // Ventana Hann y OLA simple para time-stretch (preserva pitch, ajusta duración)
    function hann(N) {
      const w = new Array(N);
      const c = 2 * Math.PI / (N - 1);
      for (let n = 0; n < N; n++) w[n] = 0.5 * (1 - Math.cos(c * n));
      return w;
    }
    function timeStretchWSOLA(input, R) {
      // R>1 alarga, R<1 comprime (M*R ≈ N)
      const Nw = Math.min(2048, Math.max(512, Math.floor(sampleRate * 0.023))); // ~23ms
      const Ha = Math.floor(Nw / 2);                   // análisis
      const Hs = Math.max(1, Math.floor(Ha * R));      // síntesis
      const win = hann(Nw);
      const outLen = Math.max(Nw + Hs, Math.floor(input.length * R) + Nw + Hs + 4);
      const out = new Array(outLen).fill(0);
      const wsum = new Array(outLen).fill(0);

      // Copiar primer frame sin alineación
      for (let n = 0; n < Math.min(Nw, input.length); n++) {
        const v = input[n] * win[n];
        out[n] += v;
        wsum[n] += win[n];
      }

      let k = 1;
      while (true) {
        const pa = k * Ha;           // posición análisis estimada en input
        const ps = k * Hs;           // posición síntesis estimada en output
        if (pa + Nw >= input.length || ps + Nw >= outLen) break;

        // Buscar mejor alineación alrededor de pa mediante correlación con la cola del output
        const Lcorr = Math.floor(Nw / 3);
        const search = Math.max(8, Math.floor(Nw / 6)); // +/- rango de búsqueda
        const outStart = Math.max(0, ps - Lcorr);
        let bestDelta = 0;
        let bestCorr = -Infinity;
        for (let delta = -search; delta <= search; delta++) {
          const cand = pa + delta;
          if (cand < 0 || cand + Lcorr >= input.length) continue;
          // correlación simple entre la cola del out y la cabeza de la ventana candidata
          let corr = 0;
          for (let n = 0; n < Lcorr; n++) {
            const a = out[outStart + n] || 0;                  // ya acumulado
            const b = input[cand + n] || 0;
            corr += a * b;
          }
          if (corr > bestCorr) { bestCorr = corr; bestDelta = delta; }
        }

        const alignedPa = pa + bestDelta;
        for (let n = 0; n < Nw; n++) {
          const x = input[alignedPa + n] || 0;
          const v = x * win[n];
          out[ps + n] += v;
          wsum[ps + n] += win[n];
        }
        k++;
      }

      // Normalizar por solapamiento
      for (let i = 0; i < outLen; i++) if (wsum[i] > 1e-8) out[i] /= wsum[i];
      // Recortar ceros de cola
      let last = outLen - 1;
      while (last > 0 && Math.abs(out[last]) < 1e-6) last--;
      return out.slice(0, Math.max(Nw, last + 1));
    }

    // Etapa 1: pitch shifting por remuestreo
    const N = samples.length;
    let pitchedSamples;
    if (Math.abs(factor - 1) < 1e-6) {
      pitchedSamples = samples;
    } else {
      const M = Math.max(1, Math.floor(N / factor));
      pitchedSamples = new Array(M);
      for (let i = 0; i < M; i++) {
        const pos = i * factor;
        const i1 = Math.floor(pos);
        const t = pos - i1;
        const i0 = Math.max(0, i1 - 1);
        const i2 = Math.min(N - 1, i1 + 1);
        const i3 = Math.min(N - 1, i1 + 2);
        const p0 = samples[i0] || 0;
        const p1 = samples[i1] || 0;
        const p2 = samples[i2] || 0;
        const p3 = samples[i3] || 0;
        pitchedSamples[i] = cubic(p0, p1, p2, p3, t);
      }
    }

    // Etapa 2 (opcional): preservar duración vía time-stretch OLA
    let outSamples;
    if (preserveDuration && Math.abs(factor - 1) >= 1e-6) {
      const targetLen = N;
      const stretched = timeStretchWSOLA(pitchedSamples, factor);
      if (stretched.length >= targetLen) outSamples = stretched.slice(0, targetLen);
      else {
        outSamples = new Array(targetLen).fill(0);
        for (let i = 0; i < stretched.length; i++) outSamples[i] = stretched[i];
      }
    } else {
      outSamples = pitchedSamples;
    }

    // Fade corto a extremos
    const fade = Math.min(256, Math.floor(outSamples.length * 0.005));
    for (let i = 0; i < fade; i++) {
      const g = i / Math.max(1, fade);
      outSamples[i] *= g;
      outSamples[outSamples.length - 1 - i] *= g;
    }

    const nameNoExt = safe.replace(/\.wav$/i, '');
    const sign = st >= 0 ? '+' : '';
    const outName = `${nameNoExt}_ps${sign}${st}${preserveDuration ? '_pd' : ''}.wav`;
    const outPath = path.join(OUTPUT_DIR, outName);
    writeWav({ samples: outSamples, sampleRate, channels: 1, filePath: outPath });
    res.json({ ok: true, file: outName });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// NUEVO endpoints: KeySnap e IPFS
app.post('/api/effects/keysnap', async (req, res) => {
  try {
    const { file, targetKey = 0, scale = 'major' } = req.body || {};
    if (!file) return res.status(400).json({ ok: false, error: 'Parámetro "file" requerido' });
    const safe = path.basename(file);
    const srcPath = path.join(OUTPUT_DIR, safe);
    if (!fs.existsSync(srcPath)) return res.status(404).json({ ok: false, error: 'Archivo no encontrado en output' });
    const { readWav, writeWav } = require('./audio-renderer');
    const { samples, sampleRate } = readWav(srcPath);
    const base = safe.replace(/\.[^.]+$/, '');
    const outName = `${base}_keysnap_k${Number(targetKey)||0}_${String(scale).toLowerCase()}_tr+0.wav`;
    const outPath = path.join(OUTPUT_DIR, outName);
    writeWav({ samples, sampleRate, channels: 1, filePath: outPath });
    writeAnalytics({ type: 'keysnap', file: outName, data: { src: safe, targetKey: Number(targetKey)||0, scale, shift: 0 } });
    res.json({ ok: true, file: outName, url: `/output/${outName}` });
  } catch (e) {
    console.error('keysnap error:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.post('/api/ipfs/upload', async (req, res) => {
  try {
    const { file } = req.body || {};
    if (!file) return res.status(400).json({ ok: false, error: 'Parámetro "file" requerido' });
    const safe = path.basename(file);
    const srcPath = path.join(OUTPUT_DIR, safe);
    if (!fs.existsSync(srcPath)) return res.status(404).json({ ok: false, error: 'Archivo no encontrado en output' });

    const token = process.env.WEB3_STORAGE_TOKEN;
    if (!token) return res.status(500).json({ ok: false, error: 'Falta WEB3_STORAGE_TOKEN en variables de entorno del servidor' });

    let Web3Storage, File;
    try { ({ Web3Storage, File } = require('web3.storage')); }
    catch { return res.status(500).json({ ok: false, error: 'Dependencia web3.storage no instalada. Ejecuta: npm i web3.storage' }); }

    const client = new Web3Storage({ token });
    const data = fs.readFileSync(srcPath);
    const f = new File([data], safe);
    const cid = await client.put([f], { wrapWithDirectory: false, name: safe });
    const url = `https://w3s.link/ipfs/${cid}`;
    writeAnalytics({ type: 'ipfs_upload', file: safe, data: { cid } });
    res.json({ ok: true, cid, url });
  } catch (e) {
    console.error('ipfs upload error:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});
// Serve output files statically
app.use('/output', express.static(OUTPUT_DIR));
// NUEVO: servir comunidad (pulses, marketplace, remixhub en el futuro)
app.use('/community', express.static(COMMUNITY_DIR));

// NUEVO: Server-Sent Events para sync automático con el navegador
const sseClients = new Set();
let outputWatcherInitialized = false;
function initOutputWatcher() {
  if (outputWatcherInitialized) return;
  outputWatcherInitialized = true;
  try {
    fs.watch(OUTPUT_DIR, { persistent: true }, (eventType, filename) => {
      if (!filename) return;
      const exts = ['.wav', '.mp3', '.ogg', '.flac'];
      if (!exts.includes(path.extname(filename).toLowerCase())) return;
      const payload = JSON.stringify({ type: 'output_updated', file: filename, ev: eventType, ts: Date.now() });
      for (const res of sseClients) {
        try { res.write(`data: ${payload}\n\n`); } catch (_) {}
      }
    });
  } catch (e) {
    console.warn('fs.watch no disponible para OUTPUT_DIR:', e?.message || e);
  }
}
app.get('/api/sync/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  sseClients.add(res);
  initOutputWatcher();
  // saludo inicial
  const hello = JSON.stringify({ type: 'hello', ts: Date.now() });
  res.write(`data: ${hello}\n\n`);
  req.on('close', () => {
    sseClients.delete(res);
    try { res.end(); } catch (_) {}
  });
});

// NUEVO: Analytics endpoints
app.post('/api/analytics/event', async (req, res) => {
  try {
    const { type, sessionId, file, data } = req.body || {};
    if (!type) return res.status(400).json({ ok: false, error: 'type requerido' });
    writeAnalytics({ type, sessionId: sessionId || null, file: file || null, data: data || null });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});
app.get('/api/analytics/summary', async (req, res) => {
  try {
    if (!fs.existsSync(ANALYTICS_LOG)) return res.json({ ok: true, events: 0, byType: {}, byFile: {} });
    const text = fs.readFileSync(ANALYTICS_LOG, 'utf8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    const byType = {}; const byFile = {};
    for (const ln of lines) {
      try {
        const evt = JSON.parse(ln);
        const t = evt.type || 'unknown';
        byType[t] = (byType[t] || 0) + 1;
        const f = evt.file;
        if (f) byFile[f] = (byFile[f] || 0) + 1;
      } catch (_) {}
    }
    res.json({ ok: true, events: lines.length, byType, byFile });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: Pulsos semanales (Proactive Gemini MVP)
function readAnalyticsEvents(days = 7) {
  try {
    if (!fs.existsSync(ANALYTICS_LOG)) return [];
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const text = fs.readFileSync(ANALYTICS_LOG, 'utf8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    const evts = [];
    for (const ln of lines) {
      try {
        const evt = JSON.parse(ln);
        if (!evt.ts || evt.ts >= since) evts.push(evt);
      } catch (_) {}
    }
    return evts;
  } catch (_) {
    return [];
  }
}
function countBy(arr, key) { const m = {}; for (const x of arr) { const k = (x[key] || 'unknown'); m[k] = (m[k] || 0) + 1; } return m; }
function safeWriteJSON(filePath, obj) { fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8'); }
function pickTop(arr, n = 3) { return arr.slice(0, n); }
function extractQueries(evts) {
  const qs = [];
  for (const e of evts) {
    const d = e.data || {};
    const cands = [d.query, d.q, d.search, d.tag, d.tags];
    for (const c of cands) {
      if (!c) continue;
      if (Array.isArray(c)) { for (const v of c) if (v) qs.push(String(v).toLowerCase()); }
      else qs.push(String(c).toLowerCase());
    }
  }
  return qs;
}
function generatePulse(days = 7) {
  const evts = readAnalyticsEvents(days);
  const byType = countBy(evts, 'type');
  const queries = extractQueries(evts);
  const qJoined = queries.join(' ');

  // Heurísticas básicas
  const trends = [];
  if (byType.upload) trends.push(`Subiste ${byType.upload} archivo(s) esta semana.`);
  if (byType.mix_create) trends.push(`Creaste ${byType.mix_create} mezcla(s) con crossfade.`);
  if (byType.library_download) trends.push(`Incorporaste ${byType.library_download} pista(s) desde la biblioteca/remota.`);
  if (trends.length === 0) trends.push('Semana tranquila. No se detectaron actividades significativas.');

  const isLofi = /lo[-\s]?fi|lofi/.test(qJoined);
  const wantsDrums = /drum|drums|perc/.test(qJoined);

  const opportunities = [];
  if (byType.upload || byType.mix_create) {
    if (isLofi) opportunities.push('3 playlists potenciales: "Lo-Fi Beats", "Chill Vibes", "Study Lofi". ¿Preparo pitches?');
    else opportunities.push('3 playlists potenciales: "Indie Discover", "Fresh Finds", "Electronic Focus". ¿Preparo pitches?');
  }

  const actions = [];
  if (byType.upload) actions.push('Te puedo ayudar a preparar los pitches para playlists curadas basándome en tus nuevas subidas.');
  if (byType.mix_create) actions.push('¿Quieres publicar alguna mezcla como preview y generar snippets automáticos para redes?');
  if (actions.length === 0) actions.push('Sugerencia: usa la biblioteca para descubrir material nuevo y prueba el mixer/crossfade.');

  const learning = [];
  if (isLofi) learning.push('Veo interés por Lo-Fi. Puedo priorizar muestras y presets de ese género en tu biblioteca.');
  if (wantsDrums) learning.push('Sueles buscar drums. ¿Priorizar kits y one-shots de batería en las recomendaciones?');
  if (learning.length === 0) learning.push('Activa el modo Aprendizaje: iré personalizando recomendaciones a medida que interactúes.');

  const pulse = {
    ok: true,
    windowDays: days,
    period: { end: Date.now(), start: Date.now() - days * 24 * 60 * 60 * 1000 },
    metrics: { byType },
    insights: { trends, opportunities, actions, learning },
  };
  return pulse;
}

app.post('/api/pulses/generate', async (req, res) => {
  try {
    const { days = 7 } = req.body || {};
    const pulse = generatePulse(Number(days) || 7);
    const fname = `pulse_${Date.now()}.json`;
    const fpath = path.join(PULSES_DIR, fname);
    safeWriteJSON(fpath, pulse);
    res.json({ ...pulse, file: `/community/pulses/${fname}` });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});
app.get('/api/pulses/latest', async (req, res) => {
  try {
    if (!fs.existsSync(PULSES_DIR)) return res.json({ ok: true, found: false });
    const files = fs.readdirSync(PULSES_DIR).filter(f => f.endsWith('.json')).sort();
    if (files.length === 0) return res.json({ ok: true, found: false });
    const last = files[files.length - 1];
    const pulse = JSON.parse(fs.readFileSync(path.join(PULSES_DIR, last), 'utf8'));
    res.json({ ok: true, found: true, file: `/community/pulses/${last}`, pulse });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: BI endpoints (MVP heurístico)
function dayKey(ts) { try { return new Date(ts).toISOString().slice(0, 10); } catch (_) { return 'unknown'; } }
function daysRange(n) {
  const out = [];
  const end = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
app.post('/api/bi/ingest', async (req, res) => {
  try {
    const { events } = req.body || {};
    if (!Array.isArray(events) || events.length === 0) return res.status(400).json({ ok: false, error: 'events[] requerido' });
    let wrote = 0;
    for (const e of events) {
      if (!e || !e.type) continue;
      writeAnalytics({ type: e.type, sessionId: e.sessionId || null, file: e.file || null, data: e.data || null });
      wrote++;
    }
    res.json({ ok: true, ingested: wrote });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});
app.get('/api/bi/trends', async (req, res) => {
  try {
    const days = Number(req.query.days || 7) || 7;
    const evts = readAnalyticsEvents(days);
    const byType = countBy(evts, 'type');
    const byFile = {};
    for (const e of evts) { const f = e.file; if (f) byFile[f] = (byFile[f] || 0) + 1; }
    const queries = extractQueries(evts);
    const qFreq = {};
    for (const q of queries) qFreq[q] = (qFreq[q] || 0) + 1;
    const topFiles = Object.entries(byFile).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([file,count])=>({file,count}));
    const topQueries = Object.entries(qFreq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([q,count])=>({q,count}));

    const byDay = {};
    for (const e of evts) { const k = dayKey(e.ts || Date.now()); byDay[k] = (byDay[k] || 0) + 1; }
    const daysArr = daysRange(days);
    const daily = daysArr.map(d => ({ date: d, count: byDay[d] || 0 }));

    const hours = new Array(24).fill(0);
    for (const e of evts) { try { const h = new Date(e.ts || Date.now()).getHours(); hours[h]++; } catch (_) {} }

    res.json({ ok: true, windowDays: days, totals: { events: evts.length }, byType, topFiles, topQueries, dailyCounts: daily, hours });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});
app.get('/api/bi/audience-dna', async (req, res) => {
  try {
    const days = Number(req.query.days || 30) || 30;
    const evts = readAnalyticsEvents(days);
    const byType = countBy(evts, 'type');
    const queries = extractQueries(evts);
    const qFreq = {};
    for (const q of queries) qFreq[q] = (qFreq[q] || 0) + 1;
    const topTags = Object.entries(qFreq).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([tag,count])=>({tag,count}));

    const hours = new Array(24).fill(0);
    for (const e of evts) { try { const h = new Date(e.ts || Date.now()).getHours(); hours[h]++; } catch (_) {} }

    const sessions = {};
    for (const e of evts) { const s = e.sessionId || 'anon'; sessions[s] = (sessions[s] || 0) + 1; }
    const sessionList = Object.entries(sessions).map(([id,count])=>({id,count}));
    const totalSessions = sessionList.length;
    const returning = sessionList.filter(s => s.count > 1).length;

    res.json({ ok: true, windowDays: days, topActions: byType, audience: { tags: topTags, activityHours: hours }, sessions: { total: totalSessions, returning, new: Math.max(0, totalSessions - returning) } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});
app.get('/api/bi/roi', async (req, res) => {
  try {
    const days = Number(req.query.days || 30) || 30;
    const evts = readAnalyticsEvents(days);
    const byType = countBy(evts, 'type');
    const uploads = byType.upload || 0;
    const downloads = byType.library_download || 0;
    const outputs = (byType.mix_create || 0) + (byType.remix_submit || 0) + (byType.ipfs_upload || 0);

    const byDay = {};
    for (const e of evts) { const k = dayKey(e.ts || Date.now()); byDay[k] = (byDay[k] || 0) + 1; }
    const activeDays = Object.keys(byDay).length;

    const roi = {
      windowDays: days,
      uploads, downloads, outputs,
      productivityIndex: Number((outputs / Math.max(1, uploads)).toFixed(2)),
      efficiency: Number((outputs / Math.max(1, uploads + downloads)).toFixed(2)),
      velocity: Number((outputs / Math.max(1, activeDays)).toFixed(2)),
      conversions: {
        mixPerUpload: Number(((byType.mix_create || 0) / Math.max(1, uploads)).toFixed(2)),
        remixPerUpload: Number(((byType.remix_submit || 0) / Math.max(1, uploads)).toFixed(2)),
        ipfsPerUpload: Number(((byType.ipfs_upload || 0) / Math.max(1, uploads)).toFixed(2))
      }
    };
    res.json({ ok: true, roi });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: Remix Hub básico
function ensureDir(p) { if (!fs.existsSync(p)) { fs.mkdirSync(p, { recursive: true }); } }
app.post('/api/remixhub/create-experience', async (req, res) => {
  try {
    const { title = 'Experiencia', description = '', stems = [], owner = {} } = req.body || {};
    if (!Array.isArray(stems) || stems.length === 0) return res.status(400).json({ ok: false, error: 'Se requieren stems (nombres de archivos en /output)' });
    const id = 'exp_' + Date.now();
    const expDir = path.join(REMIXHUB_DIR, id);
    ensureDir(expDir);
    const manifest = {
      id, title, description,
      stems: stems.map(f => ({ file: path.basename(f), url: `/output/${path.basename(f)}` })),
      owner,
      createdAt: Date.now(), submissions: []
    };
    fs.writeFileSync(path.join(expDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    res.json({ ok: true, id, url: `/community/remixhub/${id}/manifest.json` });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});
app.get('/api/remixhub/experience/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const expDir = path.join(REMIXHUB_DIR, id);
    const mpath = path.join(expDir, 'manifest.json');
    if (!fs.existsSync(mpath)) return res.status(404).json({ ok: false, error: 'Experiencia no encontrada' });
    const manifest = JSON.parse(fs.readFileSync(mpath, 'utf8'));
    const sdir = path.join(expDir, 'submissions');
    let subs = [];
    if (fs.existsSync(sdir)) {
      const files = fs.readdirSync(sdir).filter(f => f.endsWith('.json'));
      for (const f of files) {
        try { subs.push(JSON.parse(fs.readFileSync(path.join(sdir, f), 'utf8'))); } catch (_) {}
      }
    }
    manifest.submissions = subs;
    res.json({ ok: true, manifest });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});
app.post('/api/remixhub/experience/:id/submit-remix', async (req, res) => {
  try {
    const id = req.params.id;
    const { file, author = {} } = req.body || {};
    if (!file) return res.status(400).json({ ok: false, error: 'Parámetro "file" requerido (nombre en /output)' });
    const safe = path.basename(file);
    const outPath = path.join(OUTPUT_DIR, safe);
    if (!fs.existsSync(outPath)) return res.status(404).json({ ok: false, error: 'Archivo no existe en /output' });
    const expDir = path.join(REMIXHUB_DIR, id);
    const mpath = path.join(expDir, 'manifest.json');
    if (!fs.existsSync(mpath)) return res.status(404).json({ ok: false, error: 'Experiencia no encontrada' });
    const sdir = path.join(expDir, 'submissions');
    ensureDir(sdir);
    const sid = 'sub_' + Date.now();
    const sub = { id: sid, file: safe, url: `/output/${safe}`, author, createdAt: Date.now() };
    fs.writeFileSync(path.join(sdir, sid + '.json'), JSON.stringify(sub, null, 2), 'utf8');
    writeAnalytics({ type: 'remix_submit', file: safe, data: { expId: id } });
    res.json({ ok: true, submission: sub });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: Mezcla/crossfade de dos pistas
app.post('/api/mix/crossfade', async (req, res) => {
  try {
    const { fileA, fileB, durationSec = 8 } = req.body || {};
    if (!fileA || !fileB) return res.status(400).json({ ok: false, error: 'Parámetros requeridos: fileA y fileB' });
    const safeA = path.basename(fileA);
    const safeB = path.basename(fileB);
    const aPath = path.join(OUTPUT_DIR, safeA);
    const bPath = path.join(OUTPUT_DIR, safeB);
    if (!fs.existsSync(aPath) || !fs.existsSync(bPath)) return res.status(404).json({ ok: false, error: 'Archivo(s) no encontrados en output' });

    const { readWav, writeWav } = require('./audio-renderer');
    const wa = readWav(aPath);
    const wb = readWav(bPath);
    if (wa.sampleRate !== wb.sampleRate) return res.status(400).json({ ok: false, error: 'Sample rate distinto entre archivos' });
    const sr = wa.sampleRate;

    const a = wa.samples;
    const b = wb.samples;
    const overlap = Math.max(1, Math.floor((Number(durationSec) || 8) * sr));
    const lenA = a.length;
    const lenB = b.length;
    const ov = Math.min(overlap, Math.min(lenA, lenB));

    const outLen = lenA + lenB - ov;
    const out = new Array(outLen).fill(0);

    // Copiar A hasta el inicio del solapamiento
    const aKeep = Math.max(0, lenA - ov);
    for (let i = 0; i < aKeep; i++) out[i] = a[i] || 0;

    // Zona de crossfade
    for (let j = 0; j < ov; j++) {
      const waOut = 1 - (j / (ov - 1 || 1));
      const wbIn = 1 - waOut;
      const ai = aKeep + j;
      const bi = j;
      const v = (a[ai] || 0) * waOut + (b[bi] || 0) * wbIn;
      out[aKeep + j] = Math.max(-1, Math.min(1, v));
    }

    // Resto de B
    for (let k = ov; k < lenB; k++) out[aKeep + k] = b[k] || 0;

    // Fade corto a extremos
    const fade = Math.min(256, Math.floor(out.length * 0.003));
    for (let i = 0; i < fade; i++) {
      const g = i / Math.max(1, fade);
      out[i] *= g;
      out[out.length - 1 - i] *= g;
    }

    const baseName = `${safeA.replace(/\.wav$/i, '')}__to__${safeB.replace(/\.wav$/i, '')}`;
    const outName = `mix_${baseName}_cf${Math.round(ov / sr)}s.wav`;
    const outPath = path.join(OUTPUT_DIR, outName);
    writeWav({ samples: out, sampleRate: sr, channels: 1, filePath: outPath });

    writeAnalytics({ type: 'mix_create', file: outName, data: { fileA: safeA, fileB: safeB, durationSec: Math.round(ov / sr) } });
    res.json({ ok: true, file: outName, url: `/output/${outName}` });
  } catch (e) {
    console.error('mix/crossfade error:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: Mezcla/crossfade de dos URLs WAV remotas
app.post('/api/mix/crossfade-urls', async (req, res) => {
  try {
    const { urlA, urlB, durationSec = 8 } = req.body || {};
    if (!urlA || !urlB) return res.status(400).json({ ok: false, error: 'Parámetros requeridos: urlA y urlB' });
    const urls = [urlA, urlB];

    async function downloadWav(u, idx) {
      if (!/^https?:\/\//i.test(u)) throw new Error('URL inválida: ' + u);
      let resp;
      try { resp = await fetch(u); } catch (e) { throw new Error('Fetch falló: ' + (e?.message || e)); }
      if (!resp.ok) throw new Error(`Descarga falló: HTTP ${resp.status}`);
      const ct = (resp.headers.get('content-type') || '').toLowerCase();
      // Solo WAV soportado
      const isWav = ct.includes('wav') || ct.includes('wave') || /\.wav(\?.*)?$/i.test(u);
      if (!isWav) throw new Error('Solo se admite WAV para mezcla por URL');
      let base = 'remote';
      try { base = path.basename(new URL(u).pathname) || 'remote'; } catch (_) {}
      base = base.replace(/[^\w.-]+/g, '_').replace(/\.[^.]+$/, '');
      const finalName = `dl_${Date.now()}_${idx}_${base}.wav`;
      const outPath = path.join(OUTPUT_DIR, finalName);
      await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(outPath);
        resp.body.on('error', reject);
        ws.on('error', reject);
        ws.on('finish', resolve);
        resp.body.pipe(ws);
      });
      return { name: finalName, path: outPath };
    }

    const a = await downloadWav(urls[0], 0);
    const b = await downloadWav(urls[1], 1);

    const { readWav, writeWav } = require('./audio-renderer');
    const wa = readWav(a.path);
    const wb = readWav(b.path);
    if (wa.sampleRate !== wb.sampleRate) return res.status(400).json({ ok: false, error: 'Sample rate distinto entre archivos' });
    const sr = wa.sampleRate;

    const overlap = Math.max(1, Math.floor((Number(durationSec) || 8) * sr));
    const A = wa.samples, B = wb.samples;
    const lenA = A.length, lenB = B.length;
    const ov = Math.min(overlap, Math.min(lenA, lenB));
    const outLen = lenA + lenB - ov;
    const out = new Array(outLen).fill(0);

    const aKeep = Math.max(0, lenA - ov);
    for (let i = 0; i < aKeep; i++) out[i] = A[i] || 0;
    for (let j = 0; j < ov; j++) {
      const waOut = 1 - (j / (ov - 1 || 1));
      const wbIn = 1 - waOut;
      const ai = aKeep + j;
      const bi = j;
      const v = (A[ai] || 0) * waOut + (B[bi] || 0) * wbIn;
      out[aKeep + j] = Math.max(-1, Math.min(1, v));
    }
    for (let k = ov; k < lenB; k++) out[aKeep + k] = B[k] || 0;

    const fade = Math.min(256, Math.floor(out.length * 0.003));
    for (let i = 0; i < fade; i++) {
      const g = i / Math.max(1, fade);
      out[i] *= g;
      out[out.length - 1 - i] *= g;
    }

    const baseName = `${a.name.replace(/\.wav$/i, '')}__to__${b.name.replace(/\.wav$/i, '')}`;
    const outName = `mix_${baseName}_cf${Math.round(ov / sr)}s.wav`;
    const outPath = path.join(OUTPUT_DIR, outName);
    writeWav({ samples: out, sampleRate: sr, channels: 1, filePath: outPath });

    writeAnalytics({ type: 'mix_create_urls', file: outName, data: { urlA, urlB, durationSec: Math.round(ov / sr) } });
    res.json({ ok: true, file: outName, url: `/output/${outName}` });
  } catch (e) {
    console.error('mix/crossfade-urls error:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: Sugerencias IA (o heurística) de transiciones
app.post('/api/ai/transitions', async (req, res) => {
  try {
    const { fileA, fileB } = req.body || {};
    if (!fileA || !fileB) return res.status(400).json({ ok: false, error: 'Parámetros requeridos: fileA y fileB' });
    const safeA = path.basename(fileA);
    const safeB = path.basename(fileB);
    const aPath = path.join(OUTPUT_DIR, safeA);
    const bPath = path.join(OUTPUT_DIR, safeB);
    if (!fs.existsSync(aPath) || !fs.existsSync(bPath)) return res.status(404).json({ ok: false, error: 'Archivo(s) no encontrados en output' });

    const { readWav } = require('./audio-renderer');
    const wa = readWav(aPath);
    const wb = readWav(bPath);
    const durA = wa.samples.length / wa.sampleRate;
    const durB = wb.samples.length / wb.sampleRate;
    const base = Math.floor(0.1 * Math.min(durA, durB));
    const crossfadeSec = Math.max(3, Math.min(12, base));
    const plan = {
      crossfadeSec,
      entryA: Math.max(0, durA - crossfadeSec),
      entryB: 0,
      notes: 'Heurística basada en 10% de la pista más corta, acotada a [3,12]s.'
    };
    res.json({ ok: true, plan, files: { a: safeA, b: safeB }, durations: { a: durA, b: durB } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: Obtener owner actual de un NFT
app.get('/api/hedera/nft/owner', async (req, res) => {
  try {
    const { tokenId, serial } = req.query || {};
    const { HEDERA_NETWORK = 'testnet', HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY } = process.env;
    if (!HEDERA_ACCOUNT_ID || !HEDERA_PRIVATE_KEY) {
      return res.status(400).json({ ok: false, error: 'Faltan credenciales de Hedera en .env (HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY)' });
    }
    if (!tokenId || serial === undefined) {
      return res.status(400).json({ ok: false, error: 'Parámetros requeridos: tokenId, serial' });
    }

    const client = (HEDERA_NETWORK.toLowerCase() === 'mainnet') ? Client.forMainnet() : Client.forTestnet();
    const operatorId = AccountId.fromString(HEDERA_ACCOUNT_ID);
    const operatorKey = PrivateKey.fromString(HEDERA_PRIVATE_KEY);
    client.setOperator(operatorId, operatorKey);

    let tId; try { tId = TokenId.fromString(String(tokenId)); } catch (_) {
      return res.status(400).json({ ok: false, error: 'tokenId inválido' });
    }
    const sn = Number(serial);
    if (!Number.isFinite(sn) || sn <= 0) {
      return res.status(400).json({ ok: false, error: 'serial inválido' });
    }

    const result = await new TokenNftInfoQuery().setNftId(new NftId(tId, sn)).execute(client);
    const info = Array.isArray(result) ? result[0] : result;
    if (!info) return res.status(404).json({ ok: false, error: 'NFT no encontrado' });

    const owner = info.accountId ? info.accountId.toString() : (info.owner ? info.owner.toString() : null);
    const spender = info.spenderId ? info.spenderId.toString() : undefined;
    const ledgerId = info.ledgerId && info.ledgerId.toString ? info.ledgerId.toString() : undefined;
    const meta = info.metadata ? (Buffer.isBuffer(info.metadata) ? info.metadata.toString('base64') : String(info.metadata)) : undefined;

    return res.json({ ok: true, tokenId: tId.toString(), serial: sn, owner, spender, ledgerId, metadataBase64: meta });
  } catch (e) {
    console.error('Hedera nft/owner error:', e?.message || e);
    res.status(500).json({ ok: false, error: 'Fallo en nft/owner: ' + (e?.message || e) });
  }
});

// Iniciar servidor
const serverInstance = app.listen(PORT, () => {
  const addr = serverInstance.address && serverInstance.address();
  const port = addr && typeof addr === 'object' ? addr.port : PORT;
  console.log(`Servidor escuchando en http://localhost:${port}`);
});

// NUEVO: Biblioteca - descargar archivo remoto en OUTPUT_DIR
app.post('/api/library/download', async (req, res) => {
  try {
    const { url, filename } = req.body || {};
    if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ ok: false, error: 'URL inválida' });

    let resp;
    try { resp = await fetch(url); } catch (e) { return res.status(500).json({ ok: false, error: 'Fetch falló: ' + (e?.message || e) }); }
    if (!resp.ok) return res.status(502).json({ ok: false, error: `Descarga falló: HTTP ${resp.status}` });

    const allowed = ['.mp3', '.ogg', '.flac', '.wav', '.m4a'];
    let baseFromUrl = '';
    try { baseFromUrl = path.basename(new URL(url).pathname) || ''; } catch (_) {}
    let base = (filename || baseFromUrl || 'track').replace(/[^\w.-]+/g, '_');
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    let ext = path.extname(base).toLowerCase();
    if (!ext || !allowed.includes(ext)) {
      if (ct.includes('mpeg')) ext = '.mp3';
      else if (ct.includes('ogg')) ext = '.ogg';
      else if (ct.includes('flac')) ext = '.flac';
      else if (ct.includes('wav') || ct.includes('wave')) ext = '.wav';
      else if (ct.includes('mp4') || ct.includes('m4a') || /\.m4a(\?.*)?$/i.test(url)) ext = '.m4a';
    }
    if (!allowed.includes(ext)) return res.status(400).json({ ok: false, error: 'Formato no soportado (se esperan MP3/OGG/FLAC/WAV/M4A)' });
    base = base.replace(/\.[^.]+$/, '');
    const finalName = `${base}_${Date.now()}${ext}`;
    const outPath = path.join(OUTPUT_DIR, finalName);

    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(outPath);
      resp.body.on('error', reject);
      ws.on('error', reject);
      ws.on('finish', resolve);
      resp.body.pipe(ws);
    });

    // Notificar analytics básico
    writeAnalytics({ type: 'library_download', file: finalName, data: { url } });
    res.json({ ok: true, file: finalName, url: `/output/${finalName}` });
  } catch (e) {
    console.error('library/download error:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: Música - búsqueda global (iTunes)
app.get('/api/music/search/itunes', async (req, res) => {
  try {
    const term = (req.query.term || '').toString().trim();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 15)));
    if (!term) return res.status(400).json({ ok: false, error: 'Falta parámetro term' });
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
    const resp = await fetch(url);
    if (!resp.ok) return res.status(502).json({ ok: false, error: `iTunes HTTP ${resp.status}` });
    const data = await resp.json();
    const results = (data.results || []).map(r => ({
      trackName: r.trackName,
      artistName: r.artistName,
      collectionName: r.collectionName,
      previewUrl: r.previewUrl,
      artworkUrl100: r.artworkUrl100,
      trackTimeMillis: r.trackTimeMillis,
      source: 'itunes'
    }));
    writeAnalytics({ type: 'music_search', file: null, data: { provider: 'itunes', term, count: results.length } });
    res.json({ ok: true, count: results.length, results });
  } catch (e) {
    console.error('music/search/itunes error:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: Subida de audio (WAV) por Base64
app.post('/api/library/upload', async (req, res) => {
  try {
    const body = req.body || {};
    let { name, dataBase64 } = body;
    if (!name || !dataBase64) return res.status(400).json({ ok: false, error: 'Requiere { name, dataBase64 }' });
    const safe = String(name).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const file = /\.wav$/i.test(safe) ? safe : safe + '.wav';
    // Soportar prefijos tipo data:audio/wav;base64,XXXXX
    const b64 = String(dataBase64).includes(',') ? String(dataBase64).split(',').pop() : String(dataBase64);
    let buf;
    try { buf = Buffer.from(b64.trim(), 'base64'); } catch (e) {
      return res.status(400).json({ ok: false, error: 'Base64 inválido' });
    }
    const outPath = path.join(outputDir, file);
    fs.writeFileSync(outPath, buf);
    try { analytics.logEvent('LIBRARY_UPLOAD', { file, bytes: buf.length }); } catch {}
    return res.json({ ok: true, name: file, file, url: `/output/${encodeURIComponent(file)}` });
  } catch (err) {
    console.error('Upload error', err);
    try { analytics.logEvent('LIBRARY_UPLOAD_ERROR', { error: String(err && err.message || err) }); } catch {}
    return res.status(500).json({ ok: false, error: 'Error subiendo WAV', detail: String(err && err.message || err) });
  }
});

// NUEVO: Análisis de audio (WAV) - BPM y tonalidad/escala
app.post('/api/library/analyze', async (req, res) => {
  try {
    const body = req.body || {};
    let { path: filePath, name } = body;
    if (!filePath && name) {
      const safe = name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      filePath = path.join(outputDir, safe);
    }
    if (!filePath) return res.status(400).json({ ok: false, error: 'Debes enviar { path } o { name } de un WAV' });
    const safePath = filePath.replace(/\.\.+/g, '.');
    if (!/\.wav$/i.test(safePath)) return res.status(400).json({ ok: false, error: 'Solo se soporta WAV para análisis' });

    // Cache: si ya existe el análisis, devolverlo
    try {
      const cacheDir = path.join(__dirname, 'community', 'library', 'analysis');
      fs.mkdirSync(cacheDir, { recursive: true });
      const cacheFile = path.join(cacheDir, path.basename(safePath).replace(/\.wav$/i, '') + '.analysis.json');
      if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        return res.json(cached);
      }
    } catch {}

    const { readWav } = require('./audio-renderer');
    const { samples, sampleRate } = readWav(safePath);
    if (!samples || !sampleRate) return res.status(400).json({ ok: false, error: 'No se pudo leer WAV' });

    function downsample(x, sr, target) {
      if (sr <= target) return { y: x, sr: sr };
      const ratio = Math.floor(sr / target) || 1;
      const N = Math.floor(x.length / ratio);
      const y = new Float32Array(N);
      for (let i = 0; i < N; i++) y[i] = x[i * ratio];
      return { y, sr: Math.floor(sr / ratio) };
    }

    function movingAverageAbs(x, win) {
      const N = x.length;
      const y = new Float32Array(N);
      let acc = 0;
      const w = Math.max(1, win|0);
      for (let i = 0; i < N; i++) {
        const v = Math.abs(x[i]);
        acc += v;
        if (i >= w) acc -= Math.abs(x[i - w]);
        y[i] = acc / Math.min(i + 1, w);
      }
      return y;
    }

    function autocorrBPM(x, sr, bpmMin = 60, bpmMax = 200) {
      const minLag = Math.floor(sr * 60 / bpmMax);
      const maxLag = Math.floor(sr * 60 / bpmMin);
      const N = x.length;
      let bestLag = minLag;
      let bestVal = -Infinity;
      let mean = 0;
      for (let i = 0; i < N; i++) mean += x[i];
      mean /= N;
      for (let i = 0; i < N; i++) x[i] -= mean;
      let denom = 1e-9;
      for (let i = 0; i < N; i++) denom += x[i] * x[i];
      for (let lag = minLag; lag <= maxLag; lag++) {
        let s = 0;
        for (let n = lag; n < N; n++) s += x[n] * x[n - lag];
        const val = s / denom;
        if (val > bestVal) { bestVal = val; bestLag = lag; }
      }
      let bpm = 60 * sr / bestLag;
      while (bpm > 180) bpm /= 2;
      while (bpm < 70) bpm *= 2;
      return { bpm, confidence: Math.max(0, Math.min(1, bestVal)) };
    }

    function goertzelPower(x, sr, freq) {
      const w = 2 * Math.PI * freq / sr;
      const coeff = 2 * Math.cos(w);
      let s0 = 0, s1 = 0, s2 = 0;
      for (let n = 0; n < x.length; n++) {
        s0 = x[n] + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
      }
      const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
      return Math.max(0, power);
    }

    function estimateKeyKrumhansl(x, sr) {
      const target = 4000;
      const ds = downsample(x, sr, target);
      const sig = ds.y;
      const sr2 = ds.sr;
      const chroma = new Array(12).fill(0);
      const C1 = 32.703195662574764;
      const nyq = sr2 / 2;
      for (let i = 0; i < 72; i++) {
        const f = C1 * Math.pow(2, i / 12);
        if (f >= 40 && f < nyq) {
          const pc = i % 12;
          chroma[pc] += goertzelPower(sig, sr2, f);
        }
      }
      const maxC = Math.max(1e-9, ...chroma);
      for (let i = 0; i < 12; i++) chroma[i] = chroma[i] / maxC;

      const maj = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
      const min = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
      function norm(v){
        const m = Math.sqrt(v.reduce((a,b)=>a+b*b,0))||1;
        return v.map(x=>x/m);
      }
      const chromaN = norm(chroma);
      const majN = norm(maj);
      const minN = norm(min);
      function corr(a,b){ return a.reduce((s,v,i)=>s+v*b[i],0); }
      function rotate(v,k){ const n=v.length; return v.map((_,i)=>v[(i-k+n)%n]); }
      const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      let best = { scale: 'major', rootIdx: 0, score: -Infinity };
      let second = { score: -Infinity };
      for (let k = 0; k < 12; k++) {
        const majR = rotate(majN, k);
        const minR = rotate(minN, k);
        const sMaj = corr(chromaN, majR);
        const sMin = corr(chromaN, minR);
        const candMaj = { scale: 'major', rootIdx: k, score: sMaj };
        const candMin = { scale: 'minor', rootIdx: k, score: sMin };
        for (const cand of [candMaj, candMin]) {
          if (cand.score > best.score) { second = best; best = cand; }
          else if (cand.score > second.score) { second = cand; }
        }
      }
      const confidence = Math.max(0, Math.min(1, (best.score - second.score) / (Math.abs(best.score)+1e-6)));
      return { root: names[best.rootIdx], index: best.rootIdx, scale: best.scale, confidence, chroma };
    }

    const ds1 = downsample(samples, sampleRate, 11025);
    const env = movingAverageAbs(ds1.y, Math.round(ds1.sr * 0.05));
    const bpmRes = autocorrBPM(env, ds1.sr);

    const keyRes = estimateKeyKrumhansl(samples, sampleRate);

    const result = {
      ok: true,
      file: path.basename(safePath),
      sampleRate,
      durationSec: samples.length / sampleRate,
      bpm: { value: Math.round(bpmRes.bpm), confidence: Number(bpmRes.confidence.toFixed(3)) },
      key: { root: keyRes.root, index: keyRes.index, scale: keyRes.scale, confidence: Number(keyRes.confidence.toFixed(3)) },
      chroma: keyRes.chroma.map(v=>Number(v.toFixed(4))),
      method: 'autocorrelation+goertzel-krumhansl'
    };

    try { analytics.logEvent('LIBRARY_ANALYZE', { file: result.file, bpm: result.bpm.value, key: result.key.root, scale: result.key.scale, dur: result.durationSec }); } catch {}
    try {
      const dir = path.join(__dirname, 'community', 'library', 'analysis');
      fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, result.file.replace(/\.wav$/i, '') + '.analysis.json');
      fs.writeFileSync(out, JSON.stringify(result, null, 2));
    } catch {}

    return res.json(result);
  } catch (err) {
    console.error('Analyze error', err);
    try { analytics.logEvent('LIBRARY_ANALYZE_ERROR', { error: String(err && err.message || err) }); } catch {}
    return res.status(500).json({ ok: false, error: 'Error analizando WAV', detail: String(err && err.message || err) });
  }
});

// NUEVO: Fingerprint simple (WAV)
function computeSimpleFingerprintFloat32(samples, buckets = 256) {
  const n = samples.length;
  const size = Math.max(1, Math.floor(n / buckets));
  const vec = new Float32Array(buckets);
  for (let i = 0; i < buckets; i++) {
    const start = i * size;
    const end = Math.min(n, start + size);
    if (start >= n) break;
    let sum = 0;
    for (let j = start; j < end; j++) sum += Math.abs(samples[j] || 0);
    vec[i] = sum / Math.max(1, (end - start));
  }
  // normalizar L2
  let norm = 0;
  for (let i = 0; i < buckets; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < buckets; i++) vec[i] /= norm;
  return Array.from(vec);
}
function cosineSim(a, b) {
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] || 0, y = b[i] || 0; dot += x*y; na += x*x; nb += y*y; }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}

app.post('/api/library/fingerprint', async (req, res) => {
  try {
    const { file, buckets = 256 } = req.body || {};
    if (!file) return res.status(400).json({ ok: false, error: 'Falta parámetro file' });
    const safe = path.basename(file);
    const fpath = path.join(OUTPUT_DIR, safe);
    if (!fs.existsSync(fpath)) return res.status(404).json({ ok: false, error: 'Archivo no encontrado en output' });
    if (!/\.wav$/i.test(safe)) return res.status(400).json({ ok: false, error: 'Solo se soporta WAV para fingerprint' });
    const { readWav } = require('./audio-renderer');
    const { samples, sampleRate } = readWav(fpath);
    const fp = computeSimpleFingerprintFloat32(samples, Math.max(16, Math.min(1024, Number(buckets) || 256)));
    const dir = path.join(COMMUNITY_DIR, 'library', 'fingerprints');
    ensureDir(dir);
    const meta = { file: safe, sampleRate, buckets: fp.length, createdAt: Date.now(), fp };
    const out = path.join(dir, safe.replace(/\.wav$/i, '') + '.json');
    fs.writeFileSync(out, JSON.stringify(meta, null, 2), 'utf8');
    writeAnalytics({ type: 'fingerprint_create', file: safe });
    res.json({ ok: true, fingerprint: { buckets: fp.length, path: out } });
  } catch (e) {
    console.error('library/fingerprint error:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.post('/api/library/check-copyright', async (req, res) => {
  try {
    const { fileA, fileB, threshold = 0.92, buckets = 256 } = req.body || {};
    if (!fileA || !fileB) return res.status(400).json({ ok: false, error: 'Faltan fileA y fileB' });
    const safeA = path.basename(fileA);
    const safeB = path.basename(fileB);
    const aPath = path.join(OUTPUT_DIR, safeA);
    const bPath = path.join(OUTPUT_DIR, safeB);
    if (!fs.existsSync(aPath) || !fs.existsSync(bPath)) return res.status(404).json({ ok: false, error: 'Archivo(s) no encontrados en output' });
    if (!/\.wav$/i.test(safeA) || !/\.wav$/i.test(safeB)) return res.status(400).json({ ok: false, error: 'Solo se soporta WAV para comparación' });
    const { readWav } = require('./audio-renderer');
    const wa = readWav(aPath);
    const wb = readWav(bPath);
    const buck = Math.max(16, Math.min(1024, Number(buckets) || 256));
    const fpa = computeSimpleFingerprintFloat32(wa.samples, buck);
    const fpb = computeSimpleFingerprintFloat32(wb.samples, buck);
    const sim = cosineSim(fpa, fpb);
    const thr = Math.max(0, Math.min(1, Number(threshold)));
    const potentialCopy = sim >= thr;
    writeAnalytics({ type: 'copyright_check', file: null, data: { fileA: safeA, fileB: safeB, sim: Number(sim.toFixed(4)), thr } });
    res.json({ ok: true, similarity: Number(sim.toFixed(6)), threshold: thr, potentialCopy });
  } catch (e) {
    console.error('library/check-copyright error:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: Búsqueda en GitHub (code search)
app.get('/api/github/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ ok: false, error: 'Falta parámetro q' });
    const type = (req.query.type || 'code').toString();
    const perPage = Math.min(30, Math.max(1, Number(req.query.per_page || 15)));

    let ghq = q;
    if (!/extension:\w+/i.test(ghq)) ghq += ' extension:wav';

    const url = `https://api.github.com/search/${type}?q=${encodeURIComponent(ghq)}&per_page=${perPage}`;
    const headers = {
      'User-Agent': 'AetherSoundApp',
      'Accept': 'application/vnd.github+json'
    };
    const token = (process.env.GITHUB_TOKEN || '').trim();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let resp;
    try { resp = await fetch(url, { headers }); } catch (e) {
      return res.status(500).json({ ok: false, error: 'Fetch GitHub falló: ' + (e?.message || e) });
    }
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ ok: false, error: `GitHub ${resp.status}: ${text}` });
    }
    const data = await resp.json();
    const items = (data.items || []).map(it => {
      const repoFull = (it.repository && it.repository.full_name) || '';
      const path = it.path || '';
      const sha = it.sha || '';
      let raw_url = '';
      if (repoFull && path && sha) raw_url = `https://raw.githubusercontent.com/${repoFull}/${sha}/${path}`;
      return {
        name: it.name,
        path,
        sha,
        html_url: it.html_url,
        repository_full_name: repoFull,
        raw_url
      };
    });
    res.json({ ok: true, query: ghq, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NUEVO: Utilidad slugify para IDs legibles
function slugify(input) {
  const s = String(input || '').toLowerCase().trim();
  const basic = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const slug = basic.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return slug || ('item-' + Date.now());
}

// NUEVO: Créditos - guardar manifiesto
app.post('/api/credits/save', async (req, res) => {
  try {
    const b = req.body || {};
    const title = (b.title || '').toString().trim();
    const artist = (b.artist || '').toString().trim();
    if (!title || !artist) return res.status(400).json({ ok: false, error: 'Título y Artista son obligatorios' });
    let id = (b.id || '').toString().trim();
    if (!id) id = slugify(`${artist}-${title}`);
    id = id.replace(/[^a-z0-9-_]/gi, '');

    const manifest = {
      id,
      title, artist,
      cover: b.cover || '',
      isrc: b.isrc || '',
      iswc: b.iswc || '',
      upc: b.upc || '',
      spotify: b.spotify || '',
      apple: b.apple || '',
      youtube: b.youtube || '',
      instagram: b.instagram || '',
      website: b.website || '',
      contact: b.contact || '',
      notes: b.notes || '',
      people: Array.isArray(b.people) ? b.people.map(x => ({ role: x.role || '', name: x.name || '' })) : [],
      splits: Array.isArray(b.splits) ? b.splits.map(x => ({ party: x.party || '', bps: Number(x.bps) || 0 })) : [],
      updatedAt: Date.now()
    };

    ensureDir(CREDITS_DIR);
    const p = path.join(CREDITS_DIR, `${id}.json`);
    await fs.promises.writeFile(p, JSON.stringify(manifest, null, 2), 'utf8');
    writeAnalytics({ type: 'credits_save', file: `${id}.json` });
    res.json({ ok: true, id, path: `/community/credits/${id}.json` });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});