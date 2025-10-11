// Encapsular toda la lógica cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {

  // --- INICIO: LÓGICA PARA ORQUESTACIÓN IA Y GESTIÓN DE CLAVES (NUEVO) ---

  // Elementos del panel de Ajustes de API
  const saveApiKeysButton = document.getElementById('saveApiKeysButton');
  const geminiApiKeyInput = document.getElementById('geminiApiKey');
  const openaiApiKeyInput = document.getElementById('openaiApiKey');

  // Elementos del panel de Orquestación IA (Asegúrate que los IDs coincidan con tu HTML)
  // Tu panel se llama "Orquestación IA", pero los IDs internos son `ai-query`, `btn-ai`, etc.
  // Vamos a re-utilizar `btn-ai` como el botón de generar.
  const generateWithAIButton = document.getElementById('btn-ai');
  const aiPromptInput = document.getElementById('ai-query'); // Reutilizamos este input para el prompt

  // Necesitamos un selector de modelo que no está en tu HTML actual. Lo crearemos dinámicamente.
  const aiOrchestrationPanel = document.querySelector('#ai-query')?.closest('.panel');
  let aiModelSelect;
  if (aiOrchestrationPanel) {
    aiModelSelect = document.createElement('select');
    aiModelSelect.id = 'aiModelSelect';
    aiModelSelect.innerHTML = `
          <option value="gemini">Gemini (Google)</option>
          <option value="openai">ChatGPT (OpenAI)</option>
      `;
    // Insertar el selector antes del input del prompt
    const formRow = aiOrchestrationPanel.querySelector('.form-row');
    if (formRow) {
      const promptLabel = formRow.querySelector('label');
      const selectLabel = document.createElement('label');
      selectLabel.textContent = 'Modelo IA';
      selectLabel.appendChild(aiModelSelect);
      formRow.insertBefore(selectLabel, promptLabel);
    }
  }

  // --- Cargar claves guardadas al iniciar ---
  function loadApiKeys() {
    const geminiKey = localStorage.getItem('geminiApiKey');
    const openaiKey = localStorage.getItem('openaiApiKey');
    if (geminiKey && geminiApiKeyInput) geminiApiKeyInput.value = geminiKey;
    if (openaiKey && openaiApiKeyInput) openaiApiKeyInput.value = openaiKey;
  }

  // --- Guardar claves en localStorage ---
  if (saveApiKeysButton) {
    saveApiKeysButton.addEventListener('click', () => {
      if (geminiApiKeyInput && geminiApiKeyInput.value) {
        localStorage.setItem('geminiApiKey', geminiApiKeyInput.value);
      }
      if (openaiApiKeyInput && openaiApiKeyInput.value) {
        localStorage.setItem('openaiApiKey', openaiApiKeyInput.value);
      }
      toast('¡Claves guardadas en tu navegador!', { type: 'success' });
    });
  }

  // --- Lógica de Generación con IA (BYOK) ---
  if (generateWithAIButton) {
    // Cambiamos el texto del botón para que sea más claro
    generateWithAIButton.textContent = 'Generar con IA';
    generateWithAIButton.addEventListener('click', async () => {
      const model = aiModelSelect.value;
      const prompt = aiPromptInput.value;
      const userApiKey = localStorage.getItem(`${model}ApiKey`);

      if (!userApiKey) {
        toast(`Por favor, guarda una API Key para ${model} en los Ajustes.`, { type: 'error' });
        return;
      }
      if (!prompt) {
        toast('Por favor, describe la música que quieres crear.', { type: 'error' });
        return;
      }

      const stopLoading = setLoading(generateWithAIButton, 'Generando...');
      try {
        const result = await callApi('/api/generate', {
          method: 'POST',
          body: JSON.stringify({ model, apiKey: userApiKey, prompt })
        });
        toast(`¡Música generada con ${result.modelUsed}!`, { type: 'success' });
        await refreshList(); // Refrescar la lista de salidas
      } catch (err) {
        toast(`Error en la generación: ${err.message}`, { type: 'error' });
      } finally {
        stopLoading();
      }
    });
  }

  // Cargar las claves al iniciar la página
  loadApiKeys();

  // --- FIN: LÓGICA PARA ORQUESTACIÓN IA ---

  async function callApi(path, opts = {}) {
    const res = await fetch(path, { method: 'GET', ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (!res.ok) throw new Error('Error de red');
    return res.json();
  }

  const selectedFiles = new Set();

  // --- Sistema de Notificaciones "Toast" ---
  function toast(msg, { type = 'info', duration = 3000 } = {}) {
    let cont = document.getElementById('toast-container');
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'toast-container';
      cont.className = 'toast-container';
      document.body.appendChild(cont);
    }
    const div = document.createElement('div');
    div.className = `toast ${type}`; // 'info', 'success', 'error'
    div.textContent = msg;
    cont.appendChild(div);
    requestAnimationFrame(() => div.classList.add('show'));
    setTimeout(() => {
      div.classList.remove('show');
      setTimeout(() => div.remove(), 300);
    }, duration);
  }
  window.__toast = toast; // Exponer globalmente si es necesario

  async function refreshList() {
    const list = document.getElementById('output-list');
    list.innerHTML = '<li>Cargando...</li>';
    try {
      const data = await callApi('/api/output');
      // Filtro en vivo por texto
      const filterVal = ((document.getElementById('output-filter') || {}).value || '').toLowerCase().trim();
      const files = (data.files || []).filter(f => !filterVal || f.toLowerCase().includes(filterVal));
      if (!files || files.length === 0) {
        list.innerHTML = (data.files && data.files.length)
          ? '<li>No hay archivos que coincidan.</li>'
          : '<li>No hay archivos aún.</li>';
        return;
      }
      list.innerHTML = '';
      files.forEach(f => {
        const li = document.createElement('li');
        const semitoneInputId = `semi-${f.replace(/[^a-z0-9]/gi, '_')}`;
        li.innerHTML = `
          <label class="track">
            <input type="checkbox" class="track-check" data-file="${f}" ${selectedFiles.has(f) ? 'checked' : ''}/>
            <span>${f}</span>
          </label>
          <span class="audio-actions">
            <audio controls src="/output/${f}" preload="none"></audio>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;">
              ±semitonos <input id="${semitoneInputId}" type="number" value="0" step="1" min="-12" max="12" style="width:64px;">
              <button class="btn-pitch" data-file="${f}" data-target="${semitoneInputId}">Pitch Shift</button>
            </label>
            <a class="link" href="/output/${f}" download>Descargar</a>
            <span style="display:inline-flex; gap:6px; margin-left:8px;">
              <button class="btn-load-a" data-file="${f}" title="Cargar en Deck A">A</button>
              <button class="btn-load-b" data-file="${f}" title="Cargar en Deck B">B</button>
            </span>
          </span>
        `;
        // Hacer arrastrable los ítems para drop en Decks
        li.setAttribute('draggable', 'true');
        li.addEventListener('dragstart', (e) => {
          try {
            e.dataTransfer.setData('text/aether-output-file', f);
            e.dataTransfer.setData('text/plain', f);
            e.dataTransfer.effectAllowed = 'copy';
          } catch {}
        });
        // Doble clic: cargar en Deck A por defecto; Shift + doble clic: cargar en Deck B
        try {
          li.title = 'Doble clic: cargar en Deck A (Shift: Deck B)';
        } catch {}
        li.addEventListener('dblclick', (e) => {
          try {
            if (e.shiftKey) {
              if (typeof deckB !== 'undefined' && deckB) deckB.setSrc(`/output/${encodeURIComponent(f)}`);
            } else {
              if (typeof deckA !== 'undefined' && deckA) deckA.setSrc(`/output/${encodeURIComponent(f)}`);
            }
          } catch {}
        });
        list.appendChild(li);
        // Resaltar si es el último nuevo archivo detectado por SSE
        if (window.__lastNewFile && window.__lastNewFile === f) {
          try {
            li.classList.add('new-pulse');
            setTimeout(() => {
              try {
                li.classList.remove('new-pulse');
              } catch {}
            }, 4000);
          } catch {}
        }
        // Botones por elemento para cargar en Decks
        const btnA = li.querySelector('.btn-load-a');
        if (btnA) {
          btnA.addEventListener('click', () => {
            if (typeof deckA !== 'undefined' && deckA) deckA.setSrc(`/output/${encodeURIComponent(f)}`);
          });
        }
        const btnB = li.querySelector('.btn-load-b');
        if (btnB) {
          btnB.addEventListener('click', () => {
            if (typeof deckB !== 'undefined' && deckB) deckB.setSrc(`/output/${encodeURIComponent(f)}`);
          });
        }
      });

      // Escuchar cambios de checks
      document.querySelectorAll('.track-check').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const file = e.target.getAttribute('data-file');
          if (e.target.checked) selectedFiles.add(file);
          else selectedFiles.delete(file);
        });
      });

      // Acciones de pitch-shift
      document.querySelectorAll('.btn-pitch').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const file = e.currentTarget.getAttribute('data-file');
          const inputId = e.currentTarget.getAttribute('data-target');
          const semi = parseInt((document.getElementById(inputId) || { value: '0' }).value || '0', 10);
          const prev = e.currentTarget.textContent;
          try {
            e.currentTarget.disabled = true; e.currentTarget.textContent = 'Procesando...';
            const data = await callApi('/api/effects/pitch-shift', { method: 'POST', body: JSON.stringify({ file, semitones: semi }) });
            toast(data.ok ? `Listo: ${data.file}` : (data.error || 'Error en pitch-shift'), { type: data.ok ? 'success' : 'error' });
            await refreshList();
          } catch (err) {
            toast(`Error: ${err.message}`, { type: 'error' });
          } finally {
            e.currentTarget.disabled = false; e.currentTarget.textContent = prev;
          }
        });
      });
    } catch (err) {
      list.innerHTML = `<li>Error: ${err.message}</li>`;
    }
  }

  // Exponer refresco global y filtro
  try {
    window.refreshOutputList = refreshList;
  } catch {}
  const outFilterEl = document.getElementById('output-filter');
  if (outFilterEl && !outFilterEl.dataset.bound) {
    outFilterEl.addEventListener('input', refreshList); outFilterEl.dataset.bound = '1';
  }

  async function generate(type) {
    let endpoint;
    if (type === 'composition') endpoint = '/api/generate/composition';
    else if (type === 'drums') endpoint = '/api/generate/drums';
    else if (type === 'synth') endpoint = '/api/generate/synth';
    else throw new Error('Tipo desconocido');
    const idMap = { composition: 'btn-composition', drums: 'btn-drums', synth: 'btn-synth' };
    const btn = document.getElementById(idMap[type]);
    const prevText = btn.textContent;
    try {
      btn.disabled = true; btn.textContent = 'Generando...';
      await callApi(endpoint, { method: 'POST' });
      await refreshList();
      toast(`${type} generado!`, { type: 'success' });
    } catch (err) {
      toast(`Error: ${err.message}`, { type: 'error' });
    } finally {
      btn.disabled = false; btn.textContent = prevText;
    }
  }

  function renderSources(sources) {
    const ul = document.getElementById('sources-list');
    ul.innerHTML = '';
    if (!sources || sources.length === 0) {
      ul.innerHTML = '<li>Sin fuentes</li>';
      return;
    }
    for (const s of sources) {
      const li = document.createElement('li');
      li.innerHTML = `<a class="link" href="${s.url}" target="_blank">${s.title || s.url}</a><div class="snippet">${s.snippet || ''}</div>`;
      ul.appendChild(li);
    }
  }

  function renderPlan(plan) {
    const pre = document.getElementById('plan-pre');
    pre.textContent = JSON.stringify(plan || {}, null, 2);
  }

  async function aiSearchCompose() {
    const btn = document.getElementById('btn-ai');
    const q = document.getElementById('ai-query').value || 'worldwide tracks fusion';
    const max = parseInt(document.getElementById('ai-max').value || '10', 10);
    if (btn) btn.disabled = true;
    try {
      const res = await fetch('/api/ai/search-compose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, maxItems: max }) });
      const data = await res.json();
      console.log('AI result', data);
      renderSources(data.sources);
      renderPlan(data.plan);
      await refreshList();
      toast(data.ok ? 'Plan de IA generado y audios listos' : `Error de IA: ${data.error || ''}`, { type: data.ok ? 'success' : 'error' });
    } catch (err) {
      console.error(err);
      toast(`Error IA: ${err.message}`, { type: 'error' });
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function createAlbum() {
    const title = document.getElementById('album-title').value || 'Mi Álbum';
    const artist = document.getElementById('album-artist').value || 'Aether';
    const desc = document.getElementById('album-desc').value || '';
    const tracks = Array.from(selectedFiles);
    if (tracks.length === 0) {
      toast('Selecciona al menos una pista para crear el álbum.', { type: 'error' });
      return;
    }
    const btn = document.getElementById('btn-create-album');
    const result = document.getElementById('album-result');
    try {
      btn.disabled = true; btn.textContent = 'Creando Álbum...';
      const data = await callApi('/api/album/create', { method: 'POST', body: JSON.stringify({ title, artist, description: desc, tracks }) });
      toast(data.ok ? `Manifiesto de álbum creado: ${data.albumId}` : `Error: ${data.error}`, { type: data.ok ? 'success' : 'error' });
      result.textContent = data.ok ? `Álbum creado: ${data.albumId || 'pendiente'}` : (data.error || 'Error creando álbum');
      if (data.ok && data.albumId) {
        const mintBtn = document.getElementById('btn-mint-hedera');
        const pubBtn = document.getElementById('btn-publish-spotify');
        if (mintBtn) {
          mintBtn.disabled = false; mintBtn.dataset.albumId = data.albumId;
        }
        if (pubBtn) {
          pubBtn.disabled = false; pubBtn.dataset.albumId = data.albumId;
        }
      }
    } catch (err) {
      result.textContent = `Error: ${err.message}`;
    } finally {
      btn.disabled = false; btn.textContent = 'Crear Álbum';
    }
  }

  // Mint en Hedera (placeholder)
  const btnMint = document.getElementById('btn-mint-hedera');
  if (btnMint) {
    btnMint.addEventListener('click', async () => {
      const albumId = btnMint.dataset.albumId;
      if (!albumId) {
        toast('Crea un álbum primero.', { type: 'error' }); return;
      }
      btnMint.disabled = true; const prev = btnMint.textContent; btnMint.textContent = 'Minteando...';
      try {
        const data = await callApi('/api/hedera/mint', { method: 'POST', body: JSON.stringify({ albumId }) });
        const resultEl = document.getElementById('publish-result');
        if (resultEl) {
          toast(data.ok ? `¡Álbum minteado! Token ID: ${data.tokenId}` : `Error: ${data.error}`, { type: data.ok ? 'success' : 'error' });
          if (data.ok) {
            resultEl.textContent = `¡Éxito! Token ID: ${data.tokenId}. Serials: ${data.serials.join(', ')}`;
          } else {
            resultEl.textContent = `Error: ${data.error || JSON.stringify(data)}`;
          }
        }
      } catch (err) {
        (document.getElementById('publish-result') || {}).textContent = `Error: ${err.message}`;
      } finally {
        btnMint.disabled = false; btnMint.textContent = prev;
      }
    });
  }

  // Publicar en Spotify (placeholder)
  const btnSp = document.getElementById('btn-publish-spotify');
  if (btnSp) {
    btnSp.addEventListener('click', async () => {
      const albumId = btnSp.dataset.albumId;
      if (!albumId) {
        toast('Crea un álbum primero.', { type: 'error' }); return;
      }
      btnSp.disabled = true; const prev = btnSp.textContent; btnSp.textContent = 'Publicando...';
      try {
        const data = await callApi('/api/spotify/publish', { method: 'POST', body: JSON.stringify({ albumId }) });
        const resultEl = document.getElementById('publish-result');
        if (resultEl) {
          toast(data.ok ? 'Publicado en Spotify (simulado)' : `Error: ${data.error}`, { type: data.ok ? 'success' : 'error' });
          if (data.ok) {
            resultEl.textContent = `¡Éxito! Token ID: ${data.tokenId}. Serials: ${data.serials.join(', ')}`;
          } else {
            resultEl.textContent = `Error: ${data.error || JSON.stringify(data)}`;
          }
        }
      } catch (err) {
        (document.getElementById('publish-result') || {}).textContent = `Error: ${err.message}`;
      } finally {
        btnSp.disabled = false; btnSp.textContent = prev;
      }
    });
  }
  document.getElementById('btn-composition').addEventListener('click', () => generate('composition'));
  document.getElementById('btn-drums').addEventListener('click', () => generate('drums'));
  document.getElementById('btn-synth').addEventListener('click', () => generate('synth'));
  document.getElementById('btn-refresh').addEventListener('click', refreshList);
  const btnAi = document.getElementById('btn-ai');
  if (btnAi) btnAi.addEventListener('click', aiSearchCompose);
  const btnAlbum = document.getElementById('btn-create-album');
  if (btnAlbum) btnAlbum.addEventListener('click', createAlbum);

  // Batch pitch shift para seleccionados
  const btnBatch = document.getElementById('btn-batch-pitch');
  if (btnBatch) {
    btnBatch.addEventListener('click', async () => {
      const semi = parseInt((document.getElementById('batch-semi') || { value: '0' }).value || '0', 10);
      const preserve = !!((document.getElementById('batch-preserve') || {}).checked);
      if (selectedFiles.size === 0) {
        toast('No hay pistas seleccionadas.', { type: 'error' }); return;
      }
      btnBatch.disabled = true; const prev = btnBatch.textContent; btnBatch.textContent = 'Procesando...';
      try {
        for (const f of Array.from(selectedFiles)) {
          await callApi('/api/effects/pitch-shift', { method: 'POST', body: JSON.stringify({ file: f, semitones: semi, preserveDuration: preserve }) });
        }
        await refreshList();
        toast('Pitch Shift aplicado a seleccionados.', { type: 'success' });
      } catch (err) {
        toast(`Error: ${err.message}`, { type: 'error' });
      } finally {
        btnBatch.disabled = false; btnBatch.textContent = prev;
      }
    });
  }

  // NUEVO: UI Hedera - listeners y helpers
  const hederaResult = document.getElementById('hedera-result');

  function setHStatus(msg) {
    if (hederaResult) hederaResult.textContent = msg;
  }

  function getHInputs() {
    return {
      accountId: (document.getElementById('hedera-account') || {}).value || '',
      tokenId: (document.getElementById('hedera-token') || {}).value || '',
      serial: (document.getElementById('hedera-serial') || {}).value || '',
      privateKey: (document.getElementById('hedera-private-key') || {}).value || ''
    };
  }

  function validateIdLike(v) {
    return /^\d+\.\d+\.\d+$/.test((v || '').trim());
  }

  function setLoading(btn, loadingText) {
    if (!btn) return () => {}; const prev = btn.textContent; btn.disabled = true; btn.textContent = loadingText || 'Trabajando...'; return () => {
      btn.disabled = false; btn.textContent = prev;
    };
  }

  const btnAssocCheck = document.getElementById('btn-assoc-check');
  if (btnAssocCheck) {
    btnAssocCheck.addEventListener('click', async () => {
      const { accountId, tokenId } = getHInputs();
      if (!accountId || !tokenId) {
        toast('Completa accountId y tokenId', { type: 'error' }); return;
      }
      setHStatus('Consultando asociación...');
      try {
        const data = await callApi('/api/hedera/associate/check', { method: 'POST', body: JSON.stringify({ accountId, tokenId }) });
        setHStatus(`Asociado: ${data.associated}`);
      } catch (err) {
        setHStatus(`Error: ${err.message}`);
      }
    });
  }

  const btnAssocPrepare = document.getElementById('btn-assoc-prepare');
  if (btnAssocPrepare) {
    btnAssocPrepare.addEventListener('click', async () => {
      const { accountId, tokenId } = getHInputs();
      if (!accountId || !tokenId) {
        toast('Completa accountId y tokenId', { type: 'error' }); return;
      }
      setHStatus('Preparando transacción...');
      try {
        const data = await callApi('/api/hedera/associate/prepare', { method: 'POST', body: JSON.stringify({ accountId, tokenId }) });
        const area = document.getElementById('assoc-tx-base64');
        if (area) area.value = data.bytes || '';
        setHStatus('Transacción preparada. Firma en tu wallet y pega la base64 arriba.');
      } catch (err) {
        setHStatus(`Error: ${err.message}`);
      }
    });
  }

  const btnAssocSubmit = document.getElementById('btn-assoc-submit');
  if (btnAssocSubmit) {
    btnAssocSubmit.addEventListener('click', async () => {
      const base64 = (document.getElementById('assoc-tx-base64') || {}).value || '';
      if (!base64) {
        toast('Pega la transacción firmada (base64).', { type: 'error' }); return;
      }
      setHStatus('Enviando a red...');
      try {
        const data = await callApi('/api/hedera/associate/submit', { method: 'POST', body: JSON.stringify({ signedTransaction: base64 }) });
        setHStatus(`Submit: ${data.status || JSON.stringify(data)}`);
      } catch (err) {
        setHStatus(`Error: ${err.message}`);
      }
    });
  }

  const btnNftOwner = document.getElementById('btn-nft-owner');
  if (btnNftOwner) {
    btnNftOwner.addEventListener('click', async () => {
      const { tokenId, serial } = getHInputs();
      if (!tokenId || serial === '') {
        toast('Completa tokenId y serial', { type: 'error' }); return;
      }
      setHStatus('Consultando Mirror Node...');
      try {
        const params = new URLSearchParams({ tokenId, serial: String(serial) });
        const data = await callApi(`/api/hedera/nft/owner?${params.toString()}`);
        setHStatus(`Owner: ${data.owner}`);
      } catch (err) {
        setHStatus(`Error: ${err.message}`);
      }
    });
  }

  const btnNftList = document.getElementById('btn-nft-list');
  if (btnNftList) {
    btnNftList.addEventListener('click', async () => {
      const listPre = document.getElementById('hedera-list-pre');
      const { accountId, tokenId } = getHInputs();
      if (!accountId || !tokenId) {
        toast('Completa accountId y tokenId', { type: 'error' }); return;
      }
      setHStatus('Listando NFTs de la cuenta...');
      try {
        const data = await callApi('/api/hedera/nft/list', { method: 'POST', body: JSON.stringify({ accountId, tokenId }) });
        if (listPre) listPre.textContent = JSON.stringify(data, null, 2);
        // Indicar si hay siguiente página y guardar en dataset
        setHStatus(data.next ? 'Listado OK (hay más páginas)' : 'Listado OK');
        if (listPre) listPre.dataset.next = data.next || '';
      } catch (err) {
        if (listPre) {
          listPre.textContent = ''; listPre.dataset.next = '';
        }
        setHStatus(`Error: ${err.message}`);
      }
    });
  }

  // Navegar a la siguiente página con doble clic en el área de listado
  const listPreEl = document.getElementById('hedera-list-pre');
  if (listPreEl && !listPreEl.dataset.listenerAttached) {
    listPreEl.addEventListener('dblclick', async () => {
      const next = listPreEl.dataset.next || '';
      if (!next) return;
      setHStatus('Cargando página siguiente...');
      try {
        const data = await callApi('/api/hedera/nft/list', { method: 'POST', body: JSON.stringify({ next }) });
        const current = JSON.parse(listPreEl.textContent || '{}');
        const merged = {
          ...current,
          items: [...(current.items || []), ...(data.items || [])],
          count: (current.count || 0) + (data.count || 0),
          next: data.next || ''
        };
        listPreEl.textContent = JSON.stringify(merged, null, 2);
        listPreEl.dataset.next = data.next || '';
        setHStatus(data.next ? 'Página añadida (hay más)' : 'Listado completo');
      } catch (err) {
        setHStatus(`Error: ${err.message}`);
      }
    });
    // Evitar adjuntar múltiples veces
    listPreEl.dataset.listenerAttached = '1';
  }

  const btnNftTransfer = document.getElementById('btn-nft-transfer');
  if (btnNftTransfer) {
    btnNftTransfer.addEventListener('click', async () => {
      const { tokenId, serial } = getHInputs();
      const to = (document.getElementById('hedera-to') || {}).value || '';
      if (!tokenId || !serial || !to) {
        toast('Completa tokenId, serial y destino', { type: 'error' }); return;
      }
      setHStatus('Transfiriendo NFT...');
      try {
        const data = await callApi('/api/hedera/transfer', { method: 'POST', body: JSON.stringify({ tokenId, serial: Number(serial), to }) });
        setHStatus(`Transfer OK: ${data.status}`);
      } catch (err) {
        setHStatus(`Error: ${err.message}`);
      }
    });
  }

  // Render simple de miniaturas (si metadata es base64 de JSON con image/url)
  function renderGallery(resp) {
    const grid = document.getElementById('hedera-gallery');
    if (!grid) return;
    grid.innerHTML = '';
    const items = (resp && resp.items) || [];
    for (const it of items) {
      let imgSrc = '';
      try {
        if (it.metadata) {
          // metadata suele venir base64; intentar decodificar y parsear JSON
          const raw = atob(it.metadata);
          try {
            const metaObj = JSON.parse(raw);
            imgSrc = metaObj.image || metaObj.url || '';
          } catch {
            // Si no es JSON, podría ser un binario/PNG base64; no lo mostramos
          }
        }
      } catch {}
      const card = document.createElement('div');
      card.className = 'card';
      card.style.padding = '8px';
      card.innerHTML = `
        <div style="font-size:12px;color:#888;">#${it.serial}</div>
        ${imgSrc ? `<img src="${imgSrc}" alt="#${it.serial}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;" />` : '<div style="height:120px;border:1px dashed #888;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#888;">sin preview</div>'}
      `;
      grid.appendChild(card);
    }
  }

  // Ver mis NFTs (usa accountId del input y tokenId)
  const btnMy = document.getElementById('btn-nft-my');
  if (btnMy) {
    btnMy.addEventListener('click', async () => {
      const { accountId, tokenId } = getHInputs();
      if (!accountId || !tokenId) {
        toast('Completa accountId y tokenId', { type: 'error' }); return;
      }
      setHStatus('Cargando tus NFTs...');
      try {
        const data = await callApi('/api/hedera/nft/list', { method: 'POST', body: JSON.stringify({ accountId, tokenId }) });
        const pre = document.getElementById('hedera-list-pre');
        if (pre) {
          pre.textContent = JSON.stringify(data, null, 2);
          pre.dataset.next = data.next || '';
        }
        renderGallery(data);
        setHStatus('Tus NFTs cargados');
      } catch (err) {
        setHStatus(`Error: ${err.message}`);
      }
    });
  }

  // Botones extra Hedera: copiar/limpiar base64 y paginación
  const btnCopy = document.getElementById('btn-copy-base64');
  if (btnCopy) {
    btnCopy.addEventListener('click', async () => {
      const area = document.getElementById('assoc-tx-base64');
      const val = (area && area.value) || '';
      if (!val) {
        setHStatus('Nada para copiar.'); return;
      }
      try {
        await navigator.clipboard.writeText(val);
        setHStatus('Base64 copiada al portapapeles.');
      } catch (err) {
        setHStatus(`No se pudo copiar: ${err.message}`);
      }
    });
  }
  const btnClear = document.getElementById('btn-clear-base64');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      const area = document.getElementById('assoc-tx-base64');
      if (area) area.value = '';
      setHStatus('Área base64 limpia.');
    });
  }
  const btnMore = document.getElementById('btn-nft-more');
  if (btnMore) {
    btnMore.addEventListener('click', async () => {
      const pre = document.getElementById('hedera-list-pre');
      const next = (pre && pre.dataset.next) || '';
      if (!next) {
        setHStatus('No hay más páginas.'); return;
      }
      const stop = setLoading(btnMore, 'Cargando más...');
      try {
        const data = await callApi('/api/hedera/nft/list', { method: 'POST', body: JSON.stringify({ next }) });
        const current = pre && pre.textContent ? JSON.parse(pre.textContent) : {};
        const merged = {
          ...current,
          items: [...(current.items || []), ...(data.items || [])],
          count: (current.count || 0) + (data.count || 0),
          next: data.next || ''
        };
        if (pre) {
          pre.textContent = JSON.stringify(merged, null, 2);
          pre.dataset.next = data.next || '';
        }
        renderGallery(merged);
        setHStatus(data.next ? 'Página añadida (hay más)' : 'Listado completo');
      } catch (err) {
        setHStatus(`Error: ${err.message}`);
      } finally {
        stop();
      }
    });
  }

  // UI mínima Split NFT
  const splitRes = document.getElementById('split-result');

  function setSplit(msg) {
    if (splitRes) splitRes.textContent = msg;
  }
  const splitsContainer = document.getElementById('splits-container');
  const btnAddSplit = document.getElementById('btn-add-split');
  const btnSplitCreate = document.getElementById('btn-split-create');
  const btnSplitMint = document.getElementById('btn-split-mint');
  const btnSplitAssociate = document.getElementById('btn-split-associate');
  const btnSplitTransfer = document.getElementById('btn-split-transfer');
  const splitNameEl = document.getElementById('split-name');
  const splitSymbolEl = document.getElementById('split-symbol');
  const splitTreasuryEl = document.getElementById('split-treasury');
  const splitMetadataEl = document.getElementById('split-metadata');
  const splitToEl = document.getElementById('split-to-account');
  const bpsSumEl = document.getElementById('splits-sum');

  function renderSplitRow(account = '', bps = 0) {
    const row = document.createElement('div');
    row.className = 'actions';
    row.style.gap = '6px';
    row.style.flexWrap = 'wrap';
    row.innerHTML = `
      <input type="text" class="split-acc" placeholder="0.0.xxxxx" value="${account}" style="min-width:160px;"/>
      <input type="number" class="split-bps" placeholder="bps" min="0" max="10000" step="50" value="${bps}" style="width:100px;"/>
      <button type="button" class="split-del">Eliminar</button>
    `;
    row.querySelector('.split-del').addEventListener('click', () => {
      row.remove(); updateBpsSum();
    });
    if (splitsContainer) splitsContainer.appendChild(row);
  }

  function getSplits() {
    const rows = (splitsContainer && Array.from(splitsContainer.querySelectorAll('.split-acc'))) || [];
    const bps = (splitsContainer && Array.from(splitsContainer.querySelectorAll('.split-bps'))) || [];
    const items = [];
    for (let i = 0; i < rows.length; i++) {
      const acc = (rows[i].value || '').trim();
      const b = parseInt((bps[i].value || '0'), 10) || 0;
      if (acc) items.push({ accountId: acc, bps: b });
    }
    return items;
  }

  function updateBpsSum() {
    const sum = getSplits().reduce((a, x) => a + (x.bps || 0), 0);
    if (bpsSumEl) bpsSumEl.textContent = `BPS total: ${sum}`;
  }
  if (btnAddSplit) {
    btnAddSplit.addEventListener('click', () => {
      renderSplitRow('', 0); updateBpsSum();
    });
  }
  if (splitsContainer && !splitsContainer.hasChildNodes()) {
    renderSplitRow('', 5000); renderSplitRow('', 5000); updateBpsSum();
  }

  let lastTokenId = '';
  let lastSerial = 0;

  if (btnSplitCreate) {
    btnSplitCreate.addEventListener('click', async () => {
      const name = (splitNameEl && splitNameEl.value) || 'Aether Collection';
      const symbol = (splitSymbolEl && splitSymbolEl.value) || 'AETH';
      const treasuryAccountId = (splitTreasuryEl && splitTreasuryEl.value) || '';
      const splits = getSplits();
      if (!treasuryAccountId || !/^\d+\.\d+\.\d+$/.test(treasuryAccountId)) {
        toast('Tesorería inválida', { type: 'error' }); return;
      }
      const stop = setLoading(btnSplitCreate, 'Creando...');
      try {
        setSplit('Creando token en Hedera...');
        const resp = await callApi('/api/hedera/split-nft/create', { method: 'POST', body: JSON.stringify({ name, symbol, treasuryAccountId, splits }) });
        lastTokenId = resp.tokenId || '';
        setSplit(`Token creado: ${lastTokenId}`);
        if (btnSplitMint) btnSplitMint.disabled = !lastTokenId;
        const tokenInput = document.getElementById('hedera-token'); if (tokenInput) tokenInput.value = lastTokenId;
      } catch (err) {
        setSplit(`Error: ${err.message}`);
      } finally {
        stop();
      }
    });
  }

  if (btnSplitMint) {
    btnSplitMint.addEventListener('click', async () => {
      if (!lastTokenId) {
        toast('Crea primero la colección', { type: 'error' }); return;
      }
      const meta = (splitMetadataEl && splitMetadataEl.value) || '';
      let metadataJson;
      if (meta) {
        try {
          metadataJson = JSON.parse(meta);
        } catch {
          metadataJson = { description: `${meta}` };
        }
      }
      const stop = setLoading(btnSplitMint, 'Minteando...');
      try {
        const resp = await callApi('/api/hedera/split-nft/mint', { method: 'POST', body: JSON.stringify({ tokenId: lastTokenId, metadataJson }) });
        const s = (resp.serials && resp.serials[0]) || 0;
        lastSerial = s;
        setSplit(`Mint OK: serial #${s}`);
        if (btnSplitAssociate) btnSplitAssociate.disabled = false;
        if (btnSplitTransfer) btnSplitTransfer.disabled = false;
        const serialInput = document.getElementById('hedera-serial'); if (serialInput) serialInput.value = String(s);
      } catch (err) {
        setSplit(`Error mint: ${err.message}`);
      } finally {
        stop();
      }
    });
  }

  if (btnSplitAssociate) {
    btnSplitAssociate.addEventListener('click', async () => {
      const accountId = (document.getElementById('hedera-account') || {}).value || '';
      const accountPrivateKey = (document.getElementById('hedera-private-key') || {}).value || '';
      if (!/^\d+\.\d+\.\d+$/.test(accountId)) {
        toast('Ingresa un AccountId válido en la sección Hedera', { type: 'error' }); return;
      }
      const stop = setLoading(btnSplitAssociate, 'Asociando...');
      try {
        const body = { tokenId: lastTokenId, accountId };
        if (accountPrivateKey) body.accountPrivateKey = accountPrivateKey;
        const resp = await callApi('/api/hedera/token/associate', { method: 'POST', body: JSON.stringify(body) });
        setSplit(`Associate: ${resp.status || JSON.stringify(resp)}`);
      } catch (err) {
        setSplit(`Error associate: ${err.message}`);
      } finally {
        stop();
      }
    });
  }

  if (btnSplitTransfer) {
    btnSplitTransfer.addEventListener('click', async () => {
      const to = (splitToEl && splitToEl.value) || '';
      if (!/^\d+\.\d+\.\d+$/.test(to)) {
        toast('Ingresa una cuenta destino válida', { type: 'error' }); return;
      }
      const stop = setLoading(btnSplitTransfer, 'Transfiriendo...');
      try {
        const resp = await callApi('/api/hedera/nft/transfer', { method: 'POST', body: JSON.stringify({ tokenId: lastTokenId, serial: lastSerial, toAccountId: to }) });
        setSplit(`Transfer: ${resp.status || JSON.stringify(resp)}`);
      } catch (err) {
        setSplit(`Error transfer: ${err.message}`);
      } finally {
        stop();
      }
    });
  }

  // Esqueleto Wallet/HashConnect
  const walletStatusEl = document.getElementById('wallet-status');

  function setWStatus(msg) {
    if (walletStatusEl) walletStatusEl.textContent = msg;
  }

  const btnWalletConnect = document.getElementById('btn-wallet-connect');
  if (btnWalletConnect) {
    btnWalletConnect.addEventListener('click', async () => {
      const input = document.getElementById('wc-project-id');
      const projectId = (input && input.value) || '';
      window.__walletProjectId = projectId;
      const stop = setLoading(btnWalletConnect, 'Conectando...');
      try {
        if (!projectId) {
          setWStatus('Ingresa tu WalletConnect Project ID.');
          return;
        }
        const network = 'testnet';
        const metadata = {
          name: 'Aether Sound',
          description: 'Generación musical + Hedera',
          url: location.origin,
          icons: []
        };

        // Detectar HashConnect SDK (inyectado por script/extension)
        const HCglobal = window.HashConnect || window.hashconnect || null;
        if (!HCglobal) {
          setWStatus('HashConnect SDK no detectado. Instala HashPack y/o añade el SDK.');
          return;
        }

        let hcInstance = window.__hc;
        if (!hcInstance) {
          try {
          // Si ya hay una instancia inyectada por la extensión (objeto con init/connect/eventos), úsala directamente
            if (typeof HCglobal === 'object' && (typeof HCglobal.init === 'function' || typeof HCglobal.connect === 'function' || HCglobal.connectionStatusChangeEvent)) {
              hcInstance = HCglobal;
            } else if (typeof HCglobal === 'function') {
            // Constructor UMD expuesto directamente
            // Nota: Algunos builds requieren LedgerId del SDK; si falla, el catch se activará y se informará al usuario.
              const network = 'testnet';
              const metadata = { name: 'Aether Sound', description: 'Generación musical + Hedera', url: location.origin, icons: [] };
              hcInstance = new HCglobal(network, window.__walletProjectId || '', metadata, true);
            } else if (HCglobal && typeof HCglobal.HashConnect === 'function') {
              const network = 'testnet';
              const metadata = { name: 'Aether Sound', description: 'Generación musical + Hedera', url: location.origin, icons: [] };
              hcInstance = new HCglobal.HashConnect(network, window.__walletProjectId || '', metadata, true);
            } else if (HCglobal && HCglobal.default && typeof HCglobal.default === 'function') {
              const network = 'testnet';
              const metadata = { name: 'Aether Sound', description: 'Generación musical + Hedera', url: location.origin, icons: [] };
              hcInstance = new HCglobal.default(network, window.__walletProjectId || '', metadata, true);
            }
          } catch (err) {
            console.warn('Error creando HashConnect:', err);
          }
        }

        if (!hcInstance) {
          setWStatus('No fue posible instanciar HashConnect. Si usas la extensión HashPack, asegúrate de que esté instalada y habilitada.');
          return;
        }

        window.__hc = hcInstance;
        setWStatus('Inicializando HashConnect...');

        // Suscribir eventos si existen
        try {
          const extEvt = hcInstance.foundExtensionEvent;
          if (extEvt && typeof extEvt.once === 'function') {
            extEvt.once((walletMeta) => {
              setWStatus(`Extensión detectada: ${walletMeta?.name || 'HashPack'}`);
            });
          }
        } catch {}

        try {
          const connEvt = hcInstance.connectionStatusChangeEvent;
          const onStatus = (st) => {
            try {
              const s = String(st || '');
              setWStatus(`Estado: ${s}`);
              if (/Paired|Connected/i.test(s)) {
                const accounts = (hcInstance.sessionData && hcInstance.sessionData.accountIds) || [];
                if (accounts.length) {
                  const first = accounts[0];
                  setWStatus(`Conectado: ${first} (${s})`);
                  const accEl = document.getElementById('hedera-account');
                  if (accEl && !accEl.value) accEl.value = first;
                }
              }
            } catch {}
          };
          if (connEvt) {
            if (typeof connEvt.once === 'function') connEvt.once(onStatus);
            if (typeof connEvt.on === 'function') connEvt.on(onStatus);
          }
        } catch {}

        // init o connect según la API disponible
        try {
          if (typeof hcInstance.init === 'function') {
            await hcInstance.init();
          } else if (typeof hcInstance.connect === 'function') {
            await hcInstance.connect();
          }
        } catch (err) {
          console.warn('Error en init/connect HashConnect:', err);
        }

        // Si ya hay sesión, reflejarla
        try {
          const accounts = (hcInstance.sessionData && hcInstance.sessionData.accountIds) || [];
          if (accounts.length) {
            const first = accounts[0];
            setWStatus(`Conectado: ${first}`);
            const accEl = document.getElementById('hedera-account');
            if (accEl && !accEl.value) accEl.value = first;
          } else {
            setWStatus('HashConnect inicializado. Esperando autorización en HashPack...');
          }
        } catch {}
      } catch (err) {
        setWStatus(`Error: ${err.message}`);
      } finally {
        stop();
      }
    });
  }

  const btnWalletSign = document.getElementById('btn-assoc-wallet');
  if (btnWalletSign) {
    btnWalletSign.addEventListener('click', async () => {
      const area = document.getElementById('assoc-tx-base64');
      const base64 = (area && area.value) || '';
      const { accountId, tokenId } = getHInputs();
      const stop = setLoading(btnWalletSign, 'Firmando...');
      try {
        const hc = window.__hc;
        if (!hc) {
          setWStatus('Conecta tu wallet primero.');
          return;
        }

        // Si no hay transacción, preparar en backend
        let txBase64 = base64;
        if (!txBase64) {
          if (!accountId || !tokenId) {
            setWStatus('Completa accountId y tokenId o pega base64.'); return;
          }
          const data = await callApi('/api/hedera/associate/prepare', { method: 'POST', body: JSON.stringify({ accountId, tokenId }) });
          txBase64 = data.bytes || '';
          if (area) area.value = txBase64;
          setWStatus('Transacción preparada. Intentando firmar con HashConnect...');
        }

        // Cargar SDK de Hedera dinámicamente para reconstruir la transacción
        function b64ToUint8(b64) {
          try {
            const binStr = atob(b64);
            const len = binStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
            return bytes;
          } catch (err) {
            throw new Error(`Base64 inválido: ${err.message}`);
          }
        }

        let SDK;
        try {
          SDK = await import('https://esm.sh/@hashgraph/sdk@2?bundle');
        } catch (err) {
          console.warn('No se pudo cargar @hashgraph/sdk desde CDN:', err);
          setWStatus('No se pudo cargar el SDK de Hedera en el navegador. Ver consola.');
          return;
        }

        const { Transaction } = SDK || {};
        if (!Transaction || typeof Transaction.fromBytes !== 'function') {
          setWStatus('SDK de Hedera cargado, pero falta Transaction.fromBytes.');
          return;
        }

        const bytes = b64ToUint8(txBase64);
        let tx;
        try {
          tx = Transaction.fromBytes(bytes);
        } catch (err) {
          setWStatus(`No se pudo reconstruir la transacción: ${err.message}`);
          return;
        }

        // Determinar cuenta para firmar
        let signerAccount = accountId;
        try {
          const accs = (hc.sessionData && hc.sessionData.accountIds) || [];
          if (!signerAccount && accs.length) signerAccount = accs[0];
        } catch {}
        if (!signerAccount) {
          setWStatus('No hay AccountId para firmar. Completa el input o conecta la wallet.');
          return;
        }

        if (typeof hc.sendTransaction !== 'function') {
          setWStatus('La API de HashConnect no expone sendTransaction en esta sesión.');
          return;
        }

        setWStatus('Enviando a wallet para firmar y ejecutar...');
        let resp;
        try {
          resp = await hc.sendTransaction(signerAccount, tx);
        } catch (err) {
          setWStatus(`Wallet rechazó o falló la firma: ${err?.message || err}`);
          return;
        }

        // Mostrar resultado y actualizar estado
        try {
          const summary = typeof resp === 'object' ? JSON.stringify(resp) : String(resp);
          setWStatus(`Transacción enviada. Respuesta: ${summary}`);
          setHStatus('Asociación solicitada. Revisa la respuesta/recibo en Wallet.');
        } catch {
          setWStatus('Transacción enviada.');
        }
      } catch (err) {
        setWStatus(`Error: ${err.message}`);
      } finally {
        stop();
      }
    });
  }

  // --- NUEVAS FUNCIONALIDADES ---

  // SYNC automático con SSE
  let syncSource = null;
  const syncStatus = document.getElementById('sync-status');
  const btnSync = document.getElementById('btn-sync-toggle');

  function setSyncStatus(msg) {
    if (syncStatus) syncStatus.textContent = msg;
  }

  if (btnSync) {
    btnSync.addEventListener('click', () => {
      if (syncSource) {
      // Desconectar
        syncSource.close();
        syncSource = null;
        setSyncStatus('Desconectado');
        btnSync.textContent = 'Sync';
      } else {
      // Conectar
        try {
          syncSource = new EventSource('/api/sync/stream');
          setSyncStatus('Conectando...');
          btnSync.textContent = 'Desconectar';

          syncSource.onmessage = (evt) => {
            try {
              const data = JSON.parse(evt.data);
              if (data.type === 'hello') {
                setSyncStatus('Conectado - Esperando cambios');
              } else if (data.type === 'output_updated') {
                setSyncStatus(`Actualizado: ${data.file}`);
                try {
                  window.__lastNewFile = data.file || null;
                } catch {}
                if (typeof window.refreshOutputList === 'function') {
                  setTimeout(window.refreshOutputList, 500);
                } else {
                  setTimeout(refreshList, 500); // pequeña demora para permitir que termine la escritura
                }
              }
            } catch (err) {
              console.warn('Error procesando SSE:', err);
            }
          };

          syncSource.onerror = (err) => {
            console.warn('SSE error:', err);
            setSyncStatus('Error de conexión');
            syncSource = null;
            btnSync.textContent = 'Sync';
          };
        } catch (err) {
          setSyncStatus('No se pudo conectar');
          console.error('Error SSE:', err);
        }
      }
    });
  }

  // MEZCLA/CROSSFADE
  const btnMix = document.getElementById('btn-mix-crossfade');
  let lastMixFile = null;

  if (btnMix) {
    btnMix.addEventListener('click', async () => {
      const files = Array.from(selectedFiles);
      if (files.length < 2) {
        toast('Selecciona al menos 2 pistas para mezclar.', { type: 'error' });
        return;
      }
      const fileA = files[0];
      const fileB = files[1];
      const durSec = parseFloat((document.getElementById('mix-sec') || {}).value) || 8;

      const prevText = btnMix.textContent;
      try {
        btnMix.disabled = true;
        btnMix.textContent = 'Mezclando...';
        const data = await callApi('/api/mix/crossfade', {
          method: 'POST',
          body: JSON.stringify({ fileA, fileB, durationSec: durSec })
        });
        if (data.ok) {
          lastMixFile = data.file;
          const btnShare = document.getElementById('btn-share-last');
          if (btnShare) btnShare.disabled = false;
          toast(`Mix creado: ${data.file}`, { type: 'success' });
          await refreshList();
          // Analytics
          await callApi('/api/analytics/event', {
            method: 'POST',
            body: JSON.stringify({ type: 'mix_create', sessionId: 'web', file: data.file, data: { fileA, fileB, durSec } })
          });
        } else {
          toast(`Error: ${data.error || 'Falló el mix'}`, { type: 'error' });
        }
      } catch (err) {
        toast(`Error: ${err.message}`, { type: 'error' });
      } finally {
        btnMix.disabled = false;
        btnMix.textContent = prevText;
      }
    });
  }

  // COMPARTIR último mix
  const btnShare = document.getElementById('btn-share-last');
  if (btnShare) {
    btnShare.addEventListener('click', async () => {
      if (!lastMixFile) {
        toast('No hay mix reciente para compartir.', { type: 'error' });
        return;
      }
      const url = `${location.origin}/output/${lastMixFile}`;
      try {
        await navigator.clipboard.writeText(url);
        toast('URL copiada al portapapeles!');
        // Analytics
        await callApi('/api/analytics/event', {
          method: 'POST',
          body: JSON.stringify({ type: 'share_mix', sessionId: 'web', file: lastMixFile, data: { url } })
        });
      } catch (err) {
        toast(`URL del mix: ${url} (No se pudo copiar)`, { duration: 5000 });
      }
    });
  }

  // IA TRANSICIONES
  const btnAiTrans = document.getElementById('btn-ai-trans');
  const planPre = document.getElementById('ai-trans-plan');
  const btnApplyPlan = document.getElementById('btn-apply-plan');
  let currentPlan = null;

  if (btnAiTrans) {
    btnAiTrans.addEventListener('click', async () => {
      const files = Array.from(selectedFiles);
      if (files.length < 2) {
        toast('Selecciona al menos 2 pistas para sugerir transición.', { type: 'error' });
        return;
      }
      const fileA = files[0];
      const fileB = files[1];

      const prevText = btnAiTrans.textContent;
      try {
        btnAiTrans.disabled = true;
        btnAiTrans.textContent = 'Analizando...';
        const data = await callApi('/api/ai/transitions', {
          method: 'POST',
          body: JSON.stringify({ fileA, fileB })
        });
        if (data.ok) {
          currentPlan = data.plan;
          if (planPre) planPre.textContent = JSON.stringify(data, null, 2);
          if (btnApplyPlan) btnApplyPlan.disabled = false;
          toast(`IA sugiere crossfade de ${data.plan.crossfadeSec}s`);
        } else {
          toast(`Error: ${data.error || 'Falló análisis IA'}`, { type: 'error' });
        }
      } catch (err) {
        toast(`Error: ${err.message}`, { type: 'error' });
      } finally {
        btnAiTrans.disabled = false;
        btnAiTrans.textContent = prevText;
      }
    });
  }

  // APLICAR plan IA
  if (btnApplyPlan) {
    btnApplyPlan.addEventListener('click', async () => {
      if (!currentPlan) {
        toast('No hay plan de IA para aplicar.', { type: 'error' });
        return;
      }
      const files = Array.from(selectedFiles);
      if (files.length < 2) {
        toast('Selecciona las pistas del plan.', { type: 'error' });
        return;
      }
      const fileA = files[0];
      const fileB = files[1];

      const prevText = btnApplyPlan.textContent;
      try {
        btnApplyPlan.disabled = true;
        btnApplyPlan.textContent = 'Aplicando...';
        const data = await callApi('/api/mix/crossfade', {
          method: 'POST',
          body: JSON.stringify({ fileA, fileB, durationSec: currentPlan.crossfadeSec })
        });
        if (data.ok) {
          lastMixFile = data.file;
          const btnShare = document.getElementById('btn-share-last');
          if (btnShare) btnShare.disabled = false;
          toast(`Plan IA aplicado: ${data.file}`, { type: 'success' });
          await refreshList();
          // Analytics
          await callApi('/api/analytics/event', {
            method: 'POST',
            body: JSON.stringify({ type: 'ai_plan_applied', sessionId: 'web', file: data.file, data: { plan: currentPlan } })
          });
        } else {
          toast(`Error: ${data.error || 'Falló aplicar plan'}`, { type: 'error' });
        }
      } catch (err) {
        toast(`Error: ${err.message}`, { type: 'error' });
      } finally {
        btnApplyPlan.disabled = false;
        btnApplyPlan.textContent = prevText;
      }
    });
  }

  // ANALYTICS
  const btnAnalytics = document.getElementById('btn-analytics');
  const analyticsPre = document.getElementById('analytics-pre');

  if (btnAnalytics) {
    btnAnalytics.addEventListener('click', async () => {
      try {
        const data = await callApi('/api/analytics/summary');
        if (data.ok) {
          if (analyticsPre) analyticsPre.textContent = JSON.stringify(data, null, 2);
          toast(`Analytics: ${data.events} eventos registrados`);
        } else {
          toast(`Error: ${data.error || 'Falló obtener analytics'}`, { type: 'error' });
        }
      } catch (err) {
        toast(`Error: ${err.message}`, { type: 'error' });
      }
    });
  }

  // --- MIXER PRO (WebAudio + WebMIDI + Biblioteca) ---
  let audioCtx = null;

  function ensureCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function createDeck(letter) {
    const ctx = ensureCtx();
    const mediaEl = document.getElementById(`deck${letter}-media`);
    const rateEl = document.getElementById(`deck${letter}-rate`);
    const gainEl = document.getElementById(`deck${letter}-gain`);
    const filterEl = document.getElementById(`deck${letter}-filter`);
    const echoTimeEl = document.getElementById(`deck${letter}-echo-time`);
    const echoFbEl = document.getElementById(`deck${letter}-echo-fb`);
    const btnPlay = document.getElementById(`deck${letter}-play`);
    const btnStop = document.getElementById(`deck${letter}-stop`);
    if (!mediaEl) return null;

    const trackLabel = document.getElementById(`deck${letter}-track`);

    // Mostrar duración junto al nombre
    function formatTime(sec) {
      const s = Number(sec);
      if (!isFinite(s) || s <= 0) return '';
      const m = Math.floor(s / 60);
      const ss = Math.floor(s % 60).toString().padStart(2, '0');
      return `${m}:${ss}`;
    }

    function renderTrackLabelWithDuration() {
      if (!trackLabel) return;
      try {
        const url = mediaEl.currentSrc || mediaEl.src || '';
        let display = url;
        const m = url && url.match(/\/output\/([^?#]+)/);
        if (m) {
          display = decodeURIComponent(m[1]);
        } else if (url) {
          try {
            const u = new URL(url);
            const last = (u.pathname || '').split('/').filter(Boolean).pop();
            if (last) display = decodeURIComponent(last);
          } catch {}
        }
        const dur = formatTime(mediaEl.duration);
        trackLabel.textContent = dur ? `${display} (${dur})` : display;
      } catch {}
    }
    mediaEl.addEventListener('loadedmetadata', renderTrackLabelWithDuration);
    mediaEl.addEventListener('durationchange', renderTrackLabelWithDuration);

    const src = ctx.createMediaElementSource(mediaEl);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = Number((filterEl && filterEl.value) || 18000);
    const delay = ctx.createDelay(2.0); delay.delayTime.value = Number((echoTimeEl && echoTimeEl.value) || 0.25);
    const fb = ctx.createGain(); fb.gain.value = Number((echoFbEl && echoFbEl.value) || 0.2);
    const gain = ctx.createGain(); gain.gain.value = Number((gainEl && gainEl.value) || 1);
    const xfaderGain = ctx.createGain(); xfaderGain.gain.value = 0.5;

    // Rutas: filter -> gain (dry)
    //        filter -> delay -> fb -> delay (feedback loop) y delay -> gain (wet)
    src.connect(filter);
    filter.connect(gain);
    filter.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(gain);
    gain.connect(xfaderGain);
    xfaderGain.connect(ctx.destination);

    // NUEVO: Analizador (FFT) + Visualizador de barras y Anillo de Progreso
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    const fftBuf = new Uint8Array(analyser.frequencyBinCount);
    try {
      gain.connect(analyser);
    } catch {}

    const vis = document.getElementById(`deck${letter}-vis`);
    let rafId = 0;

    function resizeCanvas() {
      if (!vis) return;
      const dpr = window.devicePixelRatio || 1;
      const w = vis.clientWidth || vis.width || 300;
      const h = vis.clientHeight || vis.height || 100;
      vis.width = Math.floor(w * dpr);
      vis.height = Math.floor(h * dpr);
    }

    function drawVis() {
      if (!vis) return;
      const ctx2d = vis.getContext('2d');
      if (!ctx2d) {
        rafId = requestAnimationFrame(drawVis); return;
      }
      const w = vis.width; const h = vis.height;
      ctx2d.clearRect(0, 0, w, h);
      analyser.getByteFrequencyData(fftBuf);
      const n = fftBuf.length;
      const bars = Math.min(64, n);
      const step = Math.max(1, Math.floor(n / bars));
      const barW = w / (bars * 1.2);
      let sum = 0;
      for (let i = 0; i < bars; i++) {
        const v = fftBuf[i * step] / 255;
        sum += v;
        const bh = v * h;
        const x = i * (barW * 1.2);
        ctx2d.fillStyle = `hsl(${200 + i * 2}, 85%, ${30 + Math.round(v * 50)}%)`;
        ctx2d.fillRect(x, h - bh, barW, bh);
      }
      try {
        (window.__setDeckEnergy && window.__setDeckEnergy(letter, bars ? (sum / bars) : 0));
      } catch {}
      rafId = requestAnimationFrame(drawVis);
    }
    if (vis) {
      resizeCanvas();
      drawVis();
      window.addEventListener('resize', resizeCanvas);
    }

    // Progreso circular del track
    const progressEl = document.getElementById(`deck${letter}-progress`);

    function updateProgress() {
      if (!progressEl) return;
      const d = Number(mediaEl.duration) || 0;
      const t = Number(mediaEl.currentTime) || 0;
      const pct = d > 0 ? Math.max(0, Math.min(1, t / d)) : 0;
      const deg = Math.round(pct * 360);
      progressEl.style.background = `conic-gradient(var(--accent) ${deg}deg, var(--bg-muted) 0)`;
    }
    mediaEl.addEventListener('timeupdate', updateProgress);
    mediaEl.addEventListener('loadedmetadata', updateProgress);

    // Handlers de controles
    if (rateEl) {
      rateEl.addEventListener('input', () => {
        mediaEl.playbackRate = Number(rateEl.value || 1);
      });
    }
    if (gainEl) {
      gainEl.addEventListener('input', () => {
        gain.gain.value = Number(gainEl.value || 1);
      });
    }
    if (filterEl) {
      filterEl.addEventListener('input', () => {
        filter.frequency.value = Number(filterEl.value || 18000);
      });
    }
    if (echoTimeEl) {
      echoTimeEl.addEventListener('input', () => {
        delay.delayTime.value = Number(echoTimeEl.value || 0.25);
      });
    }
    if (echoFbEl) {
      echoFbEl.addEventListener('input', () => {
        fb.gain.value = Number(echoFbEl.value || 0.2);
      });
    }

    if (btnPlay) {
      btnPlay.addEventListener('click', async () => {
        try {
          await ensureCtx().resume();
        } catch {}
        if (mediaEl.paused) {
          mediaEl.play().catch(() => {});
        } else {
          mediaEl.pause();
        }
      });
    }
    if (btnStop) {
      btnStop.addEventListener('click', () => {
        mediaEl.pause(); mediaEl.currentTime = 0;
      });
    }

    function setSrc(url) {
      mediaEl.src = url; mediaEl.load();
      try {
        if (typeof updateProgress === 'function') updateProgress();
      } catch {}
      try {
        let display = url;
        if (trackLabel) {
          const m = url.match(/\/output\/([^?#]+)/);
          display = m ? decodeURIComponent(m[1]) : url;
          trackLabel.textContent = display;
          try {
            renderTrackLabelWithDuration && renderTrackLabelWithDuration();
          } catch {}
        }
        toast(`Cargada en Deck ${letter}: ${display}`);
      } catch {}
    }

    return { mediaEl, src, filter, delay, fb, gain, xfaderGain, setSrc };
  }

  const deckA = createDeck('A');
  const deckB = createDeck('B');

  // Botones Limpiar deck
  const btnClearA = document.getElementById('deckA-clear');
  if (btnClearA) {
    btnClearA.addEventListener('click', () => {
      try {
        clearDeck(deckA);
      } catch {}
    });
  }
  const btnClearB = document.getElementById('deckB-clear');
  if (btnClearB) {
    btnClearB.addEventListener('click', () => {
      try {
        clearDeck(deckB);
      } catch {}
    });
  }

  // Drag & Drop en decks (zona ampliada + highlight)
  function bindDeckDrop(deck) {
    if (!deck || !deck.mediaEl) return;
    const container = deck.mediaEl.parentElement || deck.mediaEl;
    const onEnterOver = (e) => {
      try {
        e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
      } catch {}
      try {
        container.classList.add('deck-over');
      } catch {}
    };
    const onLeave = (e) => {
      try {
        container.classList.remove('deck-over');
      } catch {}
    };
    container.addEventListener('dragenter', onEnterOver);
    container.addEventListener('dragover', onEnterOver);
    container.addEventListener('dragleave', onLeave);
    container.addEventListener('drop', async (e) => {
      try {
        e.preventDefault();
        container.classList.remove('deck-over');
        const dt = e.dataTransfer;
        const f = dt.getData('text/aether-output-file') || dt.getData('text/plain');
        if (f) {
          deck.setSrc(`/output/${encodeURIComponent(f)}`); return;
        }
        if (dt.files && dt.files.length > 0) {
          const file = dt.files[0];
          const allowed = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/flac'];
          if (file && (allowed.includes(file.type) || /\.(wav|mp3|ogg|flac)$/i.test(file.name))) {
            const form = new FormData();
            form.append('file', file, file.name);
            const resp = await fetch('/api/upload', { method: 'POST', body: form });
            const json = await resp.json();
            if (json && json.ok && json.url) {
              deck.setSrc(json.url);
            } else {
              toast(`Error al subir: ${json?.error || resp.status}`, { type: 'error' });
            }
          } else {
            toast('Formato no soportado. Usa WAV/MP3/OGG/FLAC', { type: 'error' });
          }
        }
      } catch {}
    });
  }
  bindDeckDrop(deckA);
  bindDeckDrop(deckB);

  function clearDeck(deck) {
    if (!deck || !deck.mediaEl) return;
    const mediaEl = deck.mediaEl;
    try {
      mediaEl.pause();
    } catch {}
    try {
      mediaEl.currentTime = 0;
    } catch {}
    try {
      mediaEl.removeAttribute('src'); mediaEl.src = ''; mediaEl.load();
    } catch {}

    let letter = '';
    const match = mediaEl.id && mediaEl.id.match(/^deck([A-Z])-media$/);
    if (match) letter = match[1];

    const rateEl = document.getElementById(`deck${letter}-rate`);
    const gainEl = document.getElementById(`deck${letter}-gain`);
    const filterEl = document.getElementById(`deck${letter}-filter`);
    const echoTimeEl = document.getElementById(`deck${letter}-echo-time`);
    const echoFbEl = document.getElementById(`deck${letter}-echo-fb`);

    if (rateEl) {
      rateEl.value = '1'; mediaEl.playbackRate = 1;
    }
    if (gainEl && deck.gain) {
      gainEl.value = '1'; deck.gain.gain.value = 1;
    }
    if (filterEl && deck.filter) {
      filterEl.value = '18000'; deck.filter.frequency.value = 18000;
    }
    if (echoTimeEl && deck.delay) {
      echoTimeEl.value = '0.25'; deck.delay.delayTime.value = 0.25;
    }
    if (echoFbEl && deck.fb) {
      echoFbEl.value = '0.2'; deck.fb.gain.value = 0.2;
    }

    const trackLabel = document.getElementById(`deck${letter}-track`);
    if (trackLabel) trackLabel.textContent = '';

    if (letter) toast(`Deck ${letter} vaciado`);
  }

  // Crossfader
  const xfaderEl = document.getElementById('xfader');

  function updateXfader() {
    if (!xfaderEl || !deckA || !deckB) return;
    const x = Math.max(0, Math.min(1, Number(xfaderEl.value || 0.5)));
    // Equal-power curve
    const gA = Math.cos(0.5 * Math.PI * x);
    const gB = Math.sin(0.5 * Math.PI * x);
    deckA.xfaderGain.gain.value = gA;
    deckB.xfaderGain.gain.value = gB;
  }
  if (xfaderEl) xfaderEl.addEventListener('input', updateXfader);
  updateXfader();

  // Cargar seleccionados en Decks
  function getSelectedAt(idx) {
    const arr = Array.from(selectedFiles);
    return arr[idx] || null;
  }
  const btnLoadA1 = document.getElementById('deckA-load-selected');
  if (btnLoadA1) {
    btnLoadA1.addEventListener('click', () => {
      const f = getSelectedAt(0);
      if (!f) {
        toast('Selecciona al menos 1 pista en la lista de salidas.', { type: 'error' }); return;
      }
      deckA && deckA.setSrc(`/output/${f}`);
    });
  }
  const btnLoadB1 = document.getElementById('deckB-load-selected');
  if (btnLoadB1) {
    btnLoadB1.addEventListener('click', () => {
      const f = getSelectedAt(1) || getSelectedAt(0);
      if (!f) {
        toast('Selecciona al menos 1 pista en la lista de salidas.', { type: 'error' }); return;
      }
      deckB && deckB.setSrc(`/output/${f}`);
    });
  }
  const btnLoadALocal = document.getElementById('deckA-load-local');
  if (btnLoadALocal) {
    btnLoadALocal.addEventListener('click', () => {
      const f = getSelectedAt(0);
      if (!f) {
        alert('Selecciona al menos 1 pista en la lista de salidas.'); return;
      }
      deckA && deckA.setSrc(`/output/${f}`);
    });
  }
  const btnLoadBLocal = document.getElementById('deckB-load-local');
  if (btnLoadBLocal) {
    btnLoadBLocal.addEventListener('click', () => {
      const f = getSelectedAt(1) || getSelectedAt(0);
      if (!f) {
        alert('Selecciona al menos 2 pistas (o una) en la lista de salidas.'); return;
      }
      deckB && deckB.setSrc(`/output/${f}`);
    });
  }

  // Búsqueda IA en Mixer + listado de resultados
  const btnMixerSearch = document.getElementById('btn-mixer-search');
  const mixerQueryEl = document.getElementById('mixer-query');
  const mixerResults = document.getElementById('mixer-results');
  if (btnMixerSearch) {
    btnMixerSearch.addEventListener('click', async () => {
      const q = (mixerQueryEl && mixerQueryEl.value) || 'club house worldwide';
      btnMixerSearch.disabled = true; const prev = btnMixerSearch.textContent; btnMixerSearch.textContent = 'Buscando...';
      try {
        const res = await fetch('/api/ai/search-compose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, maxItems: 10 }) });
        const data = await res.json();
        if (!mixerResults) return;
        mixerResults.innerHTML = '';
        const sources = data.sources || [];
        if (!sources.length) {
          mixerResults.innerHTML = '<li>Sin resultados.</li>'; return;
        }
        for (const s of sources) {
          const li = document.createElement('li');
          li.innerHTML = `
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <a class="link" href="${s.url}" target="_blank" title="Abrir">${s.title || s.url}</a>
            <button class="mixer-a" data-url="${encodeURI(s.url)}">A (stream)</button>
            <button class="mixer-b" data-url="${encodeURI(s.url)}">B (stream)</button>
            <button class="mixer-save-a" data-url="${encodeURI(s.url)}" data-name="${(s.title || 'track').replace(/[^\w.-]+/g, '_')}">Guardar→A</button>
            <button class="mixer-save-b" data-url="${encodeURI(s.url)}" data-name="${(s.title || 'track').replace(/[^\w.-]+/g, '_')}">Guardar→B</button>
          </div>
          <div class="snippet">${s.snippet || ''}</div>
        `;
          mixerResults.appendChild(li);
        }
        // Listeners
        mixerResults.querySelectorAll('.mixer-a').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            if (deckA) deckA.setSrc(url);
          });
        });
        mixerResults.querySelectorAll('.mixer-b').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            if (deckB) deckB.setSrc(url);
          });
        });

        async function saveToLibrary(url, name) {
          try {
            const resp = await callApi('/api/library/download', { method: 'POST', body: JSON.stringify({ url, filename: name }) });
            if (resp && resp.ok && resp.file) {
              await refreshList();
              return `/output/${resp.file}`;
            }
            toast(`No se pudo guardar: ${resp.error || 'desconocido'}`, { type: 'error' });

          } catch (err) {
            toast(`Error: ${err.message}`, { type: 'error' });
          }
          return null;
        }
        mixerResults.querySelectorAll('.mixer-save-a').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            const name = e.currentTarget.getAttribute('data-name');
            const local = await saveToLibrary(url, name);
            if (local && deckA) deckA.setSrc(local);
          });
        });
        mixerResults.querySelectorAll('.mixer-save-b').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            const name = e.currentTarget.getAttribute('data-name');
            const local = await saveToLibrary(url, name);
            if (local && deckB) deckB.setSrc(local);
          });
        });
      } catch (err) {
        toast(`Error búsqueda: ${err.message}`, { type: 'error' });
      } finally {
        btnMixerSearch.disabled = false; btnMixerSearch.textContent = prev;
      }
    });
  }

  // Búsqueda en GitHub (code search)
  const btnGithubSearch = document.getElementById('btn-github-search');
  const githubQueryEl = document.getElementById('github-query');
  const githubResults = document.getElementById('github-results');
  if (btnGithubSearch) {
    btnGithubSearch.addEventListener('click', async () => {
      const q = (githubQueryEl && githubQueryEl.value) || 'extension:wav';
      btnGithubSearch.disabled = true; const prev = btnGithubSearch.textContent; btnGithubSearch.textContent = 'Buscando GitHub...';
      try {
        const url = `/api/github/search?q=${encodeURIComponent(q)}&type=code&per_page=15`;
        const res = await fetch(url);
        const data = await res.json();
        if (!githubResults) return;
        githubResults.innerHTML = '';
        if (!data.ok) {
          githubResults.innerHTML = `<li>Error: ${data.error || 'desconocido'}</li>`; return;
        }
        const items = data.items || [];
        if (!items.length) {
          githubResults.innerHTML = '<li>Sin resultados.</li>'; return;
        }

        for (const it of items) {
          const title = `${it.repository_full_name}/${it.path}`;
          const raw = it.raw_url || it.html_url;
          const safeName = (it.name || 'track').replace(/[^\w.-]+/g, '_');
          const li = document.createElement('li');
          li.innerHTML = `
          <div style=\"display:flex;gap:8px;align-items:center;flex-wrap:wrap;\">
            <a class=\"link\" href=\"${it.html_url}\" target=\"_blank\" title=\"Abrir en GitHub\">${title}</a>
            <button class=\"gh-a\" data-url=\"${encodeURI(raw)}\">A (stream)</button>
            <button class=\"gh-b\" data-url=\"${encodeURI(raw)}\">B (stream)</button>
            <button class=\"gh-save-a\" data-url=\"${encodeURI(raw)}\" data-name=\"${safeName}\">Guardar→A</button>
            <button class=\"gh-save-b\" data-url=\"${encodeURI(raw)}\" data-name=\"${safeName}\">Guardar→B</button>
          </div>
        `;
          githubResults.appendChild(li);
        }

        githubResults.querySelectorAll('.gh-a').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            if (deckA) deckA.setSrc(url);
          });
        });
        githubResults.querySelectorAll('.gh-b').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            if (deckB) deckB.setSrc(url);
          });
        });

        async function saveToLibrary(url, name) {
          try {
            const resp = await callApi('/api/library/download', { method: 'POST', body: JSON.stringify({ url, filename: name }) });
            if (resp && resp.ok && resp.file) {
              await refreshList();
              return `/output/${resp.file}`;
            }
            toast(`No se pudo guardar: ${resp.error || 'desconocido'}`, { type: 'error' });

          } catch (err) {
            toast(`Error: ${err.message}`, { type: 'error' });
          }
          return null;
        }
        githubResults.querySelectorAll('.gh-save-a').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            const name = e.currentTarget.getAttribute('data-name');
            const local = await saveToLibrary(url, name);
            if (local && deckA) deckA.setSrc(local);
          });
        });
        githubResults.querySelectorAll('.gh-save-b').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            const name = e.currentTarget.getAttribute('data-name');
            const local = await saveToLibrary(url, name);
            if (local && deckB) deckB.setSrc(local);
          });
        });
      } catch (err) {
        toast(`Error GitHub: ${err.message}`, { type: 'error' });
      } finally {
        btnGithubSearch.disabled = false; btnGithubSearch.textContent = prev;
      }
    });
  }

  // NUEVO: Búsqueda en iTunes
  const btnItunesSearch = document.getElementById('btn-itunes-search');
  const itunesQueryEl = document.getElementById('itunes-query');
  const itunesResults = document.getElementById('itunes-results');
  if (btnItunesSearch) {
    btnItunesSearch.addEventListener('click', async () => {
      const q = (itunesQueryEl && itunesQueryEl.value) || '';
      if (!q) {
        toast('Ingresa un término de búsqueda.', { type: 'error' }); return;
      }
      btnItunesSearch.disabled = true; const prev = btnItunesSearch.textContent; btnItunesSearch.textContent = 'Buscando iTunes...';
      try {
        const url = `/api/music/search/itunes?term=${encodeURIComponent(q)}&limit=15`;
        const res = await fetch(url);
        const data = await res.json();
        if (!itunesResults) return;
        itunesResults.innerHTML = '';
        if (!data.ok) {
          itunesResults.innerHTML = `<li>Error: ${data.error || 'desconocido'}</li>`; return;
        }
        const items = data.results || [];
        if (!items.length) {
          itunesResults.innerHTML = '<li>Sin resultados.</li>'; return;
        }

        for (const it of items) {
          const title = `${it.artistName || 'Artista'} - ${it.trackName || 'Pista'}`;
          const art = it.artworkUrl100 ? `<img src="${it.artworkUrl100}" alt="cover" style="width:40px;height:40px;object-fit:cover;border-radius:4px;"/>` : '';
          const safeName = `${(it.artistName || 'artist').replace(/[^\w.-]+/g, '_')}-${(it.trackName || 'track').replace(/[^\w.-]+/g, '_')}`;
          const preview = it.previewUrl;
          const li = document.createElement('li');
          li.innerHTML = `
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            ${art}
            <span>${title}</span>
            ${preview ? `<button class="it-a" data-url="${encodeURI(preview)}">A (stream)</button>` : ''}
            ${preview ? `<button class="it-b" data-url="${encodeURI(preview)}">B (stream)</button>` : ''}
            ${preview ? `<button class="it-save-a" data-url="${encodeURI(preview)}" data-name="${safeName}">Guardar→A</button>` : ''}
            ${preview ? `<button class="it-save-b" data-url="${encodeURI(preview)}" data-name="${safeName}">Guardar→B</button>` : ''}
          </div>
        `;
          itunesResults.appendChild(li);
        }

        itunesResults.querySelectorAll('.it-a').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            if (deckA) deckA.setSrc(url);
          });
        });
        itunesResults.querySelectorAll('.it-b').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            if (deckB) deckB.setSrc(url);
          });
        });

        async function saveToLibrary(url, name) {
          try {
            const resp = await callApi('/api/library/download', { method: 'POST', body: JSON.stringify({ url, filename: name }) });
            if (resp && resp.ok && resp.file) {
              await refreshList();
              return `/output/${resp.file}`;
            }
            toast(`No se pudo guardar: ${resp.error || 'desconocido'}`, { type: 'error' });

          } catch (err) {
            toast(`Error: ${err.message}`, { type: 'error' });
          }
          return null;
        }
        itunesResults.querySelectorAll('.it-save-a').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            const name = e.currentTarget.getAttribute('data-name');
            const local = await saveToLibrary(url, name);
            if (local && deckA) deckA.setSrc(local);
          });
        });
        itunesResults.querySelectorAll('.it-save-b').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            const name = e.currentTarget.getAttribute('data-name');
            const local = await saveToLibrary(url, name);
            if (local && deckB) deckB.setSrc(local);
          });
        });
      } catch (err) {
        toast(`Error iTunes: ${err.message}`, { type: 'error' });
      } finally {
        btnItunesSearch.disabled = false; btnItunesSearch.textContent = prev;
      }
    });
  }

  // NUEVO: Hook Asistente Gemini
  (function() {
    const btn = document.getElementById('btn-assist');
    if (!btn) return;
    const sel = document.getElementById('assist-module');
    const ta = document.getElementById('assist-context');
    const out = document.getElementById('assist-output');

    function getSelectedFiles() {
      return Array.from(document.querySelectorAll('.track-check'))
        .filter(c => c.checked)
        .map(c => c.getAttribute('data-file'));
    }

    function getActionsContainer() {
      let c = document.getElementById('assist-actions');
      if (!c) {
        c = document.createElement('div');
        c.id = 'assist-actions';
        c.className = 'actions';
        c.style.gap = '8px';
        c.style.flexWrap = 'wrap';
        c.style.marginTop = '6px';
        out.insertAdjacentElement('afterend', c);
      }
      return c;
    }

    function mkBtn(label, handler) {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', async () => {
        const prev = b.textContent;
        try {
          b.disabled = true; b.textContent = '...';
          await handler();
        } catch (err) {
          toast(`Error: ${err?.message || String(err)}`, { type: 'error' });
        } finally {
          b.disabled = false; b.textContent = prev;
        }
      });
      return b;
    }

    function firstSelectedFile() {
      const fs = getSelectedFiles();
      return fs && fs.length ? fs[0] : null;
    }

    // Nuevo: extraer plan { bpm, key, scale, sections } del texto del asistente
    function extractPlanFromText(txt) {
      try {
        if (!txt) return {};
        const m = String(txt).match(/\{[\s\S]*\}/);
        if (!m) return {};
        const obj = JSON.parse(m[0]);
        const plan = {};
        if (obj && typeof obj === 'object') {
          if (obj.bpm != null) plan.bpm = Number(obj.bpm) || undefined;
          if (obj.key) plan.key = String(obj.key).toUpperCase();
          if (obj.scale) plan.scale = String(obj.scale).toLowerCase();
          if (Array.isArray(obj.sections) && plan.bpm) {
            const totalBars = obj.sections.reduce((a, s) => a + (Number(s?.bars) || 0), 0);
            const beats = totalBars * 4; // asumimos 4/4
            const seconds = (60 / plan.bpm) * beats;
            plan.durationSec = Math.max(4, Math.min(60, seconds));
          }
        }
        return plan;
      } catch (_) {
        return {};
      }
    }

    btn.addEventListener('click', async () => {
      const moduleVal = (sel && sel.value) || 'creacion';
      const context = (ta && ta.value) || '';
      const selectedFiles = getSelectedFiles();
      const prev = btn.textContent; btn.disabled = true; btn.textContent = 'Asistiendo...';
      out.textContent = 'Pensando...';
      try {
        const data = await callApi('/api/ai/assist', {
          method: 'POST',
          body: JSON.stringify({ module: moduleVal, context, selectedFiles })
        });
        if (data && data.ok !== false) {
          out.textContent = data.advice || JSON.stringify(data, null, 2);
          // Quick Actions debajo de la respuesta
          const c = getActionsContainer();
          c.innerHTML = '';
          const btnComp = mkBtn('Generar composición base', async () => {
            const plan = extractPlanFromText(out && out.textContent);
            const payload = {};
            if (plan.bpm) payload.bpm = plan.bpm;
            if (plan.key) payload.key = plan.key;
            if (plan.scale) payload.scale = plan.scale;
            if (plan.durationSec) payload.durationSec = Math.round(plan.durationSec);
            await callApi('/api/generate/composition', { method: 'POST', body: JSON.stringify(payload) });
            await refreshList();
            const extra = (payload.bpm || payload.key || payload.scale) ? ' con parámetros del plan.' : '.';
            toast(`Composición generada${extra}`, { type: 'success' });
          });
          // Nuevo: Drums y Synth
          const btnDrums = mkBtn('Generar Drums', async () => {
            await callApi('/api/generate/drums', { method: 'POST', body: '{}' });
            await refreshList();
            toast('Drums generados.', { type: 'success' });
          });
          const btnSynth = mkBtn('Generar Synth', async () => {
            await callApi('/api/generate/synth', { method: 'POST', body: '{}' });
            await refreshList();
            toast('Synth generado.', { type: 'success' });
          });
          // Nuevo: Generar TODO (Composición + Drums + Synth)
          const btnAll = mkBtn('Generar TODO', async () => {
            const plan = extractPlanFromText(out && out.textContent);
            const payload = {};
            if (plan.bpm) payload.bpm = plan.bpm;
            if (plan.key) payload.key = plan.key;
            if (plan.scale) payload.scale = plan.scale;
            if (plan.durationSec) payload.durationSec = Math.round(plan.durationSec);
            await callApi('/api/generate/composition', { method: 'POST', body: JSON.stringify(payload) });
            await callApi('/api/generate/drums', { method: 'POST', body: '{}' });
            await callApi('/api/generate/synth', { method: 'POST', body: '{}' });
            await refreshList();
            toast('Listo: composición + drums + synth generados.', { type: 'success' });
          });
          // Nuevo: Generar TODO + KeySnap (usa plan)
          const btnAllKey = mkBtn('Generar TODO + KeySnap', async () => {
            const plan = extractPlanFromText(out && out.textContent);
            const payload = {};
            if (plan.bpm) payload.bpm = plan.bpm;
            if (plan.key) payload.key = plan.key;
            if (plan.scale) payload.scale = plan.scale;
            if (plan.durationSec) payload.durationSec = Math.round(plan.durationSec);
            // Generar composición con parámetros (si existen)
            const comp = await callApi('/api/generate/composition', { method: 'POST', body: JSON.stringify(payload) });
            let compFile = comp && comp.file;
            // Generar drums y synth
            await callApi('/api/generate/drums', { method: 'POST', body: '{}' });
            await callApi('/api/generate/synth', { method: 'POST', body: '{}' });
            // Aplicar KeySnap si hay plan y archivo generado
            if (compFile && plan.key && plan.scale) {
              const KEY_TO_SEMITONE = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
              const targetKey = (KEY_TO_SEMITONE[plan.key] != null) ? KEY_TO_SEMITONE[plan.key] : 0;
              const scale = String(plan.scale || 'major').toLowerCase();
              const resp = await fetch('/api/effects/keysnap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: compFile, targetKey, scale }) });
              const json = await resp.json();
              if (!resp.ok || !json.ok) throw new Error(json.error || 'KeySnap failed');
              compFile = json.file || compFile;
            }
            await refreshList();
            toast(`Listo: composición + drums + synth generados${compFile ? ' (KeySnap aplicado).' : '.'}`, { type: 'success' });
          });
          const btnKey = mkBtn('Aplicar KeySnap', async () => {
            const f = firstSelectedFile();
            if (!f) {
              toast('Selecciona una pista en la lista de salidas.', { type: 'error' }); return;
            }
            const plan = extractPlanFromText(out && out.textContent);
            const KEY_TO_SEMITONE = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
            const defaultKey = (plan.key && KEY_TO_SEMITONE[plan.key]) != null ? KEY_TO_SEMITONE[plan.key] : 0;
            const defaultScale = plan.scale || 'major';
            const keyStr = window.prompt('Tono objetivo (0-11, C=0, C#=1, ...):', String(defaultKey));
            if (keyStr === null) return;
            const targetKey = Number(keyStr) || 0;
            const scale = (window.prompt('Escala (major/minor):', defaultScale) || defaultScale).toLowerCase();
            const resp = await fetch('/api/effects/keysnap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: f, targetKey, scale }) });
            const json = await resp.json();
            if (!resp.ok || !json.ok) throw new Error(json.error || 'KeySnap failed');
            await refreshList();
            toast(`KeySnap listo: ${json.file}`, { type: 'success' });
          });
          const btnLoadA = mkBtn('Cargar en Deck A', async () => {
            const f = firstSelectedFile();
            if (!f) {
              toast('Selecciona una pista en la lista de salidas.', { type: 'error' }); return;
            }
            if (typeof deckA !== 'undefined' && deckA) deckA.setSrc(`/output/${f}`);
          });
          const btnLoadB = mkBtn('Cargar en Deck B', async () => {
            const f = firstSelectedFile();
            if (!f) {
              toast('Selecciona una pista en la lista de salidas.', { type: 'error' }); return;
            }
            if (typeof deckB !== 'undefined' && deckB) deckB.setSrc(`/output/${f}`);
          });
          c.append(btnAllKey, btnAll, btnComp, btnDrums, btnSynth, btnKey, btnLoadA, btnLoadB);
        } else {
          out.textContent = `Error: ${data?.error || 'respuesta inválida'}`;
        }
      } catch (err) {
        out.textContent = `Error: ${err?.message || String(err)}`;
      } finally {
        btn.disabled = false; btn.textContent = prev;
      }
    });
  })();

  // Quick Navigation (creación dinámica) + scroll suave
  (function() {
    try {
      const grid = document.querySelector('main > section.grid') || document.querySelector('main .grid');
      if (!grid) return;

      const panels = Array.from(grid.querySelectorAll(':scope > .panel'));
      if (!panels.length) return;

      // Crear contenedor
      const nav = document.createElement('div');
      nav.className = 'quick-nav';

      // Generar botones según títulos h2
      panels.forEach(p => {
        const h2 = p.querySelector('h2');
        if (!h2) return;
        const id = h2.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (!p.id) p.id = `panel-${id}`;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = h2.textContent.trim();
        btn.addEventListener('click', () => {
          document.getElementById(p.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // resaltar
          btn.classList.add('active');
          setTimeout(() => btn.classList.remove('active'), 1200);
        });
        nav.appendChild(btn);
      });

      // Insertar nav antes del grid
      const parent = grid.parentElement;
      if (parent) parent.insertBefore(nav, grid);

      // Observador para activar botón según panel visible
      const map = new Map();
      const buttons = nav.querySelectorAll('button');
      panels.forEach((p, i) => map.set(p.id, buttons[i]));

      const io = new IntersectionObserver((entries) => {
        let best = null; let bestRatio = 0;
        for (const e of entries) {
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio; best = e.target;
          }
        }
        if (best && map.has(best.id)) {
          buttons.forEach(b => b.classList.remove('active'));
          map.get(best.id).classList.add('active');
        }
      }, { rootMargin: '-20% 0px -70% 0px', threshold: [0, 0.5, 1] });

      panels.forEach(p => io.observe(p));
    } catch {}
  })();

  // Reordenar paneles en la cuadrícula principal para priorizar flujos clave
  (function reorderPanelsOnceReady() {
    function reorder() {
      try {
        const grid = document.querySelector('main > section.grid');
        if (!grid) return;
        const mixer = document.querySelector('#mixer-pro');
        const credits = document.querySelector('#credits-panel');
        const pulses = document.querySelector('#pulses-panel');
        const bi = document.querySelector('#bi-panel');
        const outputsPanel = document.getElementById('output-list')?.closest('.panel');
        const orchestrPanel = document.getElementById('plan-pre')?.closest('.panel');
        const localPanel = document.getElementById('btn-composition')?.closest('.panel');
        const albumPanel = document.getElementById('album-title')?.closest('.panel');

        const desired = [mixer, outputsPanel, orchestrPanel, localPanel, credits, albumPanel, pulses, bi].filter(Boolean);
        if (desired.length && grid.firstElementChild === desired[0]) return;
        desired.forEach(el => {
          if (el && el.parentElement === grid) grid.appendChild(el);
        });
      } catch (_) { /* noop */ }
    }
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      reorder();
    } else {
      window.addEventListener('DOMContentLoaded', reorder, { once: true });
    }
  })();

  // WebMIDI: conectar y aprender crossfader
  const btnMidiConn = document.getElementById('midi-connect');
  const midiInputsSel = document.getElementById('midi-inputs');
  const btnMidiLearnX = document.getElementById('midi-learn-xfader');
  const midiStatusEl = document.getElementById('midi-status');
  let midiAccess = null; let midiInput = null; let midiLearnX = false;
  let midiMap = {};
  try {
    midiMap = JSON.parse(localStorage.getItem('midiMap') || '{}') || {};
  } catch {
    midiMap = {};
  }

  function setMidiStatus(t) {
    if (midiStatusEl) midiStatusEl.textContent = t || '';
  }

  function handleMidiMessage(e) {
    const [status, d1, d2] = e.data || [];
    const type = status & 0xF0; // 0xB0 = CC
    const ch = status & 0x0F;
    if (midiLearnX) {
      if (type === 0xB0) {
        midiMap.xfader = { type: 'cc', channel: ch, cc: d1 };
        try {
          localStorage.setItem('midiMap', JSON.stringify(midiMap));
        } catch {}
        setMidiStatus(`Crossfader asignado a CC ${d1} (canal ${ch + 1})`);
        midiLearnX = false;
        if (btnMidiLearnX) btnMidiLearnX.textContent = 'Aprender Crossfader';
      }
      return;
    }
    // Aplicar mapping existente
    if (midiMap.xfader && midiMap.xfader.type === 'cc' && type === 0xB0) {
      if (midiMap.xfader.channel === ch && midiMap.xfader.cc === d1) {
        const v = Math.max(0, Math.min(1, d2 / 127));
        if (xfaderEl) {
          xfaderEl.value = String(v); updateXfader();
        }
      }
    }
  }

  async function connectMIDI() {
    try {
      midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      setMidiStatus('MIDI listo');
      // Popular entradas
      if (midiInputsSel) {
        midiInputsSel.innerHTML = '<option value="">(elige dispositivo)</option>';
        for (const input of midiAccess.inputs.values()) {
          const opt = document.createElement('option');
          opt.value = input.id; opt.textContent = input.name || input.id;
          midiInputsSel.appendChild(opt);
        }
      }
      // Cambios en selección
      if (midiInputsSel && !midiInputsSel.dataset.bound) {
        midiInputsSel.addEventListener('change', () => {
          const id = midiInputsSel.value;
          if (midiInput) midiInput.onmidimessage = null;
          midiInput = null;
          if (!id) return;
          for (const input of midiAccess.inputs.values()) {
            if (input.id === id) {
              midiInput = input; break;
            }
          }
          if (midiInput) {
            midiInput.onmidimessage = handleMidiMessage;
            setMidiStatus(`Usando: ${midiInput.name || midiInput.id}`);
          }
        });
        midiInputsSel.dataset.bound = '1';
      }
    } catch (err) {
      setMidiStatus(`MIDI no disponible: ${err.message}`);
    }
  }

  if (btnMidiConn) btnMidiConn.addEventListener('click', connectMIDI);
  if (btnMidiLearnX) {
    btnMidiLearnX.addEventListener('click', () => {
      midiLearnX = !midiLearnX;
      setMidiStatus(midiLearnX ? 'Mueve un control para asignar crossfader...' : '');
      btnMidiLearnX.textContent = midiLearnX ? 'Cancel Learn' : 'Aprender Crossfader';
    });
  }

  // Pulsos: panel UI
  const btnPulsesLatest = document.getElementById('btn-pulses-latest');
  const btnPulsesGenerate = document.getElementById('btn-pulses-generate');
  const pulsesDaysInput = document.getElementById('pulses-days');
  const pulsesPre = document.getElementById('pulses-pre');
  const pulsesFileLink = document.getElementById('pulses-file-link');
  const pulsesSummary = document.getElementById('pulses-summary');

  function renderPulseSummary(pulse) {
    if (!pulsesSummary) return;
    try {
      pulsesSummary.innerHTML = '';
      if (!pulse || typeof pulse !== 'object') return;
      const items = [];
      // Metrics counters
      if (pulse.metrics && typeof pulse.metrics === 'object') {
        for (const [k, v] of Object.entries(pulse.metrics)) {
          const card = document.createElement('div');
          card.className = 'panel';
          card.innerHTML = `<h3 style="margin:0 0 6px 0;font-size:14px;">${k}</h3><div style="font-size:18px;font-weight:600;">${v}</div>`;
          items.push(card);
        }
      }
      // Insights highlights
      if (pulse.insights && typeof pulse.insights === 'object') {
        const { trends, actions } = pulse.insights;
        if (Array.isArray(trends) && trends.length) {
          const card = document.createElement('div');
          card.className = 'panel';
          card.innerHTML = `<h3 style="margin:0 0 6px 0;font-size:14px;">Tendencias</h3><ul style="margin:0;padding-left:16px;">${trends.map(t => `<li>${String(t)}</li>`).join('')}</ul>`;
          items.push(card);
        }
        if (Array.isArray(actions) && actions.length) {
          const card = document.createElement('div');
          card.className = 'panel';
          card.innerHTML = `<h3 style="margin:0 0 6px 0;font-size:14px;">Acciones</h3><ul style="margin:0;padding-left:16px;">${actions.map(a => `<li>${String(a)}</li>`).join('')}</ul>`;
          items.push(card);
        }
      }
      // Period summary
      if (pulse.period && pulse.period.days) {
        const card = document.createElement('div');
        card.className = 'panel';
        card.innerHTML = `<h3 style="margin:0 0 6px 0;font-size:14px;">Periodo</h3><div>${pulse.period.days} días</div>`;
        items.push(card);
      }
      if (items.length) items.forEach(el => pulsesSummary.appendChild(el));
    } catch (err) {
      // ignore fail softly
    }
  }

  function renderPulseResult(data) {
    try {
      const pulse = (data && (data.pulse || data)) || {};
      if (pulsesPre) pulsesPre.textContent = JSON.stringify(pulse, null, 2);
      renderPulseSummary(pulse);
      const href = (data && (data.jsonUrl || data.filePath || data.savedPath)) || '';
      if (href && pulsesFileLink) {
        pulsesFileLink.textContent = href;
        pulsesFileLink.href = href;
        pulsesFileLink.style.display = '';
      } else if (pulsesFileLink) {
        pulsesFileLink.textContent = '';
        pulsesFileLink.removeAttribute('href');
      }
    } catch (err) {
      if (pulsesPre) pulsesPre.textContent = `Error al renderizar: ${err.message}`;
    }
  }

  if (btnPulsesLatest && !btnPulsesLatest.dataset.bound) {
    btnPulsesLatest.addEventListener('click', async () => {
      const prev = btnPulsesLatest.textContent;
      btnPulsesLatest.disabled = true; btnPulsesLatest.textContent = 'Cargando...';
      try {
        const data = await callApi('/api/pulses/latest', { method: 'GET' });
        renderPulseResult(data);
      } catch (err) {
        if (pulsesPre) pulsesPre.textContent = `Error: ${err.message}`;
      } finally {
        btnPulsesLatest.disabled = false; btnPulsesLatest.textContent = prev;
      }
    });
    btnPulsesLatest.dataset.bound = '1';
  }

  if (btnPulsesGenerate && !btnPulsesGenerate.dataset.bound) {
    btnPulsesGenerate.addEventListener('click', async () => {
      const daysVal = parseInt((pulsesDaysInput && pulsesDaysInput.value) || '7', 10);
      const days = isNaN(daysVal) ? 7 : Math.max(1, Math.min(30, daysVal));
      const prev = btnPulsesGenerate.textContent;
      btnPulsesGenerate.disabled = true; btnPulsesGenerate.textContent = 'Generando...';
      try {
        const data = await callApi('/api/pulses/generate', { method: 'POST', body: JSON.stringify({ days }) });
        renderPulseResult(data);
        try {
          alert('Pulso generado.');
        } catch {}
      } catch (err) {
        if (pulsesPre) pulsesPre.textContent = `Error: ${err.message}`;
      } finally {
        btnPulsesGenerate.disabled = false; btnPulsesGenerate.textContent = prev;
      }
    });
    btnPulsesGenerate.dataset.bound = '1';
  }

  // BI: panel UI
  const biDaysInput = document.getElementById('bi-days');
  const btnBiTrends = document.getElementById('btn-bi-trends');
  const btnBiAudience = document.getElementById('btn-bi-audience');
  const btnBiRoi = document.getElementById('btn-bi-roi');
  const biSummary = document.getElementById('bi-summary');
  const biPre = document.getElementById('bi-pre');

  function renderBiSummary(kind, data) {
    if (!biSummary) return;
    try {
      biSummary.innerHTML = '';
      if (!data || typeof data !== 'object') return;
      const cards = [];

      function addCard(title, html) {
        const card = document.createElement('div');
        card.className = 'panel';
        card.innerHTML = `<h3 style="margin:0 0 6px 0;font-size:14px;">${title}</h3><div>${html}</div>`;
        cards.push(card);
      }
      if (kind === 'trends') {
        const days = data.days || [];
        addCard('Días analizados', String(days.length || (data.daysCount || 'N/D')));
        if (data.topEvents) {
          const items = Object.entries(data.topEvents).map(([k, v]) => `<li>${k}: ${v}</li>`).join('');
          addCard('Top eventos', `<ul style="margin:0;padding-left:16px;">${items}</ul>`);
        }
      } else if (kind === 'audience') {
        const segments = (data && (data.segments || data.audience || [])) || [];
        if (Array.isArray(segments) && segments.length) {
          addCard('Segmentos', `<ul style="margin:0;padding-left:16px;">${segments.map(s => `<li>${typeof s === 'string' ? s : JSON.stringify(s)}</li>`).join('')}</ul>`);
        }
        if (data.estimate) addCard('Tamaño estimado', String(data.estimate));
      } else if (kind === 'roi') {
        if (data.metrics) {
          const items = Object.entries(data.metrics).map(([k, v]) => `<li>${k}: ${v}</li>`).join('');
          addCard('Métricas', `<ul style="margin:0;padding-left:16px;">${items}</ul>`);
        }
        if (typeof data.roiScore !== 'undefined') addCard('ROI score', String(data.roiScore));
      }
      cards.forEach(c => biSummary.appendChild(c));
    } catch (err) { }
  }

  async function biFetch(endpoint, days) {
    const url = `${endpoint}?days=${encodeURIComponent(days)}`;
    return await callApi(url, { method: 'GET' });
  }

  function parseBiDays() {
    const val = parseInt((biDaysInput && biDaysInput.value) || '7', 10);
    return isNaN(val) ? 7 : Math.max(1, Math.min(30, val));
  }

  function showBiResult(kind, data) {
    if (biPre) {
      try {
        biPre.textContent = JSON.stringify(data, null, 2);
      } catch {
        biPre.textContent = String(data);
      }
    }
    renderBiSummary(kind, data);
  }

  if (btnBiTrends && !btnBiTrends.dataset.bound) {
    btnBiTrends.addEventListener('click', async () => {
      const days = parseBiDays();
      const prev = btnBiTrends.textContent;
      btnBiTrends.disabled = true; btnBiTrends.textContent = 'Cargando...';
      try {
        const data = await biFetch('/api/bi/trends', days);
        showBiResult('trends', data);
        try {
          await fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'bi_ui_trends', data: { days } }) });
        } catch {}
      } catch (err) {
        if (biPre) biPre.textContent = `Error: ${err.message}`;
      } finally {
        btnBiTrends.disabled = false; btnBiTrends.textContent = prev;
      }
    });
    btnBiTrends.dataset.bound = '1';
  }
  if (btnBiAudience && !btnBiAudience.dataset.bound) {
    btnBiAudience.addEventListener('click', async () => {
      const days = parseBiDays();
      const prev = btnBiAudience.textContent;
      btnBiAudience.disabled = true; btnBiAudience.textContent = 'Cargando...';
      try {
        const data = await biFetch('/api/bi/audience-dna', days);
        showBiResult('audience', data);
        try {
          await fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'bi_ui_audience', data: { days } }) });
        } catch {}
      } catch (err) {
        if (biPre) biPre.textContent = `Error: ${err.message}`;
      } finally {
        btnBiAudience.disabled = false; btnBiAudience.textContent = prev;
      }
    });
    btnBiAudience.dataset.bound = '1';
  }
  if (btnBiRoi && !btnBiRoi.dataset.bound) {
    btnBiRoi.addEventListener('click', async () => {
      const days = parseBiDays();
      const prev = btnBiRoi.textContent;
      btnBiRoi.disabled = true; btnBiRoi.textContent = 'Cargando...';
      try {
        const data = await biFetch('/api/bi/roi', days);
        showBiResult('roi', data);
        try {
          await fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'bi_ui_roi', data: { days } }) });
        } catch {}
      } catch (err) {
        if (biPre) biPre.textContent = `Error: ${err.message}`;
      } finally {
        btnBiRoi.disabled = false; btnBiRoi.textContent = prev;
      }
    });
    btnBiRoi.dataset.bound = '1';
  }

  // Cargar lista inicial
  refreshList();
});

