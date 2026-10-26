# Operator-run handoff. Never run this through an agent's terminal session or
# provide its input via chat, tool stdin, argv or a plaintext credential file.
$ErrorActionPreference = 'Stop'
if ([Console]::IsInputRedirected) { throw 'Abra um PowerShell local interativo; entrada redirecionada nao e permitida.' }
if ($Host.Name -ne 'ConsoleHost') { throw 'Execute em um PowerShell local interativo.' }
$workspace = Split-Path -Parent $PSScriptRoot
if ((Resolve-Path -LiteralPath (Get-Location).Path).Path -ne (Resolve-Path -LiteralPath $workspace).Path) {
    throw 'Execute o script a partir da raiz do repositorio.'
}
function Read-ProtectedValue([string]$Prompt) {
    $protected = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($protected)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $protected.Dispose()
    }
}
$previousDb = $env:DATABASE_URL
$previousBlob = $env:BLOB_READ_WRITE_TOKEN
$previousDebug = $env:DEBUG
$previousNodeDebug = $env:NODE_DEBUG
$newDb = $null
$newBlob = $null
try {
    Write-Host 'Use apenas depois de o agente confirmar a manutencao. Nao cole valores na conversa.'
    $newDb = (Read-ProtectedValue 'Cole a NOVA URL direta do PostgreSQL (entrada oculta)').Trim()
    $newBlob = (Read-ProtectedValue 'Cole o NOVO token Blob (entrada oculta)').Trim()
    [Uri]$uri = $null
    if (-not [Uri]::TryCreate($newDb, [UriKind]::Absolute, [ref]$uri)) {
        throw 'URL invalida. Copie novamente a conexao direta no painel Neon.'
    }
    if ($uri.Scheme -notin @('postgres', 'postgresql') -or -not $uri.Host.EndsWith('.neon.tech') -or $uri.Host.Contains('-pooler.')) {
        throw 'Use a conexao DIRETA do Neon; desative Connection pooling no painel Connect.'
    }
    if ([Uri]::UnescapeDataString(($uri.UserInfo -split ':', 2)[0]) -ne 'elite_verzel_owner' -or $uri.AbsolutePath -ne '/elite_verzel') {
        throw 'A conexao precisa usar o papel elite_verzel_owner e o banco elite_verzel.'
    }
    if ($newBlob -notmatch '^vercel_blob_rw_[A-Za-z0-9_-]+$') { throw 'Token Blob em formato inesperado; confira o campo protegido do provedor.' }
    $env:DATABASE_URL = $newDb
    $env:BLOB_READ_WRITE_TOKEN = $newBlob
    $env:DEBUG = $null
    $env:NODE_DEBUG = $null
    # Credentials are inherited as process environment, never command arguments.
    # Omitted signing variables preserve their values in the existing function.
    & npx --yes neon@latest deploy --config deploy/neon-credentials.ts --project-id cold-haze-51518470 --branch production --profile elite-verzel --no-env-pull
    if ($LASTEXITCODE -ne 0) { throw 'Deployment nao concluido. Mantenha a manutencao e informe apenas a mensagem sem segredos.' }
    Write-Host 'Configuracao enviada. Informe ao agente apenas: configuracao Neon concluida. A manutencao continua ativa.'
} finally {
    $env:DATABASE_URL = $previousDb
    $env:BLOB_READ_WRITE_TOKEN = $previousBlob
    $env:DEBUG = $previousDebug
    $env:NODE_DEBUG = $previousNodeDebug
    $newDb = $null
    $newBlob = $null
    $uri = $null
}
