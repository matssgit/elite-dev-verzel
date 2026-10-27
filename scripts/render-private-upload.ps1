# Native operator transport. Never prints response bodies or values, and never
# retrieves existing environment variables. Unit tests replace HTTP in memory.
function Send-RenderAuditConfiguration {
    param([Parameter(Mandatory=$true)][string]$ApiToken,[Parameter(Mandatory=$true)][hashtable]$Variables)
    $allowed=@('FINANCIAL_MAINTENANCE','AUDIT_RECOVERY_MODE','RUN_SETTLEMENT_JOBS','AUDIT_PRIVATE_KEY','AUDIT_PUBLIC_KEY_FINGERPRINT','AUDIT_TRANSITION_JSON','AUDIT_TRANSITION_SHA256')
    if($Variables.Count -ne $allowed.Count){throw 'Conjunto de campos inesperado.'}
    foreach($key in $Variables.Keys){if($key -notin $allowed){throw 'Campo nao permitido.'}}
    if($Variables.FINANCIAL_MAINTENANCE -ne 'true' -or $Variables.AUDIT_RECOVERY_MODE -ne 'true' -or $Variables.RUN_SETTLEMENT_JOBS -ne 'false'){throw 'Flags de bloqueio obrigatorias.'}
    $headers=@{Authorization="Bearer $ApiToken"}
    try{
        foreach($key in $allowed){
            try{
                $body=@{value=[string]$Variables[$key]} | ConvertTo-Json -Compress
                [void](Invoke-RestMethod -Method Put -Uri "https://api.render.com/v1/services/srv-dbfoo38ae00c73cqb0r0/env-vars/$key" -Headers $headers -ContentType 'application/json' -Body $body -MaximumRedirection 0 -TimeoutSec 45 -Verbose:$false -Debug:$false -ErrorAction Stop)
            }catch{throw "Falha ao configurar $key. Corpo/credenciais omitidos; mantenha recuperacao ativa."}
            finally{$body=$null}
        }
        try{
            $deployment=Invoke-RestMethod -Method Post -Uri 'https://api.render.com/v1/services/srv-dbfoo38ae00c73cqb0r0/deploys' -Headers $headers -ContentType 'application/json' -Body '{"clearCache":"do_not_clear"}' -MaximumRedirection 0 -TimeoutSec 45 -Verbose:$false -Debug:$false -ErrorAction Stop
            if($deployment.id -notmatch '^dep-[a-z0-9]+$'){throw 'invalid deploy id'}
            return [string]$deployment.id
        }catch{throw 'Falha ao iniciar deploy. Resposta omitida; mantenha recuperacao ativa.'}
    }finally{$headers.Clear();$ApiToken=$null;$deployment=$null}
}
