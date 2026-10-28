$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'demo-private-upload.ps1')
$script:calls=New-Object 'System.Collections.Generic.List[object]'
$script:wrongTarget=$false
function Invoke-RestMethod {
    param($Method,$Uri,$Headers,$ContentType,$Body,$MaximumRedirection,$TimeoutSec,$Verbose,$Debug,$ErrorAction)
    $script:calls.Add(@{Method=$Method;Uri=$Uri;Body=$Body})
    if($Method -eq 'Get'){return @{id='srv-dbh86ed9fdbs7387t2m0';name=$(if($script:wrongTarget){'other'}else{'elite-verzel-demo-api'});ownerId='tea-d979q6ss728c738vup30';serviceDetails=@{plan='free';envSpecificDetails=@{startCommand='node scripts/demo-isolation-preflight.mjs && fixture-start'}};branch='codex/elite-verzel-demo';repo='https://github.com/matssgit/elite-dev-verzel'}}
    if($Method -eq 'Post'){return @{id='dep-publicfixture'}}
    return @{value='PUBLIC-FIXTURE'}
}
$values=@{AUDIT_PRIVATE_KEY='PUBLIC-FIXTURE';AUDIT_PUBLIC_KEY_FINGERPRINT=('a'*64);WEB_ORIGIN='https://elite-verzel-demo.vercel.app';FINANCIAL_MAINTENANCE='true';RUN_SETTLEMENT_JOBS='false';ALLOW_DEMO_SEED='false'}
$result=Send-DemoAuditConfiguration -ApiToken 'PUBLIC-FIXTURE-TOKEN' -Variables $values
if($result -cne 'dep-publicfixture' -or $script:calls.Count -ne 8){throw 'Unexpected result/call count'}
foreach($call in $script:calls){if($call.Uri -notlike 'https://api.render.com/v1/services/srv-dbh86ed9fdbs7387t2m0*'){throw 'Wrong destination'}}
if($script:calls[1].Uri -notlike '*/FINANCIAL_MAINTENANCE'){throw 'Blocking flag must precede identity'}
$script:wrongTarget=$true;$failed=$false
try{Send-DemoAuditConfiguration -ApiToken 'PUBLIC-FIXTURE-TOKEN' -Variables $values}catch{$failed=$true}
if(-not $failed -or $script:calls.Count -ne 9){throw 'Target mismatch must stop before writes'}
$values.FINANCIAL_MAINTENANCE='false';$failed=$false
try{Send-DemoAuditConfiguration -ApiToken 'PUBLIC-FIXTURE-TOKEN' -Variables $values}catch{$failed=$true}
if(-not $failed -or $script:calls.Count -ne 9){throw 'Unblocking must stop before HTTP'}
[Console]::WriteLine('Demo transport mock checks passed: exclusive target, identity guard, blocks first, no finance activation; no real HTTP or secrets.')