// --- LÓGICA DEL CHATBOT ---
document.addEventListener('DOMContentLoaded', () => {
  const chatbotToggleBtn = document.getElementById('chatbot-toggle-btn');
  const chatbotWidget = document.getElementById('chatbot-widget');
  const chatbotCloseBtn = document.getElementById('chatbot-close-btn');
  const chatbotMessages = document.getElementById('chatbot-messages');
  const chatbotInput = document.getElementById('chatbot-input');
  const chatbotSendBtn = document.getElementById('chatbot-send-btn');

  // Asegurarse de que los elementos existen antes de añadir listeners
  if (!chatbotToggleBtn || !chatbotWidget || !chatbotCloseBtn || !chatbotMessages || !chatbotInput || !chatbotSendBtn) {
    console.warn('Elementos del chatbot no encontrados. La funcionalidad del bot no estará disponible.');
    return;
  }

  // Función para mostrar/ocultar el chatbot
  const toggleChatbot = () => {
    chatbotWidget.classList.toggle('hidden');
  };

  chatbotToggleBtn.addEventListener('click', toggleChatbot);
  chatbotCloseBtn.addEventListener('click', toggleChatbot);

  // Función para añadir un mensaje al chat
  const addMessage = (text, sender) => {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add(sender === 'bot' ? 'bot-message' : 'user-message');
    const p = document.createElement('p');
    p.textContent = text;
    messageDiv.appendChild(p);
    chatbotMessages.appendChild(messageDiv);
    // Hacer scroll hasta el último mensaje
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  };

  // Función para enviar el mensaje al backend
  const sendMessage = async () => {
    const userMessage = chatbotInput.value.trim();
    if (!userMessage) return;

    addMessage(userMessage, 'user');
    chatbotInput.value = '';

    // Asumimos que la clave de Gemini se guarda en localStorage desde otro panel de ajustes
    const geminiApiKey = localStorage.getItem('geminiApiKey');
    if (!geminiApiKey) {
      addMessage('Por favor, primero guarda tu API Key de Gemini en los ajustes para poder usar el chatbot.', 'bot');
      return;
    }

    addMessage('Pensando...', 'bot');

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiApiKey, userMessage: userMessage })
      });

      // Elimina el mensaje de "Pensando..."
      chatbotMessages.removeChild(chatbotMessages.lastChild);

      if (!response.ok) throw new Error((await response.json()).message || 'Error del asistente.');

      const data = await response.json();
      addMessage(data.reply.replace(/[*#]/g, '').trim(), 'bot');

    } catch (err) {
      chatbotMessages.removeChild(chatbotMessages.lastChild);
      addMessage(`Lo siento, ocurrió un error: ${err.message}`, 'bot');
    }
  };

  chatbotSendBtn.addEventListener('click', sendMessage);
  chatbotInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
});

