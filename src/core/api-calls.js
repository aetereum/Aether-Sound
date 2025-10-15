// Adapter that re-exports the implementation located at the repository root.
// Some tests and modules expect this module under src/core.
const { callGeminiAPI, identifySongWithACRCloud, transcribeAudioWithGemini } = require('../../api-calls');

module.exports = { callGeminiAPI, identifySongWithACRCloud, transcribeAudioWithGemini };
