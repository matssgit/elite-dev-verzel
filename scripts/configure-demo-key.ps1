# HUMAN NATIVE CONSOLE ONLY. No clipboard, private argv or plaintext key file.
param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedFingerprint)
$ErrorActionPreference='Stop'
if([Console]::IsInputRedirected -or $Host.Name -ne 'ConsoleHost'){throw 'Use PowerShell NATIVO interativo, sem transcricao.'}
$workspace=Split-Path -Parent $PSScriptRoot
if((Resolve-Path -LiteralPath (Get-Location).Path).Path -ne (Resolve-Path -LiteralPath $workspace).Path){throw 'Execute na raiz F:\teste-verzel.'}
. (Join-Path $PSScriptRoot 'demo-private-upload.ps1')
$public=Get-Content -LiteralPath (Join-Path $workspace 'var/demo-identity/public.json') -Raw | ConvertFrom-Json
if($public.scope -cne 'elite-verzel-demo' -or $public.namespace -cne 'elite-verzel-demo-v1/' -or $public.fingerprint -cne $ExpectedFingerprint){throw 'Pin/escopo publico divergente.'}
$prior=[Environment]::GetEnvironmentVariable('DEMO_NATIVE_KEY','Process')
$keyPointer=[IntPtr]::Zero;$tokenPointer=[IntPtr]::Zero;$protected=$null;$tokenProtected=$null;$variables=$null;$apiToken=$null
try {
    $protected=Get-Content -LiteralPath (Join-Path $workspace 'var/demo-identity/private-key.dpapi') -Raw | ConvertTo-SecureString
    $keyPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($protected)
    $env:DEMO_NATIVE_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    # Only a PUBLIC fingerprint leaves the subprocess; stderr is suppressed.
    $fingerprint=& node (Join-Path $PSScriptRoot 'demo-key-fingerprint.mjs') 2>$null
    if($LASTEXITCODE -ne 0 -or $fingerprint -cne $ExpectedFingerprint){throw 'Chave DPAPI nao corresponde ao pin publico. Nenhum upload.'}
    $tokenProtected=Read-Host 'API Key TEMPORARIA Render (entrada protegida; nao envie na conversa)' -AsSecureString
    $tokenPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenProtected)
    $apiToken=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer).Trim()
    if($apiToken.Length -lt 20){throw 'Token inesperado. Nenhum upload.'}
    $variables=@{AUDIT_PRIVATE_KEY=$env:DEMO_NATIVE_KEY;AUDIT_PUBLIC_KEY_FINGERPRINT=$ExpectedFingerprint;WEB_ORIGIN='https://elite-verzel-demo.vercel.app';FINANCIAL_MAINTENANCE='true';RUN_SETTLEMENT_JOBS='false';ALLOW_DEMO_SEED='false'}
    $deployId=Send-DemoAuditConfiguration -ApiToken $apiToken -Variables $variables
    Write-Host "Demo configurada por HTTPS. Deploy publico: $deployId. Financas/worker/seed continuam bloqueados."
    Write-Host 'Revogue a API Key temporaria no Render. Informe somente fingerprint, deployId e resultado; nunca a chave/token.'
}finally {
    if($variables){$variables.Clear()};$apiToken=$null
    if($keyPointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)}
    if($tokenPointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)}
    if($protected){$protected.Dispose()};if($tokenProtected){$tokenProtected.Dispose()}
    [Environment]::SetEnvironmentVariable('DEMO_NATIVE_KEY',$prior,'Process')
}
