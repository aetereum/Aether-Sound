[CmdletBinding()]
param(
  [string]$BaseUrl = 'http://localhost:3001'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Normaliza BaseUrl (quita espacios, comillas de envoltura y barra final)
$BaseUrl = $BaseUrl.Trim().Trim("'").Trim('"').TrimEnd('/')

function Write-Step($msg) { Write-Host ("[E2E] " + $msg) }
function PostJson([string]$path, $bodyObj) {
  $json = $bodyObj | ConvertTo-Json -Depth 10
  # Asegura que el path empieza por '/'
  if (-not $path.StartsWith('/')) { $path = '/' + $path }
  $uri = "{0}{1}" -f $BaseUrl, $path
  Write-Host ("[E2E] POST URI: " + $uri)
  return Invoke-RestMethod -Method Post -Uri $uri -ContentType 'application/json' -Body $json
}

try {
  if (-not (Test-Path -LiteralPath 'tmp')) { New-Item -ItemType Directory -Path 'tmp' | Out-Null }

  Write-Step ("BaseUrl: {0}" -f $BaseUrl)

  # 1) Crear cuenta de prueba
  Write-Step 'Creando cuenta de prueba (5 hbar iniciales)...'
  $accResp = PostJson '/api/hedera/account/create' @{ initialHbar = 5 }
  if (-not $accResp.ok) { throw ("account/create fallo: {0}" -f ($accResp | ConvertTo-Json -Depth 6)) }
  $accountId = $accResp.accountId
  $accountPriv = $accResp.privateKey
  if (-not $accountId -or -not $accountPriv) { throw 'account/create no devolvió accountId/privateKey' }
  Write-Step ("Cuenta creada: {0}" -f $accountId)

  # 2) Crear colección Split NFT (100% para la cuenta creada)
  Write-Step 'Creando colección Split NFT (100% al accountId creado)...'
  $createBody = @{ name = 'E2E Split Coll'; symbol = 'E2E'; splits = @(@{ accountId = $accountId; bps = 10000 }) }
  $createResp = PostJson '/api/hedera/split-nft/create' $createBody
  if (-not $createResp.ok) { throw ("split-nft/create fallo: {0}" -f ($createResp | ConvertTo-Json -Depth 6)) }
  $tokenId = $createResp.tokenId
  if (-not $tokenId) { throw 'split-nft/create no devolvió tokenId' }
  Write-Step ("Token creado: {0}" -f $tokenId)

  # 3) Mintear 1 NFT
  Write-Step 'Minteando 1 NFT...'
  $mintBody = @{ tokenId = $tokenId; metadataJson = @{ name = 'E2E NFT'; ts = (Get-Date).ToString('s') } }
  $mintResp = PostJson '/api/hedera/split-nft/mint' $mintBody
  if (-not $mintResp.ok) { throw ("split-nft/mint fallo: {0}" -f ($mintResp | ConvertTo-Json -Depth 6)) }
  $serial = $mintResp.serials[0]
  if (-not $serial) { throw 'split-nft/mint no devolvió serials[0]' }
  Write-Step ("Serial minteado: {0}" -f $serial)

  # 4) Asociar token a la cuenta (firma con private key de la cuenta)
  Write-Step 'Asociando token a la cuenta creada...'
  $assocBody = @{ tokenId = $tokenId; accountId = $accountId; accountPrivateKey = $accountPriv }
  $assocResp = PostJson '/api/hedera/token/associate' $assocBody
  if (-not $assocResp.ok) { throw ("token/associate fallo: {0}" -f ($assocResp | ConvertTo-Json -Depth 6)) }
  Write-Step ("Asociación status: {0}" -f $assocResp.status)

  # 5) Transferir el NFT desde el operador a la cuenta creada
  Write-Step 'Transfiriendo el NFT al accountId de prueba...'
  $txBody = @{ tokenId = $tokenId; serial = [int]$serial; toAccountId = $accountId }
  $txResp = PostJson '/api/hedera/nft/transfer' $txBody
  if (-not $txResp.ok) { throw ("nft/transfer fallo: {0}" -f ($txResp | ConvertTo-Json -Depth 6)) }
  Write-Step ("Transfer status: {0}" -f $txResp.status)

  # 6) Verificar owner actual vía endpoint
  Write-Step 'Verificando owner actual del NFT...'
  $ownerUrl = ("{0}/api/hedera/nft/owner?tokenId={1}&serial={2}" -f $BaseUrl, $tokenId, [int]$serial)
  Write-Host ("[E2E] GET URI: " + $ownerUrl)
  $ownerResp = Invoke-RestMethod -Method Get -Uri $ownerUrl
  if (-not $ownerResp.ok) { throw ("nft/owner fallo: {0}" -f ($ownerResp | ConvertTo-Json -Depth 6)) }
  Write-Step ("Owner actual: {0}" -f $ownerResp.owner)
  if ($ownerResp.owner -ne $accountId) { throw ("Owner mismatch: esperado {0}, obtenido {1}" -f $accountId, $ownerResp.owner) }

  # 7) Guardar estado final
  $final = [PSCustomObject]@{
    ok = $true
    accountId = $accountId
    tokenId = $tokenId
    serial = $serial
    associate = $assocResp
    transfer = $txResp
    owner = $ownerResp
  }
  $final | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 'tmp/e2e_state.json'
  Write-Step 'Flujo E2E completado.'
  $final | ConvertTo-Json -Depth 10
}
catch {
  Write-Error ("[E2E] Error: {0}" -f $_.Exception.Message)
  throw
}