// NOTE: We import the module under test after setting up all jest.mock() calls
// so that its internal requires are intercepted by the mocks.

// --- Mocks de Módulos Externos ---

// Mock de node-fetch para simular respuestas de red
const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);

// Mock de @google/generative-ai
const mockGeminiText = jest.fn();
const mockGenerateContent = jest.fn(() => ({
  response: {
    text: mockGeminiText,
  },
}));
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));
const mockGoogleGenerativeAI = jest.fn(() => ({
  getGenerativeModel: mockGetGenerativeModel,
}));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: mockGoogleGenerativeAI,
}));

// Mock de node:crypto para la firma de ACRCloud
const mockCryptoDigest = jest.fn(() => 'mocked_signature');
const mockCryptoUpdate = jest.fn().mockReturnThis();
const mockCryptoCreateHmac = jest.fn(() => ({
  update: mockCryptoUpdate,
  digest: mockCryptoDigest,
}));
jest.mock('node:crypto', () => ({
  createHmac: mockCryptoCreateHmac,
}));

// Mock de form-data
const mockFormDataAppend = jest.fn();
const mockFormDataGetHeaders = jest.fn(() => ({ 'Content-Type': 'multipart/form-data; boundary=mock-boundary' }));
jest.mock('form-data', () => {
  // Provide a real constructor function so `instanceof` checks pass
  function MockFormData() {
    this.append = mockFormDataAppend;
    this.getHeaders = mockFormDataGetHeaders;
  }
  return MockFormData;
});
const FormData = require('form-data'); // Importar el mock para poder instanciarlo

// Mock de ./src/config para controlar las credenciales
const mockConfig = {
  apiKeys: {
    chatbot: 'TEST_GEMINI_API_KEY',
  },
  acrCloud: {
    host: 'test.acrcloud.com',
    accessKey: 'TEST_ACR_ACCESS_KEY',
    accessSecret: 'TEST_ACR_ACCESS_SECRET',
  },
};
jest.mock('./src/config', () => mockConfig);

// Mock de ./src/utils/logger para suprimir la salida de la consola durante las pruebas
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock('./src/utils/logger', () => mockLogger);

// Import the module under test after mocks
const {
  callGeminiAPI,
  identifySongWithACRCloud,
  transcribeAudioWithGemini,
} = require('./api-calls');

describe('src/core/api-calls.js', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Limpiar todos los mocks antes de cada prueba
  });

  describe('callGeminiAPI', () => {
    it('debería llamar a la API de Gemini con la clave y el prompt correctos', async () => {
      const apiKey = 'MY_API_KEY';
      const prompt = 'Hello, AI!';
      const expectedResponse = 'AI says: Hello!';

      mockGeminiText.mockResolvedValueOnce(expectedResponse);

      const result = await callGeminiAPI(apiKey, prompt);

      expect(mockGoogleGenerativeAI).toHaveBeenCalledWith(apiKey);
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-pro' });
      expect(mockGenerateContent).toHaveBeenCalledWith(prompt);
      expect(mockGeminiText).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResponse);
    });

    it('debería manejar errores de la API de Gemini', async () => {
      const apiKey = 'INVALID_KEY';
      const prompt = 'Error test';
      const errorMessage = 'API error occurred';

      mockGeminiText.mockRejectedValueOnce(new Error(errorMessage));

      await expect(callGeminiAPI(apiKey, prompt)).rejects.toThrow(errorMessage);
    });
  });

  describe('identifySongWithACRCloud', () => {
    const audioBuffer = Buffer.from('fake_audio_data');

    it('debería lanzar un error si las credenciales de ACRCloud no están configuradas', async () => {
      // Simular credenciales faltantes
      mockConfig.acrCloud.host = '';
      mockConfig.acrCloud.accessKey = '';
      mockConfig.acrCloud.accessSecret = '';

      await expect(identifySongWithACRCloud(audioBuffer)).rejects.toThrow(
        'Las credenciales de ACRCloud no están configuradas en el archivo .env'
      );

      // Restaurar credenciales para otras pruebas
      mockConfig.acrCloud.host = 'test.acrcloud.com';
      mockConfig.acrCloud.accessKey = 'TEST_ACR_ACCESS_KEY';
      mockConfig.acrCloud.accessSecret = 'TEST_ACR_ACCESS_SECRET';
    });

    it('debería hacer una llamada POST correcta a ACRCloud y devolver el resultado', async () => {
      const mockAcrResponse = {
        status: { code: 0, msg: 'Success' },
        metadata: { music: [{ title: 'Test Song', artist: 'Test Artist' }] },
      };
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockAcrResponse),
      });

      const result = await identifySongWithACRCloud(audioBuffer);

      expect(mockCryptoCreateHmac).toHaveBeenCalledWith('sha1', 'TEST_ACR_ACCESS_SECRET');
      expect(mockCryptoUpdate).toHaveBeenCalledTimes(1); // Check that update was called
      expect(mockCryptoDigest).toHaveBeenCalledWith('base64');

      expect(mockFormDataAppend).toHaveBeenCalledWith('sample', audioBuffer, { filename: 'sample.wav' });
      expect(mockFormDataAppend).toHaveBeenCalledWith('access_key', 'TEST_ACR_ACCESS_KEY');
      expect(mockFormDataAppend).toHaveBeenCalledWith('data_type', 'audio');
      expect(mockFormDataAppend).toHaveBeenCalledWith('signature_version', '1');
      expect(mockFormDataAppend).toHaveBeenCalledWith('signature', 'mocked_signature');
      expect(mockFormDataAppend).toHaveBeenCalledWith('sample_bytes', audioBuffer.length);
      expect(mockFormDataAppend).toHaveBeenCalledWith('timestamp', expect.any(Number));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.acrcloud.com/v1/identify',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData), // Asegurarse de que se pasa una instancia de FormData
          headers: { 'Content-Type': 'multipart/form-data; boundary=mock-boundary' },
        })
      );
      expect(result).toEqual({ success: true, data: mockAcrResponse.metadata.music[0] });
    });

    it('debería devolver success: false si no se encuentra ninguna coincidencia (código 1001)', async () => {
      const mockAcrResponse = {
        status: { code: 1001, msg: 'No result' },
      };
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockAcrResponse),
      });

      const result = await identifySongWithACRCloud(audioBuffer);
      expect(result).toEqual({ success: false, message: 'No se encontró ninguna coincidencia.' });
    });

    it('debería lanzar un error para otros códigos de estado de ACRCloud', async () => {
      const mockAcrResponse = {
        status: { code: 2000, msg: 'Unknown error' },
      };
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockAcrResponse),
      });

      await expect(identifySongWithACRCloud(audioBuffer)).rejects.toThrow(
        'Error de ACRCloud: Unknown error (código: 2000)'
      );
    });

    it('debería manejar errores de red durante la llamada a ACRCloud', async () => {
      const errorMessage = 'Network error';
      mockFetch.mockRejectedValueOnce(new Error(errorMessage));

      await expect(identifySongWithACRCloud(audioBuffer)).rejects.toThrow(errorMessage);
    });
  });

  describe('transcribeAudioWithGemini', () => {
    it('debería registrar una advertencia y devolver un resultado placeholder', async () => {
      const filePath = '/path/to/audio.wav';
      const mimeType = 'audio/wav';

      const result = await transcribeAudioWithGemini(filePath, mimeType);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'La función transcribeAudioWithGemini aún no está implementada.'
      );
      expect(result).toEqual({ notes: [] });
    });
  });
});