// Hook Upload, KeySnap, and IPFS controls in Outputs panel
(function() {
  const uploadInput = document.getElementById('upload-input');
  const keysnapBtn = document.getElementById('btn-keysnap');
  const keysnapKeySel = document.getElementById('keysnap-key');
  const keysnapScaleSel = document.getElementById('keysnap-scale');
  const ipfsBtn = document.getElementById('btn-ipfs');
  const ipfsSpan = document.getElementById('ipfs-result');
  const outputList = document.getElementById('output-list');
  // NUEVO: Fingerprint/Copyright UI
  const fingerprintBtn = document.getElementById('btn-fingerprint');
  const copyrightBtn = document.getElementById('btn-copyright');
  const copyrightThr = document.getElementById('copyright-thr');
  const copyrightSpan = document.getElementById('copyright-result');

  async function refreshOutputList() {
    try {
      // Delegar al refresco avanzado si está disponible
      if (typeof window.refreshOutputList === 'function') {
        await window.refreshOutputList();
      } else if (typeof refreshList === 'function') {
        await refreshList();
      } else {
        console.warn('No hay función de refresco disponible');
      }
    } catch (err) {
      console.warn('refreshOutputList error', err);
    }
  }

  async function getSelectedFile() {
    // Usar la clase estándar de la lista avanzada
    const checks = outputList.querySelectorAll('.track-check');
    for (const c of checks) if (c.checked) return c.getAttribute('data-file');
    return null;
  }

  function getSelectedFiles(n = 2) {
    const files = [];
    const checks = outputList.querySelectorAll('.track-check');
    for (const c of checks) {
      if (c.checked) {
        files.push(c.getAttribute('data-file'));
        if (files.length >= n) break;
      }
    }
    return files;
  }

  if (uploadInput) {
    uploadInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      try {
        const resp = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || 'Upload failed');
        await fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'upload_ui', file: data.file }) });
        await refreshOutputList();
      } catch (err) {
        alert(`Error al subir: ${err.message}`);
      } finally {
        e.target.value = '';
      }
    });
  }

  if (keysnapBtn) {
    keysnapBtn.addEventListener('click', async () => {
      const f = await getSelectedFile();
      if (!f) {
        alert('Selecciona una pista en la lista de Salidas.'); return;
      }
      const targetKey = keysnapKeySel ? Number(keysnapKeySel.value) : 0;
      const scale = keysnapScaleSel ? keysnapScaleSel.value : 'major';
      try {
        const resp = await fetch('/api/effects/keysnap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: f, targetKey, scale }) });
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || 'KeySnap failed');
        await fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'keysnap_ui', file: data.file, data: { key: targetKey, scale } }) });
        await refreshOutputList();
      } catch (err) {
        alert(`Error en KeySnap: ${err.message}`);
      }
    });
  }

  if (ipfsBtn) {
    ipfsBtn.addEventListener('click', async () => {
      const f = await getSelectedFile();
      if (!f) {
        alert('Selecciona una pista para subir a IPFS.'); return;
      }
      try {
        ipfsSpan.textContent = 'Subiendo a IPFS...';
        const resp = await fetch('/api/ipfs/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: f }) });
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || 'IPFS upload failed');
        const a = document.createElement('a'); a.href = data.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Abrir en IPFS';
        ipfsSpan.innerHTML = '';
        ipfsSpan.appendChild(a);
        await fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'ipfs_ui', file: f, data: { cid: data.cid } }) });
      } catch (err) {
        ipfsSpan.textContent = '';
        alert(`Error al subir a IPFS: ${err.message}`);
      }
    });
  }

  // NUEVO: Fingerprint (WAV)
  if (fingerprintBtn) {
    fingerprintBtn.addEventListener('click', async () => {
      try {
        const f = await getSelectedFile();
        if (!f) {
          alert('Selecciona una pista (WAV) para fingerprint.'); return;
        }
        if (!/\.wav$/i.test(f)) {
          alert('Solo se soporta WAV para fingerprint.'); return;
        }
        const resp = await fetch('/api/library/fingerprint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: f }) });
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || 'Fingerprint failed');
        const base = f.replace(/\.wav$/i, '');
        const url = `/community/library/fingerprints/${encodeURIComponent(base)}.json`;
        try {
          await fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'fingerprint_ui', file: f }) });
        } catch {}
        alert(`Fingerprint creado. Abrir JSON: ${url}`);
        try {
          window.open(url, '_blank', 'noopener');
        } catch {}
      } catch (err) {
        alert(`Error en Fingerprint: ${err.message}`);
      }
    });
  }

  // NUEVO: Check Copyright (WAV A+B)
  if (copyrightBtn) {
    copyrightBtn.addEventListener('click', async () => {
      try {
        const [a, b] = getSelectedFiles(2);
        if (!a || !b) {
          alert('Selecciona 2 pistas (WAV) para comparar.'); return;
        }
        if (!/\.wav$/i.test(a) || !/\.wav$/i.test(b)) {
          alert('Solo se soporta WAV para comparación.'); return;
        }
        const thr = Math.max(0, Math.min(1, Number(copyrightThr && copyrightThr.value || 0.92)));
        const resp = await fetch('/api/library/check-copyright', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileA: a, fileB: b, threshold: thr }) });
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || 'Check copyright failed');
        const msg = `sim=${Number(data.similarity).toFixed(3)} thr=${Number(data.threshold).toFixed(2)} ${data.potentialCopy ? 'POTENCIAL COPIA' : 'OK'}`;
        if (copyrightSpan) {
          copyrightSpan.textContent = msg;
          copyrightSpan.style.color = data.potentialCopy ? '#f66' : '#6c6';
        } else {
          alert(msg);
        }
        try {
          await fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'copyright_ui', data: { fileA: a, fileB: b, sim: data.similarity, thr: data.threshold, potential: !!data.potentialCopy } }) });
        } catch {}
      } catch (err) {
        if (copyrightSpan) copyrightSpan.textContent = '';
        alert(`Error en Check Copyright: ${err.message}`);
      }
    });
  }

  // Initial load
  if (outputList) refreshOutputList();

  // Auto-SSE deshabilitado para evitar conexiones duplicadas y avisos en previsualización.
  // Usa el botón "Sync" para conectar manualmente si lo deseas.
})();

