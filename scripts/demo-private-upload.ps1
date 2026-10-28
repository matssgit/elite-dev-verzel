# Transport for this NEW demo service only. Tests replace all HTTP in memory.
function Send-DemoAuditConfiguration {
    param([Parameter(Mandatory=$true)][string]$ApiToken,[Parameter(Mandatory=$true)][hashtable]$Variables)
    $serviceId='srv-dbh86ed9fdbs7387t2m0'
    $allowed=@('AUDIT_PRIVATE_KEY','AUDIT_PUBLIC_KEY_FINGERPRINT','WEB_ORIGIN','FINANCIAL_MAINTENANCE','RUN_SETTLEMENT_JOBS','ALLOW_DEMO_SEED')
    if($Variables.Count -ne $allowed.Count){throw 'Unexpected field set.'}
    foreach($key in $Variables.Keys){if($key -notin $allowed){throw 'Unexpected field.'}}
    if($Variables.FINANCIAL_MAINTENANCE -cne 'true' -or $Variables.RUN_SETTLEMENT_JOBS -cne 'false' -or $Variables.ALLOW_DEMO_SEED -cne 'false' -or $Variables.WEB_ORIGIN -cne 'https://elite-verzel-demo.vercel.app'){throw 'Initial demo blocks/origin required.'}
    if(-not $Variables.AUDIT_PRIVATE_KEY -or $Variables.AUDIT_PUBLIC_KEY_FINGERPRINT -notmatch '^[a-f0-9]{64}$'){throw 'Invalid demo identity.'}
    $headers=@{Authorization="Bearer $ApiToken"}
    try {
        try {$service=Invoke-RestMethod -Method Get -Uri "https://api.render.com/v1/services/$serviceId" -Headers $headers -MaximumRedirection 0 -TimeoutSec 45 -Verbose:$false -Debug:$false -ErrorAction Stop}
        catch {throw 'Cannot verify demo target. No changes sent.'}
        if($service.id -cne $serviceId -or $service.name -cne 'elite-verzel-demo-api' -or $service.ownerId -cne 'tea-d979q6ss728c738vup30' -or $service.serviceDetails.plan -cne 'free' -or $service.branch -cne 'codex/elite-verzel-demo' -or ($service.repo -replace '\.git$','') -cne 'https://github.com/matssgit/elite-dev-verzel'){throw 'Demo target identity/plan mismatch. No changes sent.'}
        # Apply blocking flags before the identity. No collection replacement.
        foreach($key in @('FINANCIAL_MAINTENANCE','RUN_SETTLEMENT_JOBS','ALLOW_DEMO_SEED','WEB_ORIGIN','AUDIT_PUBLIC_KEY_FINGERPRINT','AUDIT_PRIVATE_KEY')) {
            try {
                $body=@{value=[string]$Variables[$key]} | ConvertTo-Json -Compress
                [void](Invoke-RestMethod -Method Put -Uri "https://api.render.com/v1/services/$serviceId/env-vars/$key" -Headers $headers -ContentType 'application/json' -Body $body -MaximumRedirection 0 -TimeoutSec 45 -Verbose:$false -Debug:$false -ErrorAction Stop)
            }catch {throw "Demo field $key failed; credentials/response omitted. Stop without retrying automatically."}
            finally {$body=$null}
        }
        try {
            $deployment=Invoke-RestMethod -Method Post -Uri "https://api.render.com/v1/services/$serviceId/deploys" -Headers $headers -ContentType 'application/json' -Body '{"clearCache":"do_not_clear"}' -MaximumRedirection 0 -TimeoutSec 45 -Verbose:$false -Debug:$false -ErrorAction Stop
            if($deployment.id -notmatch '^dep-[a-z0-9]+$'){throw 'Invalid deployment response'}
            return [string]$deployment.id
        }catch {throw 'Demo deploy not confirmed. Response omitted; do not change production.'}
    }finally {$headers.Clear();$ApiToken=$null;$service=$null;$deployment=$null}
}
