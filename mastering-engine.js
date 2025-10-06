const express = require('express');
const { spawn } = require('child_process');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Asegurarse de que la carpeta de subidas exista
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de Multer para guardar archivos subidos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Nombre de archivo único para evitar colisiones
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Ruta para analizar el audio
router.post('/analyze', upload.single('audioFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha subido ningún archivo de audio.' });
  }

  const audioPath = req.file.path;
  const pythonScriptPath = path.join(__dirname, '..', 'ai', 'processing_suggester.py');

  // Ejecutar el script de Python como un proceso hijo
  const pythonProcess = spawn('python', [pythonScriptPath, audioPath]);

  let dataToSend = '';
  pythonProcess.stdout.on('data', (data) => {
    dataToSend += data.toString();
  });

  let errorToSend = '';
  pythonProcess.stderr.on('data', (data) => {
    errorToSend += data.toString();
  });

  pythonProcess.on('close', (code) => {
    // Eliminar el archivo temporal después del análisis
    fs.unlink(audioPath, (err) => {
      if (err) console.error("Error al eliminar el archivo temporal:", err);
    });

    if (code !== 0 || errorToSend) {
      return res.status(500).json({ error: 'Error al analizar el audio.', details: errorToSend });
    }
    res.json(JSON.parse(dataToSend));
  });
});

module.exports = router;