require('dotenv').config();
const express = require('express');
const path = require('node:path');
const fs = require('node:fs'); // usar la API completa (sync + callbacks)
const fsp = fs.promises; // para accesos async/await donde sea necesario
const multer = require('multer');
const crypto = require('node:crypto'); // Módulo nativo de Node.js para criptografía
// FormData se crea dinámicamente cuando sea necesario (evita dependencia en dev)
const { Midi } = require('@tonejs/midi');
const fetch = require('node-fetch');
const FormData = require('form-data');

// const masteringEngineRouter = require('./src/routes/mastering-engine');
// const aiOrchestratorRouter = require('./src/routes/ai-orchestrator');

const generateCreativeMusic = require('./src/generators/creative-generator.js');
const renderAudio = require('./src/utils/audio-renderer.js');
const { generateComposition } = require('./src/generators/composition-generator');
const { generateDrums } = require('./src/generators/drum-generator');
const { generateSynth } = require('./src/generators/render-simple-synth');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuración de Multer para subida de archivos ---
const uploadDir = path.join(__dirname, 'uploads');
// Función para asegurar que los directorios existen (ya la tenías, es perfecta)
const ensureDir = async (dirPath) => await fsp.mkdir(dirPath, { recursive: true });

const upload = multer({ dest: uploadDir });

// Middlewares de seguridad
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Configurar límites de peticiones
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de 100 peticiones por ventana
});

// Middlewares
app.use(helmet()); // Seguridad básica
app.use(cors()); // Permitir CORS
app.use(limiter); // Rate limiting
app.use(express.json()); // Para parsear JSON en el body de las peticiones
app.use(express.static(path.join(__dirname, 'public'))); // Servir archivos estáticos desde /public
app.use('/output', express.static(path.join(__dirname, 'output'))); // Servir archivos generados
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Servir archivos subidos
// app.use('/api/mastering', masteringEngineRouter);

// Endpoint de prueba
app.get('/test', (req, res) => {
  res.json({ status: 'ok', message: 'Aether-Sound API está funcionando' });
});

// --- NUEVO: LÓGICA PARA RECONOCIMIENTO MUSICAL (Aether-ID) ---

/**
 * Llama a la API de Gemini para tareas de generación de texto o JSON.
 * @param {String} apiKey La clave de API para autenticar.
 * @param {String} prompt El prompt completo para la IA.
 * @returns {Promise<string>} La respuesta de texto de la IA.
 */
async function callGeminiAPI(apiKey, prompt) {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      // Añadir configuración de seguridad para evitar respuestas dañinas
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Error de Gemini: ${error.error?.message || JSON.stringify(error)}`);
  }
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

/**
 * Llama a la API de ACRCloud para identificar una canción desde un archivo de audio.
 * @param {Buffer} audioBuffer - El buffer del archivo de audio a identificar.
 * @returns {Promise<object>} - Los metadatos de la canción identificada.
 */
async function identifySongWithACRCloud(audioBuffer) {
  const { ACR_HOST, ACR_ACCESS_KEY, ACR_ACCESS_SECRET } = process.env;

  if (!ACR_HOST || !ACR_ACCESS_KEY || !ACR_ACCESS_SECRET) {
    throw new Error('Las credenciales de ACRCloud no están configuradas en el archivo .env');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = `POST\n/v1/identify\n${ACR_ACCESS_KEY}\naudio\n1\n${timestamp}`;

  const signature = crypto
    .createHmac('sha1', ACR_ACCESS_SECRET)
    .update(stringToSign)
    .digest('base64');

  const formData = new FormData();
  formData.append('sample', audioBuffer, { filename: 'sample.wav' });
  formData.append('access_key', ACR_ACCESS_KEY);
  formData.append('data_type', 'audio');
  formData.append('signature_version', '1');
  formData.append('signature', signature);
  formData.append('sample_bytes', audioBuffer.length);
  formData.append('timestamp', timestamp);

  const response = await fetch(`https://${ACR_HOST}/v1/identify`, {
    method: 'POST',
    body: formData,
    headers: formData.getHeaders(),
  });

  const result = await response.json();

  if (result.status.code !== 0) {
    if (result.status.code === 1001) {
      // Código 1001 significa "No result", lo cual no es un error técnico.
      return { success: false, message: 'No se encontró ninguna coincidencia.' };
    }
    throw new Error(`Error de ACRCloud: ${result.status.msg} (código: ${result.status.code})`);
  }

  // Devolvemos solo la primera y más relevante coincidencia.
  const musicInfo = result.metadata.music[0];
  return { success: true, data: musicInfo };
}

