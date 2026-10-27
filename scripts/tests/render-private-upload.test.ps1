$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'render-private-upload.ps1')
# All HTTP is mocked; no clipboard, DPAPI, account or provider is accessed.
$script:calls=New-Object 'System.Collections.Generic.List[object]'
function Invoke-RestMethod {
    param($Method,$Uri,$Headers,$ContentType,$Body,$MaximumRedirection,$TimeoutSec,$Verbose,$Debug,$ErrorAction)
    $script:calls.Add(@{Method=$Method;Uri=$Uri;Body=$Body;Headers=$Headers.Clone()})
    if($Method -eq 'Post'){return @{id='dep-publicfixture'}}
    return @{value='PUBLIC-FIXTURE-VALUE'}
}
$values=@{FINANCIAL_MAINTENANCE='true';AUDIT_RECOVERY_MODE='true';RUN_SETTLEMENT_JOBS='false';AUDIT_PRIVATE_KEY='PUBLIC-FIXTURE-VALUE';AUDIT_PUBLIC_KEY_FINGERPRINT='PUBLIC-FIXTURE-FP';AUDIT_TRANSITION_JSON='{}';AUDIT_TRANSITION_SHA256='PUBLIC-FIXTURE-HASH'}
$result=Send-RenderAuditConfiguration -ApiToken 'PUBLIC-FIXTURE-TOKEN' -Variables $values
if($result -cne 'dep-publicfixture' -or $script:calls.Count -ne 8){throw 'Unexpected result/call count'}
if(($script:calls | Where-Object {$_.Method -eq 'Put'}).Count -ne 7){throw 'Expected only individual field updates'}
foreach($call in $script:calls){if($call.Uri -notlike 'https://api.render.com/v1/services/srv-dbfoo38ae00c73cqb0r0/*'){throw 'Unexpected destination'}}
if(@($script:calls | Where-Object {$_.Uri.EndsWith('/AUDIT_PRIVATE_KEY')}).Count -ne 1){throw 'Missing protected field update'}
$failed=$false
try{Send-RenderAuditConfiguration -ApiToken 'PUBLIC-FIXTURE-TOKEN' -Variables @{FINANCIAL_MAINTENANCE='false'}}catch{$failed=$true}
if(-not $failed -or $script:calls.Count -ne 8){throw 'Invalid flags must fail before HTTP'}
[Console]::WriteLine('Direct upload public-fixture checks passed: fixed destination, no response-value output, blocked invalid flags, no real HTTP.')
