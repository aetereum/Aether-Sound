const { Scale, Note, Chord, Progression } = require('tonal');

/**
 * Genera un motivo rítmico simple.
 * @returns {number[]} Un array de duraciones en dieciseisavos de nota.
 */
function createRhythmicMotif() {
  const motifs = [
    [1, 1, 2], // Dos dieciseisavos, una corchea
    [2, 1, 1], // Una corchea, dos dieciseisavos
    [1, 0.5, 0.5, 2], // Un dieciseisavo, dos treintaidosavos, una corchea
    [4] // Una negra
  ];
  return motifs[Math.floor(Math.random() * motifs.length)];
}

/**
 * Genera una composición musical más estructurada (melodía, acordes y bajo).
 * @param {Object} params - Parámetros de generación.
 * @param {String} params.key - La tónica (ej. "C", "G#").
 * @param {String} params.scale - El tipo de escala (ej. "major", "minor").
 * @param {Number} params.tempo - El tempo en BPM.
 * @returns {{notes: {melody: object[], chords: object[], bass: object[]}, duration: number}}
 */
function generateCreativeMusic({ key, scale, tempo }) {
  const measures = 8; // Duración total en compases
  const beatsPerBar = 4;
  const totalBeats = measures * beatsPerBar;
  const beatDuration = 60 / tempo; // Duración de una negra en segundos

  // 1. Generar una progresión de acordes
  const chordProgression = scale === 'major'
    ? Progression.fromRomanNumerals(`${key}3`, ['I', 'V', 'vi', 'IV'])
    : Progression.fromRomanNumerals(`${key}3`, ['i', 'VI', 'III', 'VII']);

  // 2. Obtener las notas de la escala en un rango más amplio
  const scaleNotes = Scale.rangeOf(`${key} ${scale}`)('C4', 'C6');

  const melody = [];
  const chords = [];
  const bass = [];

  const currentTime = 0;

  // 3. Generar las partes musicales compás por compás
  for (let i = 0; i < measures; i++) {
    const currentChordName = chordProgression[i % chordProgression.length];
    const currentChordNotes = Chord.get(currentChordName).notes;
    const measureStartTime = i * beatsPerBar * beatDuration;

    // Añadir el acorde
    chords.push({
      time: measureStartTime,
      pitch: Chord.get(currentChordName).notes.map(n => Note.midi(n)), // Puede ser un array de MIDI
      duration: beatDuration * beatsPerBar * 0.9,
      velocity: 0.5
    });

    // Añadir la línea de bajo (la fundamental del acorde)
    bass.push({
      time: measureStartTime,
      pitch: Note.midi(currentChordNotes[0].replace('3', '2')), // Bajar una octava
      duration: beatDuration * 2,
      velocity: 0.7
    });

    // Generar melodía para este compás usando un motivo rítmico
    const motif = createRhythmicMotif();
    let measureCurrentTime = measureStartTime;
    for (const noteDuration of motif) {
      if (Math.random() > 0.25) { // 75% de probabilidad de nota
        // Elegir una nota del acorde actual o de la escala
        const noteSource = Math.random() > 0.5 ? currentChordNotes : scaleNotes;
        const randomNote = noteSource[Math.floor(Math.random() * noteSource.length)];

        melody.push({
          time: measureCurrentTime,
          pitch: Note.midi(randomNote.replace('3', '5')), // Subir octava
          duration: (beatDuration / 4) * noteDuration * 0.9, // Staccato
          velocity: 0.8 + Math.random() * 0.2
        });
      }
      measureCurrentTime += (beatDuration / 4) * noteDuration;
    }
  }

  // Tu `renderAudio` necesitará manejar un array de pitches para los acordes.
  // Si no lo hace, puedes "arpegiar" el acorde o solo renderizar la tónica.
  // Por simplicidad, aquí asumimos que puede manejarlo o que lo adaptarás.

  return {
    notes: { melody, chords, bass },
    duration: (totalBeats * 60) / tempo,
  };
}

module.exports = generateCreativeMusic;