// --- FIN LÓGICA Aether-ID ---

// app.use('/api/ai', aiOrchestratorRouter);

// --- NUEVO: ORQUESTADOR DE IA ---

// --- FIN ORQUESTADOR ---

// Middleware de seguridad para proteger tu propia API (Opcional pero recomendado)
const internalApiKeyAuth = (req, res, next) => {
  const userApiKey = req.header('x-internal-api-key');
  if (userApiKey && userApiKey === process.env.AETHER_SOUND_API_KEY) {
    next(); // Clave interna correcta, continuar
  } else {
    // Si no es una llamada interna, simplemente continuamos para el modelo BYOK
    next();
  }
};

// --- RUTAS PRINCIPALES ---

// Ruta principal para servir el index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- NUEVA RUTA PARA IDENTIFICAR CANCIONES ---
app.post('/api/identify-song', upload.single('audio_sample'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se ha subido ningún archivo de audio.' });
  }

  const filePath = req.file.path;

  try {
    const audioBuffer = await fs.readFile(filePath);
    const identificationResult = await identifySongWithACRCloud(audioBuffer);
    res.json(identificationResult);
  } catch (err) {
    console.error('Error en /api/identify-song:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    await fs.unlink(filePath); // Limpiar el archivo subido después de usarlo
  }
});

// Listar archivos de output (usado por el cliente)
app.get('/api/output', (req, res) => {
  try {
    const outDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outDir)) return res.json({ files: [] });
    const files = fs.readdirSync(outDir).filter(f => f.endsWith('.wav') || f.endsWith('.mp3') || f.endsWith('.ogg'));
    res.json({ files });
  } catch (err) {
    console.error('Error leyendo output:', err);
    res.status(500).json({ error: 'No se pudo listar output' });
  }
});