// ===== UI: Quick-nav behavior and hero hooks =====
(function () {
  try {
    const toast = window.__toast || ((msg) => console.log(msg));
    // Hero buttons
    const heroCreate = document.getElementById('hero-create');
    const heroExplore = document.getElementById('hero-explore');
    if (heroCreate) heroCreate.addEventListener('click', () => { window.scrollTo({ top: 420, behavior: 'smooth' }); toast('Vamos a crear música 🎶'); });
    if (heroExplore) heroExplore.addEventListener('click', () => { document.getElementById('output-list')?.scrollIntoView({ behavior: 'smooth' }); });

    // Quick-nav buttons scroll to the corresponding panel by data-target
    document.querySelectorAll('.quick-nav button').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target') || '';
        const panels = Array.from(document.querySelectorAll('main .panel'));
        const found = panels.find(p => (p.querySelector('h2') || {}).textContent?.toLowerCase().includes(target));
        if (found) found.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelectorAll('.quick-nav button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  } catch (err) { console.warn('Quick-nav setup failed', err); }
})();

// Paleta de Comandos (Ctrl/Cmd + K)
(function() {
  try {
    const dlg = document.getElementById('cmdk');
    const panel = dlg ? dlg.querySelector('.cmdk-panel') : null;
    const input = document.getElementById('cmdk-input');
    const list = document.getElementById('cmdk-list');
    if (!dlg || !input || !list) return;

    const actions = [
      { id: 'playA', label: 'Play Deck A', run: () => document.getElementById('btnA-play')?.click() },
      { id: 'pauseA', label: 'Pause Deck A', run: () => document.getElementById('btnA-pause')?.click() },
      { id: 'stopA', label: 'Stop Deck A', run: () => document.getElementById('btnA-stop')?.click() },
      { id: 'playB', label: 'Play Deck B', run: () => document.getElementById('btnB-play')?.click() },
      { id: 'pauseB', label: 'Pause Deck B', run: () => document.getElementById('btnB-pause')?.click() },
      { id: 'stopB', label: 'Stop Deck B', run: () => document.getElementById('btnB-stop')?.click() },
      { id: 'searchGithub', label: 'Buscar en GitHub…', run: () => {
        document.getElementById('gh-query')?.focus();
      } },
      { id: 'searchItunes', label: 'Buscar en iTunes…', run: () => {
        document.getElementById('itunes-query')?.focus();
      } },
      { id: 'mixAI', label: 'Componer con IA', run: () => {
        document.getElementById('btn-composition')?.click();
      } },
      { id: 'synthAI', label: 'Generar Synth con IA', run: () => {
        document.getElementById('btn-synth')?.click();
      } },
      { id: 'drumsAI', label: 'Generar Drums con IA', run: () => {
        document.getElementById('btn-drums')?.click();
      } },
      { id: 'keySnap', label: 'Aplicar KeySnap', run: () => {
        document.getElementById('btn-keysnap-apply')?.click();
      } },
      { id: 'creditsSave', label: 'Guardar créditos', run: () => {
        document.getElementById('btn-cred-save')?.click();
      } },
      { id: 'epkGenerate', label: 'Generar EPK', run: () => {
        document.getElementById('btn-epk-gen')?.click();
      } },
    ];

    let filtered = [];
    let active = -1;

    function render(q = '') {
      const s = q.toLowerCase();
      list.innerHTML = '';
      filtered = actions.filter(a => a.label.toLowerCase().includes(s));
      filtered.forEach((a, idx) => {
        const li = document.createElement('li');
        li.textContent = a.label;
        if (idx === 0) {
          li.classList.add('active'); active = 0;
        }
        li.addEventListener('click', () => {
          a.run(); close();
        });
        li.addEventListener('mousemove', () => {
          const all = list.querySelectorAll('li');
          all.forEach(x => x.classList.remove('active'));
          li.classList.add('active');
          active = idx;
        });
        list.appendChild(li);
      });
    }

    function open() {
      dlg.classList.remove('hidden');
      input.value = '';
      render('');
      setTimeout(() => input.focus(), 0);
    }

    function close() {
      dlg.classList.add('hidden');
      active = -1;
    }

    function move(delta) {
      const items = list.querySelectorAll('li');
      if (!items.length) return;
      active = (active + delta + items.length) % items.length;
      items.forEach((li, i) => {
        if (i === active) li.classList.add('active'); else li.classList.remove('active');
      });
      const cur = items[active];
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    }

    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (dlg.classList.contains('hidden')) open(); else close();
      }
      if (!dlg.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          e.preventDefault(); close();
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault(); move(1);
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault(); move(-1);
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (active >= 0 && filtered[active]) {
            filtered[active].run(); close();
          }
        }
      }
    });

    input.addEventListener('input', () => {
      active = -1; render(input.value);
    });

    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) close();
    });
    if (panel) panel.addEventListener('click', (e) => e.stopPropagation());
  } catch (err) {
    console.warn('cmdk init error', err);
  }
})();

