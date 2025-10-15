# Aether-Sound

Aether Sound es una suite de producción musical en la web, impulsada por algoritmos y asistida por Inteligencia Artificial. 🔊 Más que música, creamos vibraciones que trascienden.

---

## 🚀 Inicio Rápido

Para ejecutar la aplicación web en tu máquina local, sigue estos pasos:

### 1. Prerrequisitos

*   Node.js (versión 16 o superior)
*   Git

### 2. Instalación

```bash
# 1. Clona el repositorio
git clone https://github.com/aetereum/Aether-Sound.git

# 2. Navega a la carpeta del proyecto
cd Aether-Sound

# 3. Instala las dependencias
npm install
```

### 3. Configuración del Entorno

Para utilizar las funcionalidades de IA y distribución, necesitas configurar tus claves de API.

1.  Crea un archivo llamado `.env` en la raíz del proyecto.
2.  Añade las siguientes variables con tus propias claves:

    ```env
    # Clave de API para el Chatbot y la función "Evolve" (ej. de Google Gemini)
    AETHER_CHATBOT_API_KEY="TU_CLAVE_DE_GEMINI_AQUI"

    # Credenciales para la identificación de canciones (ACRCloud)
    ACR_HOST="identify-eu-west-1.acrcloud.com"
    ACR_ACCESS_KEY="TU_CLAVE_DE_ACCESO_DE_ACRCLOUD"
    ACR_ACCESS_SECRET="TU_SECRETO_DE_ACRCLOUD"

    # Credenciales para la publicación en Hedera
    HEDERA_NETWORK="testnet"
    HEDERA_ACCOUNT_ID="TU_ACCOUNT_ID_DE_HEDERA"
    HEDERA_PRIVATE_KEY="TU_CLAVE_PRIVADA_DE_HEDERA"

    # Credenciales de Google Cloud para la API de YouTube
    YOUTUBE_CLIENT_ID="TU_ID_DE_CLIENTE_DE_GOOGLE"
    YOUTUBE_CLIENT_SECRET="TU_SECRETO_DE_CLIENTE_DE_GOOGLE"
    ```

### 4. Ejecución

```bash
# Inicia el servidor de desarrollo
npm start
```

El servidor se iniciará y podrás acceder a la aplicación en `http://localhost:3000` (o en el siguiente puerto disponible si el 3000 está ocupado).

### 5. Pruebas

Para verificar que todos los componentes de la API funcionan correctamente, puedes ejecutar el conjunto de pruebas:

```bash
npm test
```

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

---

## FFmpeg (opcional pero recomendado)

Para generar MP3/MP4 de forma fiable, el proyecto puede utilizar `ffmpeg`. Si `ffmpeg` está disponible en el host, el servidor lo usará para convertir WAV -> MP3 o crear un MP4 (audio + fondo estático). Si no está disponible, el servidor intentará usar el encoder JS como fallback, pero ffmpeg es la opción recomendada.

Instalación local (ejemplos):

Windows (choco):
```powershell
choco install ffmpeg
```

Ubuntu/Debian:
```bash
sudo apt update && sudo apt install ffmpeg -y
```

Para CI (GitHub Actions) añade un paso que instale ffmpeg en runners Ubuntu; la pipeline del repositorio ya incluye un paso de ejemplo que ejecuta:

```yaml
- name: Install ffmpeg (Ubuntu)
    if: runner.os == 'Linux'
    run: sudo apt-get update && sudo apt-get install -y ffmpeg
```

Si quieres que todas las pruebas de integración utilicen MP3/MP4 en CI, puedo actualizar la suite de tests para requerir ffmpeg y validar la conversión en el runner.
