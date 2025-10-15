const path = require("node:path");
const { writeWav } = require("../utils/audio-renderer");

// Generador creativo simple que crea una melodía aleatoria basada en una escala
function randInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildScale(key = "C", scale = "major") {
	const KEY_TO_SEMITONE = {
		C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
	};
	const SCALE_INTERVALS = { major: [0,2,4,5,7,9,11], minor: [0,2,3,5,7,8,10] };
	const root = KEY_TO_SEMITONE[key] ?? 0;
	return SCALE_INTERVALS[scale].map(i => 60 + root + i);
}

async function generateCreativeMusic({ outputDir, key = 'C', scale = 'major', _tempo = 100, lengthSec = 8 }) {
	const sr = 44100;
	const total = Math.floor(lengthSec * sr);
	const samples = new Array(total).fill(0);

	const scaleNotes = buildScale(key, scale);
	for (let i = 0; i < Math.floor(lengthSec); i++) {
		const note = scaleNotes[randInt(0, scaleNotes.length - 1)];
		const freq = 440 * Math.pow(2, (note - 69) / 12);
		const noteDur = 0.5 + Math.random() * 0.5;
		const start = Math.floor(i * sr);
		for (let n = 0; n < Math.floor(noteDur * sr); n++) {
			const t = n / sr;
			const idx = start + n;
			if (idx >= total) break;
			const s = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 2);
			samples[idx] += 0.4 * s;
		}
	}

	const filePath = path.join(outputDir, `creative_${Date.now()}.wav`);
	writeWav({ samples, sampleRate: sr, channels: 1, filePath });
	const notes = []; // placeholder: could return actual note events
	return { filePath, notes, duration: lengthSec };
}

module.exports = generateCreativeMusic;
