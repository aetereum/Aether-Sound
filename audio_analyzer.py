
import librosa
import numpy as np
import argparse
import json

def analyze_audio(file_path):
    """
    Analyzes an audio file to extract key sonic characteristics.

    Args:
        file_path (str): Path to the audio file.

    Returns:
        dict: A dictionary containing the analysis results.
              Returns None if the file cannot be loaded.
    """
    try:
        # Load audio file
        y, sr = librosa.load(file_path, sr=None)
    except Exception as e:
        print(f"Error loading audio file: {e}")
        return None

    # 1. Peak Analysis
    peak_amplitude = np.max(np.abs(y))

    # 2. RMS (Root Mean Square) Analysis
    rms_frames = librosa.feature.rms(y=y)
    average_rms = np.mean(rms_frames)
    
    # Add a small epsilon to avoid division by zero for silent audio
    epsilon = 1e-10

    # 3. Dynamic Range
    # A simple estimation: ratio of peak to average RMS in dB
    dynamic_range_db = 20 * np.log10(peak_amplitude / (average_rms + epsilon))

    # 4. Frequency Spectrum Analysis
    # Get the magnitude spectrogram
    stft_result = librosa.stft(y)
    spectrogram = np.abs(stft_result)
    
    # Spectral Centroid: Indicates the "center of mass" of the spectrum (brightness)
    spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))

    # Frequency band analysis (e.g., bass, mids, treble)
    bass_freq_range = [20, 250]
    mids_freq_range = [250, 4000]
    treble_freq_range = [4000, sr / 2] # Up to Nyquist

    freqs = librosa.fft_frequencies(sr=sr, n_fft=stft_result.shape[0])
    
    bass_magnitude = np.mean(spectrogram[(freqs > bass_freq_range[0]) & (freqs <= bass_freq_range[1])])
    mids_magnitude = np.mean(spectrogram[(freqs > mids_freq_range[0]) & (freqs <= mids_freq_range[1])])
    treble_magnitude = np.mean(spectrogram[(freqs > treble_freq_range[0]) & (freqs <= treble_freq_range[1])])

    analysis = {
        "file_path": file_path,
        "duration_seconds": librosa.get_duration(y=y, sr=sr),
        "sample_rate": sr,
        "peak_amplitude": float(peak_amplitude),
        "average_rms": float(average_rms),
        "dynamic_range_db": float(dynamic_range_db),
        "spectral_centroid_hz": float(spectral_centroid),
        "frequency_summary": {
            "bass_avg_magnitude": float(bass_magnitude),
            "mids_avg_magnitude": float(mids_magnitude),
            "treble_avg_magnitude": float(treble_magnitude)
        }
    }

    return analysis

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze audio files and extract sonic characteristics.")
    parser.add_argument("file", help="The path to the audio file to analyze.")
    
    args = parser.parse_args()

    results = analyze_audio(args.file)

    if results:
        print(json.dumps(results, indent=4))