// Advertencia BPS (no bloqueante) para Créditos & EPK
(function() {
  try {
    const splitsContainer = document.getElementById('cred-splits');
    const bpsSumSpan = document.getElementById('cred-bps-sum');
    const btnSave = document.getElementById('btn-cred-save');
    if (!splitsContainer || !bpsSumSpan || !btnSave) return;

    function getSum() {
      const inputs = splitsContainer.querySelectorAll('input[type="number"], input[data-kind="bps"]');
      let sum = 0; let count = 0;
      inputs.forEach(i => {
        const v = Number(i.value) || 0; sum += v; count++;
      });
      return { sum, count };
    }

    function renderSum() {
      const { sum, count } = getSum();
      bpsSumSpan.textContent = `BPS total: ${sum}`;
      if (count > 0) {
        bpsSumSpan.style.color = (sum === 10000) ? '#6c6' : '#f8b84e';
      } else {
        bpsSumSpan.style.color = '';
      }
    }

    splitsContainer.addEventListener('input', renderSum);
    splitsContainer.addEventListener('change', renderSum);
    setTimeout(renderSum, 0);

    // Confirmación suave al guardar si total != 10000 (no bloquea si aceptan)
    btnSave.addEventListener('click', (e) => {
      const { sum, count } = getSum();
      if (count > 0 && sum !== 10000) {
        const cont = window.confirm(`El BPS total es ${sum} (debería sumar 10000). ¿Deseas continuar?`);
        if (!cont) {
          e.stopImmediatePropagation(); e.preventDefault();
        }
      }
    }, true);
  } catch {}
})();

