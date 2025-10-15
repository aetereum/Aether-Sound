# Safe PR creator using GitHub REST API and interactive PAT input
# Usage: Open PowerShell in repo root and run: .\scripts\create-pr.ps1

# Ensure branch is pushed
Write-Host "Pushing branch fix/cleanup-audit-lint to origin..."
git push origin fix/cleanup-audit-lint

# Prompt for PAT securely
$secureToken = Read-Host -Prompt "Introduce tu GitHub PAT (scope: repo) (no se mostrará)" -AsSecureString
$ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
$plainToken = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)

# Build PR body
$body = @{
  title = "chore: health-check and eslint config"
  head  = "fix/cleanup-audit-lint"
  base  = "main"
  body  = "Objetivo: Limpiar warnings de ESLint, añadir helper para ejecutar ESLint localmente y añadir comprobación de salud.`n`nCambios principales:`n- tools/run-eslint.js — helper para ejecutar ESLint programáticamente y facilitar contribuciones.`n- Ajustes menores de configuración relacionados con health-check/eslint.`n`nVerificaciones realizadas:`n- Ejecución local de ESLint (sin warnings).`n- Ejecución local de Jest (21 tests pass).`n- Smoke server check OK (GET /test devolvió respuesta esperada).`n`nNotas: Cambios conservadores (renombrado de variables no usadas y ajustes de mocks)."
} | ConvertTo-Json

# Create PR via REST API
try {
    $response = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/aetereum/Aether-Sound/pulls" `
      -Headers @{ Authorization = "token $plainToken"; "User-Agent" = "powershell" } `
      -Body $body -ContentType 'application/json'

    Write-Host "PR creada:" $response.html_url
} catch {
    Write-Error "Error al crear el PR: $_"
}

# Cleanup sensitive variables
$plainToken = $null
$secureToken = $null

Write-Host "Listo. Si se creó el PR, pega la URL aquí para que lo monitorice."