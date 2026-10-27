# HUMAN NATIVE TERMINAL ONLY. No clipboard, no secret argv, no plaintext key
# file, no agent-tool execution. Uses fresh replacement DPAPI, never old file.
param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedTransitionHash)
$ErrorActionPreference='Stop'
if([Console]::IsInputRedirected -or $Host.Name -ne 'ConsoleHost'){throw 'Use um PowerShell NATIVO interativo, sem transcricao.'}
$workspace=Split-Path -Parent $PSScriptRoot
if((Resolve-Path -LiteralPath (Get-Location).Path).Path -ne (Resolve-Path -LiteralPath $workspace).Path){throw 'Execute na raiz do projeto.'}
. (Join-Path $PSScriptRoot 'render-private-upload.ps1')
. (Join-Path $PSScriptRoot 'audit-recovery-preflight.ps1')
$manifestPath=Join-Path $workspace 'docs/AUDIT_SIGNING_REPLACEMENT.json'
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$incident=Get-Content -LiteralPath (Join-Path $workspace 'docs/AUDIT_KEY_INCIDENT.json') -Raw | ConvertFrom-Json
if($manifest.activeFingerprint -in $incident.compromisedFingerprints){throw 'Identidade comprometida proibida. Nenhuma chave foi aberta.'}
$compact=& node -e "process.stdout.write(JSON.stringify(JSON.parse(require('node:fs').readFileSync(process.argv[1],'utf8'))))" $manifestPath
if($LASTEXITCODE -ne 0){throw 'Manifesto publico invalido.'}
& node scripts/verify-audit-transition.mjs $manifestPath $ExpectedTransitionHash --public-only
if($LASTEXITCODE -ne 0){throw 'Manifesto/pin publico divergente. Nenhuma chave foi aberta.'}
# Check the reviewed state before opening the new private key.
foreach($base in @('https://elite-dev-verzel-api.onrender.com','https://br-muddy-mud-b80fr83g-settlement.compute.c-14.us-east-1.aws.neon.tech')){
    Get-ValidatedAuditRecoveryDiagnostic -BaseUri $base | Out-Null
}
$prior=@{};foreach($name in @('AUDIT_PRIVATE_KEY','AUDIT_PUBLIC_KEY_FINGERPRINT','AUDIT_TRANSITION_JSON','AUDIT_TRANSITION_SHA256','DEBUG','NODE_DEBUG')){$prior[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
$protected=$null;$tokenProtected=$null;$pointer=[IntPtr]::Zero;$tokenPointer=[IntPtr]::Zero;$variables=$null;$apiToken=$null
try{
    $protected=ConvertTo-SecureString (Get-Content -LiteralPath (Join-Path $workspace 'var/audit-key-replacement/private-key.dpapi') -Raw)
    $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($protected)
    $env:AUDIT_PRIVATE_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Replace("`r`n","`n").Replace("`n",'\n')
    if([string]::IsNullOrWhiteSpace($env:AUDIT_PRIVATE_KEY)){throw 'Chave DPAPI vazia. Nenhum upload iniciado.'}
    $env:AUDIT_PUBLIC_KEY_FINGERPRINT=$manifest.activeFingerprint;$env:AUDIT_TRANSITION_JSON=$compact;$env:AUDIT_TRANSITION_SHA256=$ExpectedTransitionHash;$env:DEBUG=$null;$env:NODE_DEBUG=$null
    & node scripts/verify-audit-transition.mjs $manifestPath $ExpectedTransitionHash
    if($LASTEXITCODE -ne 0){throw 'Manifesto/pin/chave divergentes. Nenhum upload iniciado.'}
    Write-Host 'Nao cole a chave de assinatura em paineis, mensagens ou terminal. Ela sera enviada diretamente por HTTPS ao Render.'
    $tokenProtected=Read-Host 'Token TEMPORARIO da API Render (entrada oculta; nunca na conversa)' -AsSecureString
    $tokenPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenProtected);$apiToken=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer).Trim()
    if($apiToken.Length -lt 20){throw 'Token inesperado. Nenhum upload iniciado.'}
    $variables=@{FINANCIAL_MAINTENANCE='true';AUDIT_RECOVERY_MODE='true';RUN_SETTLEMENT_JOBS='false';AUDIT_PRIVATE_KEY=$env:AUDIT_PRIVATE_KEY;AUDIT_PUBLIC_KEY_FINGERPRINT=$env:AUDIT_PUBLIC_KEY_FINGERPRINT;AUDIT_TRANSITION_JSON=$env:AUDIT_TRANSITION_JSON;AUDIT_TRANSITION_SHA256=$env:AUDIT_TRANSITION_SHA256}
    $deployId=Send-RenderAuditConfiguration -ApiToken $apiToken -Variables $variables
    Write-Host "Render recebeu a configuracao. Deploy publico: $deployId. Aguarde Live no painel, sem retirar recuperacao/manutencao."
    if((Read-Host 'Quando estiver Live, digite APLICAR para atualizar Neon com a MESMA chave') -cne 'APLICAR'){throw 'Neon nao atualizado. Informe o estado ao agente sem segredos.'}
    & npx --yes neon@latest deploy --config deploy/neon-audit-key.ts --project-id cold-haze-51518470 --branch production --profile elite-verzel --no-env-pull
    if($LASTEXITCODE -ne 0){throw 'Neon nao concluido. Mantenha recuperacao e informe somente erro sem segredos.'}
    Write-Host 'Configuracao enviada, ainda sem ativar assinatura/financas. Revogue o token temporario da API Render e avise o agente para verificar.'
}finally{
    if($variables){$variables.Clear()};$apiToken=$null
    if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
    if($tokenPointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)}
    if($protected){$protected.Dispose()};if($tokenProtected){$tokenProtected.Dispose()}
    foreach($name in $prior.Keys){[Environment]::SetEnvironmentVariable($name,$prior[$name],'Process')}
    $compact=$null;$manifest=$null
}
