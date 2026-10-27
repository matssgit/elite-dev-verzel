# Operator-run only. Do not execute via agent tools or supply any private input
# through chat, argv, tool stdin or plaintext files.
param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedTransitionHash)
$ErrorActionPreference='Stop'
if(Test-Path -LiteralPath (Join-Path $PSScriptRoot '../docs/AUDIT_KEY_INCIDENT.json')){throw 'Procedimento de clipboard retirado apos incidente. Nao reutilize a chave exposta. Consulte AUDIT_KEY_RECOVERY.md.'}
if([Console]::IsInputRedirected -or $Host.Name -ne 'ConsoleHost'){throw 'Use um PowerShell NATIVO interativo.'}
. (Join-Path $PSScriptRoot 'protected-clipboard.ps1')
$workspace=Split-Path -Parent $PSScriptRoot
if((Resolve-Path -LiteralPath (Get-Location).Path).Path -ne (Resolve-Path -LiteralPath $workspace).Path){throw 'Execute na raiz do repositorio.'}
$manifestPath=Join-Path $workspace 'docs/AUDIT_SIGNING_TRANSITION.json'
$sealedPath=Join-Path $workspace 'var/audit-key-rotation/new-private-key.dpapi'
$manifestText=Get-Content -LiteralPath $manifestPath -Raw
$manifest=$manifestText | ConvertFrom-Json
# Preserve signed JSON string values exactly. PowerShell's JSON date parsing /
# reserialization can change createdAt; compact only with Node before decryption.
$compactManifest=& node -e "process.stdout.write(JSON.stringify(JSON.parse(require('node:fs').readFileSync(process.argv[1],'utf8'))))" $manifestPath
if($LASTEXITCODE -ne 0){throw 'Manifesto publico invalido. Nenhuma chave foi aberta.'}
$prior=@{}
foreach($name in @('AUDIT_PRIVATE_KEY','AUDIT_PUBLIC_KEY_FINGERPRINT','AUDIT_TRANSITION_JSON','AUDIT_TRANSITION_SHA256','DEBUG','NODE_DEBUG')){$prior[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
$protected=$null;$pointer=[IntPtr]::Zero
try {
    $protected=ConvertTo-SecureString (Get-Content -LiteralPath $sealedPath -Raw)
    $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($protected)
    $env:AUDIT_PRIVATE_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Replace("`r`n","`n").Replace("`n",'\n')
    $env:AUDIT_PUBLIC_KEY_FINGERPRINT=$manifest.activeFingerprint
    $env:AUDIT_TRANSITION_JSON=$compactManifest
    $env:AUDIT_TRANSITION_SHA256=$ExpectedTransitionHash
    $env:DEBUG=$null;$env:NODE_DEBUG=$null
    & node scripts/verify-audit-transition.mjs $manifestPath $ExpectedTransitionHash
    if($LASTEXITCODE -ne 0){throw 'Verificacao falhou. Nenhum deploy iniciado.'}
    Write-Host 'Render > elite-dev-verzel-api > Environment > Edit. Preserve FINANCIAL_MAINTENANCE=true e RUN_SETTLEMENT_JOBS=false.'
    foreach($name in @('AUDIT_PRIVATE_KEY','AUDIT_PUBLIC_KEY_FINGERPRINT','AUDIT_TRANSITION_JSON','AUDIT_TRANSITION_SHA256')){
        Copy-ProtectedClipboardField -Name $name -Value ([Environment]::GetEnvironmentVariable($name,'Process'))
    }
    Write-Host 'Salve e execute Save, rebuild, and deploy no Render. Nao retire manutencao.'
    $ready=Read-Host 'Quando o deploy Render terminar, digite APLICAR para atualizar a funcao Neon'
    if($ready -cne 'APLICAR'){throw 'Funcao Neon nao atualizada. Informe o estado ao agente; mantenha manutencao.'}
    & npx --yes neon@latest deploy --config deploy/neon-audit-key.ts --project-id cold-haze-51518470 --branch production --profile elite-verzel --no-env-pull
    if($LASTEXITCODE -ne 0){throw 'Deploy Neon nao concluido. Mantenha manutencao e informe somente o erro sem segredos.'}
    Write-Host 'Configuracao enviada. Avise o agente para verificar ambos os consumidores. Cron e manutencao nao foram reativados.'
}finally{
    try{Set-Clipboard -Value '' -ErrorAction Stop}catch{Write-Warning 'Limpe a area de transferencia manualmente. Os valores temporarios do processo serao descartados.'}
    if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
    if($protected){$protected.Dispose()}
    foreach($name in $prior.Keys){[Environment]::SetEnvironmentVariable($name,$prior[$name],'Process')}
    $manifest=$null;$manifestText=$null;$compactManifest=$null
}
