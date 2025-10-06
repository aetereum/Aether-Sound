const { Scale, Note } = require('tonal');

/**
 * Genera una composición musical simple (melodía y bajo) basada en parámetros.
 * @param {object} params - Parámetros de generación.
 * @param {string} params.key - La tónica (ej. "C", "G#").
 * @param {string} params.scale - El tipo de escala (ej. "major", "minor").
 * @param {number} params.tempo - El tempo en BPM.
 * @returns {{notes: {melody: object[], bass: object[]}, duration: number}}
 */
function generateCreativeMusic({ key, scale, tempo }) {
  const duration = 8; // Duración total en compases
  const beatsPerBar = 4;
  const totalBeats = duration * beatsPerBar;

  // Obtener las notas de la escala en 3 octavas
  const scaleNotes = [
    ...Scale.get(`${key}3 ${scale}`).notes,
    ...Scale.get(`${key}4 ${scale}`).notes,
    ...Scale.get(`${key}5 ${scale}`).notes,
  ];

  const melody = [];
  const bass = [];

  let currentTime = 0;
  const sixteenthNoteDuration = 60 / tempo / 4;

  // Generar melodía
  for (let i = 0; i < totalBeats * 2; i++) { // Generamos 2 notas por beat (corcheas)
    if (Math.random() > 0.3) { // 70% de probabilidad de que suene una nota
      const randomNoteIndex = Math.floor(Math.random() * scaleNotes.length);
      const noteName = scaleNotes[randomNoteIndex];
      melody.push({
        time: currentTime,
        pitch: Note.midi(noteName),
        duration: sixteenthNoteDuration * 1.8, // Ligeramente staccato
        velocity: 0.8 + Math.random() * 0.2,
      });
    }
    currentTime += sixteenthNoteDuration * 2;
  }

  // Generar línea de bajo (una nota por beat)
  currentTime = 0;
  for (let i = 0; i < totalBeats; i++) {
    const rootNote = Scale.get(`${key}2 ${scale}`).notes[0];
    bass.push({
      time: currentTime,
      pitch: Note.midi(rootNote),
      duration: sixteenthNoteDuration * 3.5,
      velocity: 0.7,
    });
    currentTime += sixteenthNoteDuration * 4;
  }

  return {
    notes: { melody, bass },
    duration: (totalBeats * 60) / tempo,
  };
}

module.exports = generateCreativeMusic;