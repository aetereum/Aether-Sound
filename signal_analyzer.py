import numpy as np
import librosa
import json
import sys
import warnings

# Ignorar advertencias de Librosa sobre audioread
warnings.filterwarnings('ignore', category=UserWarning, module='librosa')

def get_frequency_spectrum(y, sr):
    """
    Calcula el espectro de frecuencias y lo divide en bandas clave.
    """
    stft = np.abs(librosa.stft(y))
    fft_freqs = librosa.fft_frequencies(sr=sr)
    
    # Promedio de magnitud en el tiempo
    mean_stft = np.mean(stft, axis=1)
    
    # Mapear a escala logarítmica para una mejor visualización
    log_mean_stft = librosa.amplitude_to_db(mean_stft, ref=np.max)

    # Definir bandas de frecuencia
    bands = {
        "sub_bass": (20, 60),
        "bass": (60, 250),
        "low_mid": (250, 500),
        "mid": (500, 2000),
        "high_mid": (2000, 4000),
        "presence": (4000, 6000),
        "brilliance": (6000, 20000)
    }
    
    spectrum_bands = {}
    for band_name, (low_freq, high_freq) in bands.items():
        # Encontrar los índices de frecuencia que corresponden a la banda
        idx = np.where((fft_freqs >= low_freq) & (fft_freqs < high_freq))
        if len(log_mean_stft[idx]) > 0:
            spectrum_bands[band_name] = float(np.mean(log_mean_stft[idx]))
        else:
            spectrum_bands[band_name] = -100.0 # Valor por defecto si no hay frecuencias en la banda

    return spectrum_bands

def analyze_signal(audio_path):
    """
    Analiza una señal de audio para extraer picos, RMS, rango dinámico y espectro.
    """
    try:
        # Cargar el audio con una tasa de muestreo estándar para consistencia
        y, sr = librosa.load(audio_path, sr=44100, mono=True)

        # 1. Picos (Peak) en dBFS
        peak_amplitude = np.max(np.abs(y))
        peak_db = librosa.amplitude_to_db([peak_amplitude], ref=1.0)[0]

        # 2. Nivel RMS (Loudness general) en dBFS
        rms_amplitude = np.sqrt(np.mean(y**2))
        rms_db = librosa.amplitude_to_db([rms_amplitude], ref=1.0)[0]

        # 3. Rango Dinámico (Crest Factor) en dB
        crest_factor = peak_db - rms_db if rms_amplitude > 0 else 0

        # 4. Espectro de Frecuencias por bandas
        spectrum = get_frequency_spectrum(y, sr)

        analysis = {
            "peak_db": float(peak_db),
            "rms_db": float(rms_db),
            "dynamic_range_db": float(crest_factor),
            "frequency_spectrum_db": spectrum
        }
        return analysis

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        audio_file = sys.argv[1]
        result = analyze_signal(audio_file)
        print(json.dumps(result, indent=4))
    else:
        print(json.dumps({"error": "No audio file path provided"}, indent=4))