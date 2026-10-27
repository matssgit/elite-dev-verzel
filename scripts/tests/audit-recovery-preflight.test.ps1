$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'audit-recovery-preflight.ps1')
# No real HTTP, sleep, DPAPI, clipboard or provider access.
class AuditFixtureResponse : System.Net.WebResponse {
    [int]$StatusCode
    AuditFixtureResponse([int]$status){$this.StatusCode=$status}
}
function New-ValidDiagnostic {
    return [pscustomobject]@{ok=$true;maintenance=$true;recoveryMode=$true;jobsDisabled=$true;rootPinMatches=$true;allHistoriesMatchObserved=$true;financialSnapshotMatchesObserved=$true;rotationGuardPresent=$false;checkpointCount=15;unexpectedAuditAuctionCount=0;runtime='render'}
}
function Invoke-RestMethod {
    param($Method,$Uri,$TimeoutSec,$MaximumRedirection,$Verbose,$Debug,$ErrorAction,$Headers,$Body)
    $script:calls++
    if($Method -ne 'Get' -or $Uri -cne 'https://elite-dev-verzel-api.onrender.com/audit/diagnostics' -or $TimeoutSec -ne 30 -or $MaximumRedirection -ne 0 -or $Headers -or $Body){throw 'Unsafe fixture request'}
    $event=$script:events.Dequeue()
    if($event -is [int] -or $event -eq 'runtime503'){
        $status=if($event -eq 'runtime503'){503}else{[int]$event}
        $exception=[System.Net.WebException]::new('PUBLIC ERROR BODY MUST NOT BE PRINTED',$null,[System.Net.WebExceptionStatus]::ProtocolError,[AuditFixtureResponse]::new($status))
        $record=[System.Management.Automation.ErrorRecord]::new($exception,'PublicFixture',[System.Management.Automation.ErrorCategory]::InvalidOperation,$null)
        $text=if($event -eq 'runtime503'){'{"ok":false,"maintenance":true,"stage":"independent-read"}'}else{'<html>PUBLIC ERROR BODY MUST NOT BE PRINTED</html>'}
        $record.ErrorDetails=[System.Management.Automation.ErrorDetails]::new($text)
        throw $record
    }
    if($event -eq 'timeout'){throw [TimeoutException]::new('PUBLIC TIMEOUT MUST NOT BE PRINTED')}
    if($event -eq 'tls'){throw [System.Net.WebException]::new('PUBLIC CERT ERROR',$null,[System.Net.WebExceptionStatus]::TrustFailure,$null)}
    if($event -eq 'html'){return '<html>not diagnostic JSON</html>'}
    $state=New-ValidDiagnostic
    if($event -eq 'bad-state'){$state.financialSnapshotMatchesObserved=$false}
    if($event -eq 'string-flag'){$state.maintenance='true'}
    if($event -eq 'missing-count'){$state.PSObject.Properties.Remove('unexpectedAuditAuctionCount')}
    return $state
}
function Start-Sleep {param([int]$Seconds) $script:delays.Add($Seconds)}
function Write-Host {param([string]$Object) $script:messages.Add($Object)}
function Invoke-PreflightFixture([object[]]$Events,[int]$Calls,[int[]]$Delays,[bool]$Fails=$false){
    $script:events=New-Object 'System.Collections.Generic.Queue[object]';foreach($event in $Events){$script:events.Enqueue($event)}
    $script:calls=0;$script:delays=New-Object 'System.Collections.Generic.List[int]';$script:messages=New-Object 'System.Collections.Generic.List[string]'
    $failed=$false
    try{$result=Get-ValidatedAuditRecoveryDiagnostic -BaseUri 'https://elite-dev-verzel-api.onrender.com';if(-not $result.maintenance){throw 'Unexpected result'}}catch{$failed=$true;if($_.Exception.Message -like '*MUST NOT BE PRINTED*'){throw 'Unsanitized exception escaped'}}
    if($failed -ne $Fails -or $script:calls -ne $Calls -or ($script:delays -join ',') -cne ($Delays -join ',')){throw "Fixture mismatch: calls=$script:calls, failed=$failed, delays=$($script:delays -join ',')"}
    if(($script:messages -join ' ') -like '*MUST NOT BE PRINTED*'){throw 'Response contents leaked'}
}
Invoke-PreflightFixture -Events @('ok') -Calls 1 -Delays @()
Invoke-PreflightFixture -Events @(502,503,504,'ok') -Calls 4 -Delays @(5,10,15)
Invoke-PreflightFixture -Events @(503,503,503,503) -Calls 4 -Delays @(5,10,15) -Fails $true
Invoke-PreflightFixture -Events @('timeout','ok') -Calls 2 -Delays @(5)
foreach($status in @(401,403,404,302)){Invoke-PreflightFixture -Events @($status) -Calls 1 -Delays @() -Fails $true}
foreach($event in @('runtime503','bad-state','string-flag','missing-count','html','tls')){Invoke-PreflightFixture -Events @($event) -Calls 1 -Delays @() -Fails $true}
[Console]::WriteLine('14 preflight fixtures passed: bounded GET retries, no semantic/auth/TLS retries, no real HTTP/sleep/secrets.')