// Créditos & EPK — UI wiring
(function() {
  try {
    const peopleContainer = document.getElementById('cred-people');
    const splitsContainer = document.getElementById('cred-splits');
    const btnPeopleAdd = document.getElementById('btn-people-add');
    const btnSplitAdd = document.getElementById('btn-split-add');
    const btnSave = document.getElementById('btn-cred-save');
    const btnEpk = document.getElementById('btn-epk-gen');
    const pre = document.getElementById('cred-result');
    const epkLink = document.getElementById('epk-link');

    if (!peopleContainer || !splitsContainer || !btnPeopleAdd || !btnSplitAdd || !btnSave || !btnEpk) return;

    let lastSavedId = '';

    function mkInput(type, placeholder, value = '') {
      const i = document.createElement('input');
      i.type = type; i.placeholder = placeholder; i.value = value;
      return i;
    }

    function addPeopleRow(role = '', name = '') {
      const row = document.createElement('div');
      row.className = 'actions';
      row.style.gap = '8px';
      const inRole = mkInput('text', 'Rol', role); inRole.dataset.kind = 'role'; inRole.style.flex = '1';
      const inName = mkInput('text', 'Nombre', name); inName.dataset.kind = 'name'; inName.style.flex = '1';
      const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Eliminar';
      del.addEventListener('click', () => {
        row.remove();
      });
      row.append(inRole, inName, del);
      peopleContainer.appendChild(row);
    }

    function addSplitRow(party = '', bps = '') {
      const row = document.createElement('div');
      row.className = 'actions';
      row.style.gap = '8px';
      const inParty = mkInput('text', 'Parte (ej. Autor X)', party); inParty.dataset.kind = 'party'; inParty.style.flex = '1';
      const inBps = mkInput('number', 'BPS (0..10000)', String(bps)); inBps.dataset.kind = 'bps'; inBps.min = '0'; inBps.max = '10000'; inBps.step = '1'; inBps.style.width = '140px';
      const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Eliminar';
      del.addEventListener('click', () => {
        row.remove(); // actualizar suma
        splitsContainer.dispatchEvent(new Event('input', { bubbles: true }));
      });
      inBps.addEventListener('input', () => {
        splitsContainer.dispatchEvent(new Event('input', { bubbles: true }));
      });
      row.append(inParty, inBps, del);
      splitsContainer.appendChild(row);
      // trigger suma inicial
      splitsContainer.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function v(id) {
      const el = document.getElementById(id); return el ? (el.value || '').trim() : '';
    }

    function collectManifest() {
      const people = Array.from(peopleContainer.querySelectorAll('.actions')).map(row => {
        const role = row.querySelector('input[data-kind="role"]')?.value?.trim() || '';
        const name = row.querySelector('input[data-kind="name"]')?.value?.trim() || '';
        return (role || name) ? { role, name } : null;
      }).filter(Boolean);
      const splits = Array.from(splitsContainer.querySelectorAll('.actions')).map(row => {
        const party = row.querySelector('input[data-kind="party"]')?.value?.trim() || '';
        const bps = Number(row.querySelector('input[data-kind="bps"]')?.value || 0) || 0;
        return (party || bps) ? { party, bps } : null;
      }).filter(Boolean);
      const manifest = {
        title: v('cred-title'), artist: v('cred-artist'), cover: v('cred-cover'),
        isrc: v('cred-isrc'), iswc: v('cred-iswc'), upc: v('cred-upc'),
        spotify: v('cred-spotify'), apple: v('cred-apple'), youtube: v('cred-youtube'),
        instagram: v('cred-instagram'), website: v('cred-website'), contact: v('cred-contact'),
        notes: v('cred-notes'),
        people, splits
      };
      return manifest;
    }

    function showResult(obj) {
      if (pre) pre.textContent = JSON.stringify(obj, null, 2);
    }

    btnPeopleAdd.addEventListener('click', () => addPeopleRow());
    btnSplitAdd.addEventListener('click', () => addSplitRow());

    // Sembrar una fila inicial si está vacío
    setTimeout(() => {
      if (!peopleContainer.querySelector('.actions')) addPeopleRow();
      if (!splitsContainer.querySelector('.actions')) addSplitRow('', 0);
    }, 0);

    btnSave.addEventListener('click', async () => {
      try {
        const manifest = collectManifest();
        if (!manifest.title || !manifest.artist) throw new Error('Título y Artista son obligatorios');
        const resp = await fetch('/api/credits/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(manifest) });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar');
        lastSavedId = data.id || '';
        showResult({ action: 'credits/save', ...data });
        try {
          await fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'credits_ui_save', data: { id: lastSavedId } }) });
        } catch {}
        toast('Créditos guardados correctamente', { type: 'success' });
      } catch (err) {
        showResult({ error: err?.message || String(err) });
        toast(`Error al guardar: ${err?.message || err}`, { type: 'error' });
      }
    });

    btnEpk.addEventListener('click', async () => {
      try {
        let payload;
        if (lastSavedId) {
          payload = { id: lastSavedId };
        } else {
          const m = collectManifest();
          if (!m.title || !m.artist) throw new Error('Completa Título y Artista o guarda primero');
          payload = m;
        }
        const resp = await fetch('/api/epk/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || 'No se pudo generar EPK');
        showResult({ action: 'epk/generate', ...data });
        if (epkLink && data.path) {
          epkLink.textContent = data.path; epkLink.href = data.path;
        }
        try {
          await fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'epk_ui_generate', data: { id: data.id, path: data.path } }) });
        } catch { }
        toast('EPK generado correctamente', { type: 'success' });
      } catch (err) {
        showResult({ error: err?.message || String(err) });
        toast(`Error al generar EPK: ${err?.message || err}`, { type: 'error' });
      }
    });
  } catch (err) {
    console.warn('credits ui wiring error', err);
  }
})();