// Pitch shift (placeholder simple): copia el archivo con sufijo
app.post('/api/effects/pitch-shift', async (req, res) => {
  try {
    const { file, semitones, preserveDuration } = req.body || {};
    if (!file) return res.status(400).json({ ok: false, error: 'file requerido' });
    const outDir = path.join(__dirname, 'output');
    const src = path.join(outDir, file);
    if (!fs.existsSync(src)) return res.status(404).json({ ok: false, error: 'archivo no encontrado' });
    const targetName = `${path.parse(file).name}_ps${semitones || 0}${path.extname(file)}`;
    const target = path.join(outDir, targetName);
    // Simplemente clonar el archivo como placeholder
    fs.copyFileSync(src, target);
    return res.json({ ok: true, file: targetName });
  } catch (err) {
    console.error('Error pitch-shift:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- NUEVA RUTA PARA EL CHATBOT ---
app.post('/api/chatbot', async (req, res) => {
  // ¡ALERTA DE SEGURIDAD! La clave API no debería viajar desde el cliente.
  // Se asume que el servidor tiene su propia clave para el chatbot.
  const { userMessage } = req.body;
  const chatbotApiKey = process.env.AETHER_CHATBOT_API_KEY; // Usar una clave del servidor

  if (!chatbotApiKey || !userMessage) {
    console.error('Falta la clave API del chatbot en el servidor o el mensaje del usuario.');
    return res.status(400).json({ message: 'Falta el mensaje del usuario o hay un problema de configuración en el servidor.' });
  }

  // Contexto detallado para la IA. ¡Esto es crucial!
  const systemPrompt = `
    Eres "AetherBot", un asistente de IA amigable y experto, integrado en la aplicación web "Aether-Sound".
    Tu propósito es ayudar a los usuarios a entender y utilizar Aether-Sound.
    Aether-Sound es una suite de generación musical algorítmica y asistida por IA.

    Aquí tienes un resumen de las funcionalidades de la web:
    - Generación Local: Permite crear composiciones, baterías o sonidos de sintetizador con algoritmos predefinidos.
    - Generación Creativa: El usuario controla la tonalidad, escala, tempo y patrón de batería para guiar la creación musical. Incluye una función "Evolve" para generar variaciones.
    - Orquestación IA: Los usuarios pueden usar sus propias API Keys (de Gemini, OpenAI, etc.) para generar música a partir de descripciones de texto (prompts). Es un modelo "Trae tu propia clave" (BYOK).
    - Salidas (Outputs): Una lista de todos los archivos de audio generados, con opciones para filtrar, mezclar, aplicar efectos y compartir.
    - Mixer Pro: Una interfaz de DJ con dos platos (Decks A y B), crossfader, efectos, y la capacidad de cargar pistas locales o buscar música.
    - Asistente de Masterización IA: Analiza una pista y ofrece sugerencias para mejorar su sonido.
    - Álbum y Publicación: Herramientas para agrupar pistas en un álbum y prepararlas para distribución en plataformas como Hedera o Spotify (funcionalidad en desarrollo).

    Tus reglas de comportamiento son:
    1. Sé siempre amable, servicial y positivo. Usa emojis para hacer la conversación más amena. 😊
    2. Responde de forma concisa y directa a las preguntas del usuario sobre Aether-Sound.
    3. Si un usuario pregunta cómo hacer algo, guíalo a la sección correcta de la web. Por ejemplo, si pregunta "cómo creo música con texto", dile que vaya a "Orquestación IA" y use su API Key.
    4. Si un usuario reporta un error o un problema que no puedes resolver, o si la pregunta es muy compleja, responde con lo siguiente: "Vaya, parece que esa es una pregunta para mis creadores. 🧑‍💻 Por favor, contacta al equipo de soporte en support@aethersound.io para obtener ayuda detallada. ¡Gracias por tu paciencia!"
    5. Si te preguntan por una API Key, explica que deben obtenerla de los proveedores oficiales (como Google AI Studio para Gemini) y luego guardarla en la sección de "Ajustes de API Keys" de la web. NUNCA inventes ni proporciones una clave.
    6. No respondas a preguntas que no estén relacionadas con Aether-Sound o la producción musical. Si te preguntan sobre el clima o política, amablemente redirige la conversación de vuelta a la aplicación.

    Ahora, responde a la siguiente pregunta del usuario:
  `;

  try {
    // Ahora usamos la función real
    const botResponse = await callGeminiAPI(chatbotApiKey, `${systemPrompt} "${userMessage}"`);
    // Limpiamos un poco la respuesta por si acaso
    const cleanResponse = botResponse.replace(/[*#]/g, '').trim();
    if (!cleanResponse) {
      res.json({ reply: 'No he podido procesar esa pregunta. ¿Puedes intentar reformularla? 🤔' });
    }
    res.json({ reply: botResponse });
  } catch (err) {
    console.error('Error en el chatbot:', err);
    res.status(500).json({ message: `Error del Asistente: ${err.message}` });
  }
});

// RUTA MODIFICADA: Ahora solo recibe las instrucciones musicales para renderizar.
app.post('/api/render-music', async (req, res) => {
  const { musicData } = req.body;

  if (!musicData || !musicData.notes || !musicData.duration) {
    return res.status(400).json({ message: 'Faltan datos musicales (musicData) para renderizar.' });
  }

  try {
    // La llamada a la IA ahora se hace en el cliente.
    // El servidor solo se encarga de renderizar el audio.
    console.log('Recibido para renderizar:', musicData);

    const outputDir = path.join(__dirname, 'output');
    await ensureDir(outputDir); // Asegurar que el directorio existe

    const filename = `ai_generated_${Date.now()}.wav`;
    const outputPath = path.join(outputDir, filename);

    await renderAudio(musicData.notes, outputPath, musicData.duration, musicData.tempo || 120);

    // 4. Devolver la URL del audio al cliente
    res.json({ ok: true, audioUrl: `/output/${filename}` });

  } catch (err) {
    console.error('Error en la renderización de música IA:', err);
    res.status(500).json({ message: err.message });
  }
});

// Endpoint para la generación creativa de música
app.post('/generate-creative', (req, res) => { // No necesita ser async ahora
  try {
    const params = req.body; // { key, scale, tempo, drumPattern }

    if (!params.key || !params.scale || !params.tempo) {
      return res.status(400).json({ ok: false, message: 'Faltan parámetros: key, scale o tempo.' });
    }

    console.log(`Recibida petición para generar notas: ${params.key} ${params.scale} a ${params.tempo} BPM`);

    // 1. Generar la estructura de notas
    const musicData = generateCreativeMusic(params);

    // 2. Responder al frontend INMEDIATAMENTE con los datos de las notas
    res.json({
      ok: true,
      notes: musicData.notes,
      params: params, // Devolvemos los parámetros usados
    });

  } catch (err) {
    console.error('Error en /generate-creative:', err);
    res.status(500).json({ ok: false, message: 'Error interno del servidor al generar la música.' });
  }
});

// NUEVO: Endpoint para "Evolve"
app.post('/api/evolve-with-ai', async (req, res) => {
  try {
    const { notes, params } = req.body;
    if (!notes || !params) {
      return res.status(400).json({ ok: false, message: 'Faltan parámetros para evolucionar.' });
    }
    const aiApiKey = process.env.AETHER_CHATBOT_API_KEY; // Reutilizamos la clave
    if (!aiApiKey) {
      throw new Error('La clave API para la IA no está configurada en el servidor.');
    }

    // Prompt de ingeniería para la IA. ¡Esto es el núcleo de la magia!
    const evolutionPrompt = `
      Eres un compositor experto en IA. Dada una secuencia de notas MIDI base para una melodía, bajo y acordes, genera 3 variaciones musicales coherentes.
      La base es en ${params.key} ${params.scale} a ${params.tempo} BPM.
      Las variaciones deben mantener la misma duración y estructura general.

      Variación 1: "Variación Rítmica". Mantén la melodía principal similar, pero altera significativamente el ritmo para darle un nuevo groove.
      Variación 2: "Variación Melódica". Mantén el ritmo similar, pero altera las notas de la melodía, explorando notas de la escala que no estaban en la base.
      Variación 3: "Compleja". Toma la idea original y hazla más compleja, añadiendo más notas, arpegios o una contramelodía.

      Devuelve SÓLO un objeto JSON con tres claves: "rhythmic", "melodic", "complex". Cada clave debe contener un objeto de notas completo (con 'melody', 'bass', 'chords').
      
      Aquí está la base de notas en formato JSON:
      ${JSON.stringify(notes)}
    `;

    console.log('Pidiendo a la IA que evolucione la música...');
    const aiResponseText = await callGeminiAPI(aiApiKey, evolutionPrompt);

    // Limpiar y parsear la respuesta de la IA
    const jsonString = aiResponseText.replace(/```json|```/g, '').trim();
    const variations = JSON.parse(jsonString);

    res.json({ ok: true, variations });

  } catch (err) {
    console.error('Error en /api/evolve-with-ai:', err);
    res.status(500).json({ ok: false, message: 'Error interno del servidor al evolucionar.' });
  }
});

// Endpoint para exportar a MIDI
app.post('/export-midi', (req, res) => {
  const { notes, tempo } = req.body;

  if (!notes || !tempo) {
    return res.status(400).json({ ok: false, message: 'Faltan datos de notas o tempo.' });
  }

  try {
    const midi = new Midi();
    midi.header.setTempo(tempo);

    // Añadir cada parte (melodía, acordes, etc.) a su propia pista MIDI
    Object.entries(notes).forEach(([partName, noteArray]) => {
      const track = midi.addTrack();
      track.name = partName;

      noteArray.forEach(note => {
        track.addNote({
          midi: note.pitch,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity || 0.9
        });
      });
    });

    const midiBuffer = Buffer.from(midi.toArray());

    res.set({
      'Content-Type': 'audio/midi',
      'Content-Disposition': 'attachment; filename="aether-sound-creative.mid"',
    });
    res.send(midiBuffer);
  } catch (err) {
    console.error('Error al exportar a MIDI:', err);
    res.status(500).json({ ok: false, message: 'Error interno al crear el archivo MIDI.' });
  }
});

// Función para verificar el puerto
const checkPort = (port) => new Promise((resolve, reject) => {
  const test = require('node:net').createServer()
    .once('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Puerto ${port} está en uso, intentando ${port + 1}`);
        resolve(checkPort(port + 1));
      } else {
        reject(err);
      }
    })
    .once('listening', () => {
      test.once('close', () => resolve(port)).close();
    })
    .listen(port);
});

const startServer = async () => {
  try {
    console.log('Creando directorios necesarios...');
    await ensureDir(uploadDir);
    await ensureDir(path.join(__dirname, 'output'));
    console.log('Directorios creados correctamente');

    const server = app.listen(PORT, () => {
      console.log(`Aether-Sound escuchando en http://localhost:${PORT}`);
      console.log('Directorios de trabajo:');
      console.log(`- Uploads: ${uploadDir}`);
      console.log(`- Output: ${path.join(__dirname, 'output')}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Error: El puerto ${PORT} ya está en uso`);
      } else {
        console.error('Error en el servidor:', error);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('Error al iniciar el servidor:', err);
    process.exit(1);
  }
};

startServer();
