const express = require('express');
const path = require('path');
const router = express.Router();

module.exports = (OUTPUT_DIR) => {
  // API: generate composition
  router.post('/composition', async (req, res) => {
    try {
      const gen = require('../composition-generator');
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
  router.post('/synth', async (req, res) => {
    try {
      const gen = require('../render-simple-synth');
      const filePath = await gen.generateSynth({ outputDir: OUTPUT_DIR });
      res.json({ ok: true, file: path.basename(filePath) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // API: generate drums
  router.post('/drums', async (req, res) => {
    try {
      const gen = require('../drum-generator');
      const filePath = await gen.generateDrums({ outputDir: OUTPUT_DIR });
      res.json({ ok: true, file: path.basename(filePath) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
};