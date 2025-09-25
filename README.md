# Aether-Sound

En este repositorio encontrarás generadores musicales algorítmicos y asistidos por IA. 🔊 Más que música, creamos vibraciones que trascienden.

---

## 🚀 Uso Principal (Aplicación Web)

El proyecto ahora funciona como una aplicación web. Para iniciarla:

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/aetereum/Aether-Sound.git
    ```
2.  **Navega a la carpeta del proyecto:**
    ```bash
    cd Aether-Sound
    ```
3.  **Instala las dependencias de Node.js:**
    ```bash
    npm install
    ```
4.  **Configura el entorno de Python para la IA:**
    *   Asegúrate de tener Python 3.8+ instalado.
    *   Instala las dependencias de Python:
    ```bash
    pip install -r requirements.txt
    ```
5.  **Inicia el servidor:**
    ```bash
    npm start
    ```
6.  Abre tu navegador y ve a `http://localhost:3000`. ¡Ya puedes generar música desde la web!

## 🛠️ Uso como Herramienta de Consola

Si prefieres usar los generadores directamente desde la terminal (como antes), también puedes hacerlo.

### 1. Generador de Composiciones (Melodía + Bajo)

Este generador crea una pieza musical corta con una melodía principal y una línea de bajo que la acompaña. Utiliza una escala predefinida (Do Mayor) y ritmos variados. La melodía usa un `FMSynth` y el bajo un `MonoSynth`, ambos procesados con efectos de Delay y Reverb para un sonido más atmosférico.

*   **Para ejecutarlo desde la consola:**
    ```bash
    npm run generate:composition
    ```
*   **Resultado:** Se creará un archivo `melody-with-bass.wav` en la carpeta `output/`.

### 2. Generador de Ritmos de Batería

Crea un patrón de batería de 2 compases utilizando sintetizadores para el bombo, la caja y el hi-hat.

*   **Para ejecutarlo desde la consola:**
    ```bash
    npm run generate:drums
    ```
*   **Resultado:** Se creará un archivo `drum-beat.wav` en la carpeta `output/`.

### 3. Experimento de Sintetizador Simple

*   **Para ejecutarlo desde la consola:**
    ```bash
    npm run experiment:render-synth
    ```
*   **Resultado:** Se creará un archivo `simple-synth.wav` en la carpeta `output/`.

## 📂 Estructura del Proyecto

El repositorio está organizado de la siguiente manera:

```
├── public/             # Archivos del frontend (HTML, CSS, JS del cliente).
├── docs/               # Documentación detallada del proyecto.
├── output/             # Archivos de audio generados (ignorados por Git).
├── src/                # Código fuente principal (backend).
│   ├── ai/             # Scripts de Inteligencia Artificial (Python).
│   ├── core/           # Lógica y utilidades compartidas (ej. audio-renderer.js).
│   ├── experiments/    # Experimentos de sonido y prototipos.
│   ├── generators/     # Generadores musicales (ej. random-melody-generator.js).
│   ├── plugins/        # Plugins (ej. VST).
│   └── tools/          # Herramientas de producción (ej. asistidas por IA).
├── scripts/            # Scripts para automatización de tareas.
└── ...                 # Archivos de configuración (package.json, etc.).
```
## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Si tienes una idea para un nuevo experimento, una herramienta o una mejora, por favor abre un "Issue" para discutirlo o envía un "Pull Request".
