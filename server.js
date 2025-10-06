require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Midi } = require('@tonejs/midi');

const masteringEngineRouter = require('./src/routes/mastering-engine');
const aiOrchestratorRouter = require('./src/routes/ai-orchestrator');

const generateCreativeMusic = require('./src/generators/creative-generator');
const renderAudio = require('./src/core/audio-renderer');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuración de Multer para subida de archivos ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: uploadDir });

// Middlewares
app.use(express.json()); // Para parsear JSON en el body de las peticiones
app.use(express.static(path.join(__dirname, 'public'))); // Servir archivos estáticos de la carpeta 'public'
app.use('/output', express.static(path.join(__dirname, 'output'))); // Servir archivos generados
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Servir archivos subidos
app.use('/api/mastering', masteringEngineRouter);
app.use('/api/ai', aiOrchestratorRouter);

// --- RUTAS PRINCIPALES ---

// Ruta principal para servir el index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint para la generación creativa de música
app.post('/generate-creative', async (req, res) => {
  try {
    const params = req.body; // { key, scale, tempo, drumPattern }

    if (!params.key || !params.scale || !params.tempo) {
      return res.status(400).json({ ok: false, message: 'Faltan parámetros: key, scale o tempo.' });
    }

    console.log(`Recibida petición para generar: ${params.key} ${params.scale} a ${params.tempo} BPM con batería ${params.drumPattern}`);

    // 1. Generar la estructura de notas
    const musicData = generateCreativeMusic(params);

    // 2. Renderizar el audio a un archivo .wav
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    const filename = `creative_${params.key}_${params.scale}_${Date.now()}.wav`;
    const outputPath = path.join(outputDir, filename);

    await renderAudio(musicData.notes, outputPath, musicData.duration, params.tempo);

    console.log(`Audio generado y guardado en: ${filename}`);

    // 3. Responder al frontend con la URL del audio y los datos de las notas
    res.json({
      ok: true,
      audioUrl: `/output/${filename}`,
      notes: musicData.notes,
      params: params, // Devolvemos los parámetros usados
    });

  } catch (error) {
    console.error('Error en /generate-creative:', error);
    res.status(500).json({ ok: false, message: 'Error interno del servidor al generar la música.' });
  }
});

// NUEVO: Endpoint para "Evolve"
app.post('/evolve-creative', async (req, res) => {
  try {
    const { params } = req.body;
    if (!params) {
      return res.status(400).json({ ok: false, message: 'Faltan parámetros para evolucionar.' });
    }

    console.log(`Recibida petición para evolucionar desde: ${params.key} ${params.scale}`);

    const variations = [];
    const outputDir = path.join(__dirname, 'output');

    // Generar 3 variaciones
    for (let i = 0; i < 3; i++) {
      // La naturaleza aleatoria de nuestro generador actual ya crea variaciones.
      // En un futuro, aquí se podría llamar a un modelo de IA más avanzado.
      const musicData = generateCreativeMusic(params);
      
      const filename = `evolved_${params.key}_${params.scale}_${Date.now()}_${i}.wav`;
      const outputPath = path.join(outputDir, filename);

      await renderAudio(musicData.notes, outputPath, musicData.duration, params.tempo);

      variations.push({
        audioUrl: `/output/${filename}`,
        notes: musicData.notes,
        params: params,
      });
    }

    console.log('Variaciones generadas con éxito.');

    res.json({
      ok: true,
      variations,
    });

  } catch (error) {
    console.error('Error en /evolve-creative:', error);
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
        })

        const midiBuffer = Buffer.from(midi.toArray());

        res.set({
            'Content-Type': 'audio/midi',
            'Content-Disposition': 'attachment; filename="aether-sound-creative.mid"',
        });
        res.send(midiBuffer);
    } catch (error) {
        console.error('Error al exportar a MIDI:', error);
        res.status(500).json({ ok: false, message: 'Error interno al crear el archivo MIDI.' });
    }
});

app.listen(PORT, () => {
  console.log(`Aether-Sound escuchando en http://localhost:${PORT}`);
});