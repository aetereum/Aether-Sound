FFmpeg (optional but recommended)

To generate MP3/MP4 reliably the project can use `ffmpeg`. If `ffmpeg` is installed on the host, the server will use it to convert WAV -> MP3 or create a simple MP4 (audio + static background). If `ffmpeg` is not available the server falls back to a JS encoder for MP3 where possible.

Install ffmpeg locally (example):

Windows (choco):
```powershell
choco install ffmpeg
```

Ubuntu/Debian:
```bash
sudo apt update && sudo apt install ffmpeg -y
```

CI: make sure your workflow installs ffmpeg or uses an image that includes it. Example step for GitHub Actions (Ubuntu):

```yaml
- name: Install ffmpeg
  run: sudo apt-get update && sudo apt-get install -y ffmpeg
```

If you want me to insert this into the main `README.md` instead of adding a separate file, dime y lo hago (necesito la sección exacta donde insertarlo o confirmar que haga append al final).
