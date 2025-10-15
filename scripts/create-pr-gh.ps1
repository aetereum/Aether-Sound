# PR creator using GitHub CLI (gh). Usage: run if gh is installed and authenticated
# Usage: .\scripts\create-pr-gh.ps1

git push origin fix/cleanup-audit-lint

$prBody = @'
Objetivo: Limpiar warnings de ESLint, añadir helper para ejecutar ESLint localmente y añadir comprobación de salud.

Cambios principales:
- tools/run-eslint.js — helper para ejecutar ESLint programáticamente y facilitar contribuciones.
- Ajustes menores de configuración relacionados con health-check/eslint.

Verificaciones realizadas:
- Ejecución local de ESLint (sin warnings).
- Ejecución local de Jest (21 tests pass).
- Smoke server check OK (GET /test devolvió respuesta esperada).

Notas para reviewers:
- Cambios intencionalmente conservadores; se renombraron variables no usadas y se ajustaron mocks para mantener el comportamiento.
'@

gh pr create --base main --head fix/cleanup-audit-lint --title "chore: health-check and eslint config" --body $prBody

Write-Host "Si gh está autenticado, el PR se debería haber creado. Pega la URL aquí para que la monitorice."