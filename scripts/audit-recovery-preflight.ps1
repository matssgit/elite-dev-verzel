# GET-only preflight before DPAPI/token access. Fixed origins, bounded retries;
# never retry configuration uploads, redirects, invalid state or auth failures.
function Assert-AuditRecoveryDiagnostic {
    param([Parameter(Mandatory=$true)]$State,[Parameter(Mandatory=$true)][string]$Runtime)
    foreach($name in @('ok','maintenance','recoveryMode','jobsDisabled','rootPinMatches','allHistoriesMatchObserved','financialSnapshotMatchesObserved')){
        if($State.$name -isnot [bool] -or $State.$name -ne $true){throw 'Diagnostico invalido ou recuperacao/integridade divergente. Nenhuma chave foi aberta.'}
    }
    if($State.rotationGuardPresent -isnot [bool] -or $State.rotationGuardPresent -ne $false){throw 'Guard presente/indeterminado. Nenhuma chave foi aberta.'}
    foreach($name in @('checkpointCount','unexpectedAuditAuctionCount')){
        if($State.$name -isnot [int] -and $State.$name -isnot [long]){throw 'Contagem ausente/invalida. Nenhuma chave foi aberta.'}
    }
    if($State.checkpointCount -ne 15 -or $State.unexpectedAuditAuctionCount -ne 0 -or $State.runtime -cne $Runtime){throw 'Estado observado divergente. Nenhuma chave foi aberta.'}
}
function Test-AuditDiagnosticTransportFailure {
    param([Exception]$Exception)
    $transient=$false;$current=$Exception
    while($null -ne $current){
        if($current -is [System.Net.WebException]){
            if([string]$current.Status -in @('TrustFailure','SecureChannelFailure')){return $false}
            if([string]$current.Status -in @('Timeout','ConnectFailure','ConnectionClosed','NameResolutionFailure','ReceiveFailure','SendFailure','KeepAliveFailure','RequestCanceled')){$transient=$true}
        }
        if($current.GetType().FullName -eq 'System.Security.Authentication.AuthenticationException'){return $false}
        if($current.GetType().FullName -in @('System.TimeoutException','System.Threading.Tasks.TaskCanceledException','System.OperationCanceledException','System.Net.Http.HttpRequestException','System.Net.Sockets.SocketException')){$transient=$true}
        $current=$current.InnerException
    }
    return $transient
}
function Get-ValidatedAuditRecoveryDiagnostic {
    param([Parameter(Mandatory=$true)][ValidateSet('https://elite-dev-verzel-api.onrender.com','https://br-muddy-mud-b80fr83g-settlement.compute.c-14.us-east-1.aws.neon.tech')][string]$BaseUri)
    $runtime=if($BaseUri -eq 'https://elite-dev-verzel-api.onrender.com'){'render'}else{'neon'}
    $delays=@(5,10,15)
    for($attempt=1;$attempt -le 4;$attempt++){
        try{
            $state=Invoke-RestMethod -Method Get -Uri "$BaseUri/audit/diagnostics" -TimeoutSec 30 -MaximumRedirection 0 -Verbose:$false -Debug:$false -ErrorAction Stop
        }catch{
            $failure=$_;$code=$null;$runtimeFailure=$false
            try{if($failure.Exception.Response){$code=[int]$failure.Exception.Response.StatusCode}}catch{}
            # A runtime's structured diagnostic failure is not a warming page.
            # Inspect only in local memory; never print error bodies/messages.
            try{
                $body=$failure.ErrorDetails.Message | ConvertFrom-Json -ErrorAction Stop
                $runtimeFailure=$null -ne $body -and (@($body.PSObject.Properties.Name) -contains 'maintenance' -or @($body.PSObject.Properties.Name) -contains 'financialWritesExecuted' -or @($body.PSObject.Properties.Name) -contains 'stage')
            }catch{}finally{$body=$null}
            if($runtimeFailure){throw 'Diagnostico do runtime reportou falha. Nao sera repetido; nenhuma chave foi aberta.'}
            $retryable=if($null -ne $code){$code -in @(408,429,502,503,504)}else{Test-AuditDiagnosticTransportFailure -Exception $failure.Exception}
            if(-not $retryable){throw "Consulta de $runtime recusada ou falha nao transitoria. Nenhuma chave foi aberta; detalhes omitidos."}
            if($attempt -eq 4){throw "Diagnostico de $runtime indisponivel apos 4 tentativas. Nenhuma chave foi aberta; upload nao iniciado."}
            $delay=$delays[$attempt-1]
            Write-Host "Diagnostico $runtime temporariamente indisponivel (tentativa $attempt/4). Novo GET em $delay segundos; nenhum segredo foi aberto."
            Start-Sleep -Seconds $delay
            continue
        }
        # Semantic failures are intentionally outside the retry catch.
        Assert-AuditRecoveryDiagnostic -State $state -Runtime $runtime
        return $state
    }
}