// --- Lógica para el panel de Generación Creativa ---
(function() {
  const creativeGenerateBtn = document.getElementById('generate-creative-btn');
  const creativeAudioPlayer = document.getElementById('creative-audio-player');
  const exportMidiBtn = document.getElementById('export-midi-btn');
  const evolveBtn = document.getElementById('evolve-btn');
  const variationsContainer = document.getElementById('evolve-variations-container');

  const keySelect = document.getElementById('key-select');
  const scaleSelect = document.getElementById('scale-select');
  const tempoSlider = document.getElementById('tempo-slider');
  const tempoValue = document.getElementById('tempo-value');

  // NUEVO: Elementos para la nueva funcionalidad interactiva
  const renderToWavBtn = document.createElement('button');
  renderToWavBtn.id = 'render-to-wav-btn';
  renderToWavBtn.textContent = 'Renderizar a WAV';
  renderToWavBtn.disabled = true;
  creativeGenerateBtn.parentElement.appendChild(renderToWavBtn);

  let lastGeneratedMusicData = null; // Almacenará las notas y parámetros

  if (tempoSlider) {
    tempoSlider.addEventListener('input', () => {
      tempoValue.textContent = tempoSlider.value;
    });
  }

  // --- NUEVO: El motor de audio de Tone.js ---
  let synth; let bassSynth; let chordsSynth;

  function setupTone() {
    if (synth) return; // Ya está configurado

    // Un sintetizador polifónico para la melodía y los acordes
    synth = new Tone.PolySynth(Tone.FMSynth, {
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }
    }).toDestination();

    // Un sintetizador monofónico para el bajo
    bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'fmsquare' },
      envelope: { attack: 0.05, release: 0.5 }
    }).toDestination();

    // Un sintetizador para los acordes con un sonido más suave
    chordsSynth = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 1.5,
      envelope: { attack: 0.1, release: 1.5 }
    }).toDestination();

    console.log('Motor de audio Tone.js inicializado.');
  }

  async function playMusicWithTone(musicData) {
    await Tone.start(); // El usuario debe interactuar con la página primero
    setupTone();

    // Detener cualquier reproducción anterior
    Tone.Transport.cancel();

    // Programar las nuevas notas
    const { melody, bass, chords } = musicData.notes;

    if (melody) {
      new Tone.Part((time, note) => {
        synth.triggerAttackRelease(Tone.Frequency(note.pitch, 'midi'), note.duration, time, note.velocity);
      }, melody).start(0);
    }
    if (bass) {
      new Tone.Part((time, note) => {
        bassSynth.triggerAttackRelease(Tone.Frequency(note.pitch, 'midi'), note.duration, time, note.velocity);
      }, bass).start(0);
    }
    if (chords) {
      new Tone.Part((time, note) => {
        // Tone.js PolySynth puede tocar acordes si el pitch es un array de notas
        const chordPitches = Array.isArray(note.pitch) ? note.pitch.map(p => Tone.Frequency(p, 'midi')) : Tone.Frequency(note.pitch, 'midi');
        chordsSynth.triggerAttackRelease(chordPitches, note.duration, time, note.velocity);
      }, chords).start(0);
    }

    // Iniciar la reproducción
    Tone.Transport.start();
    toast('Reproduciendo al instante... ✨', { type: 'info' });
  }
  // --- FIN: Motor de audio Tone.js ---

  if (creativeGenerateBtn) {
    creativeGenerateBtn.addEventListener('click', async () => {
      console.log('Iniciando generación creativa...');
      creativeGenerateBtn.textContent = 'Generando...';
      creativeGenerateBtn.disabled = true;
      exportMidiBtn.disabled = true;
      renderToWavBtn.disabled = true;
      evolveBtn.disabled = true;

      const params = {
        key: keySelect.value,
        scale: scaleSelect.value,
        tempo: parseInt(tempoSlider.value, 10),
        drumPattern: document.getElementById('drum-pattern-select').value, // Asegúrate de que este ID existe
      };

      try {
        // Llamamos al endpoint que ahora solo devuelve notas
        const data = await callApi('/generate-creative', {
          method: 'POST',
          body: JSON.stringify(params),
        });

        // ¡MAGIA! Reproducir la música al instante
        await playMusicWithTone(data);

        lastGeneratedMusicData = { notes: data.notes, params: data.params }; // Guardamos todo
        exportMidiBtn.disabled = false; // Habilitamos la exportación
        renderToWavBtn.disabled = false; // Habilitamos el renderizado a WAV
        evolveBtn.disabled = false; // ¡Habilitamos la evolución!

      } catch (err) {
        console.error('Error en la generación creativa:', err);
        toast(`Error: ${err.message}`, { type: 'error' });
      } finally {
        creativeGenerateBtn.textContent = 'Generar de Nuevo';
        creativeGenerateBtn.disabled = false;
      }
    });
  }

  // NUEVO: Listener para el botón de renderizar a WAV
  renderToWavBtn.addEventListener('click', async () => {
    if (!lastGeneratedMusicData) {
      toast('Primero genera música para poder renderizarla.', { type: 'error' });
      return;
    }
    const stopLoading = setLoading(renderToWavBtn, 'Renderizando...');
    try {
      const musicData = {
        notes: lastGeneratedMusicData.notes,
        duration: lastGeneratedMusicData.notes.duration, // Asumiendo que tu generador lo provee
        tempo: parseInt(tempoSlider.value, 10)
      };
      const result = await callApi('/api/render-music', {
        method: 'POST',
        body: JSON.stringify({ musicData })
      });
      toast('¡Audio renderizado a WAV!', { type: 'success' });
      await refreshList(); // Refrescar la lista de salidas
    } catch (err) {
      toast(`Error en el renderizado: ${err.message}`, { type: 'error' });
    } finally {
      stopLoading();
    }
  });

  // --- NUEVO: Lógica para el botón "Evolve con IA" ---
  evolveBtn.addEventListener('click', async () => {
    if (!lastGeneratedMusicData) {
      toast('Primero genera una idea para poder evolucionarla.', { type: 'error' });
      return;
    }

    const stopLoading = setLoading(evolveBtn, 'Evolucionando con IA...');
    variationsContainer.innerHTML = '<p class="hint">La IA está componiendo variaciones...</p>';

    try {
      const response = await callApi('/api/evolve-with-ai', {
        method: 'POST',
        body: JSON.stringify(lastGeneratedMusicData)
      });

      variationsContainer.innerHTML = ''; // Limpiar el contenedor
      const variationTypes = {
        rhythmic: 'Variación Rítmica 🥁',
        melodic: 'Variación Melódica 🎼',
        complex: 'Variación Compleja 🧠'
      };

      for (const key in response.variations) {
        const variation = response.variations[key];
        const btn = document.createElement('button');
        btn.textContent = variationTypes[key] || `Variación ${key}`;
        btn.addEventListener('click', async () => {
          toast(`Reproduciendo: ${btn.textContent}`, { type: 'info' });
          await playMusicWithTone({ notes: variation });
          // Opcional: actualizar la música base con la variación seleccionada
          lastGeneratedMusicData = { notes: variation, params: lastGeneratedMusicData.params };
        });
        variationsContainer.appendChild(btn);
      }
    } catch (err) {
      toast(`Error al evolucionar: ${err.message}`, { type: 'error' });
      variationsContainer.innerHTML = '<p class="hint error">No se pudieron generar las variaciones.</p>';
    } finally {
      stopLoading();
    }
  });

  if (exportMidiBtn) {
    exportMidiBtn.addEventListener('click', async () => {
      if (!lastGeneratedMusicData) {
        toast('Primero debes generar música para poder exportarla.', { type: 'error' });
        return;
      }

      try {
        const response = await fetch('/export-midi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: lastGeneratedMusicData.notes,
            tempo: parseInt(tempoSlider.value, 10)
          }),
        });

        if (!response.ok) throw new Error('Error al exportar a MIDI');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'aether-sound-creative.mid';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast('Archivo MIDI descargado.', { type: 'success' });

      } catch (err) {
        console.error('Error al exportar a MIDI:', err);
        toast('No se pudo exportar el archivo MIDI.', { type: 'error' });
      }
    });
  }
})();
