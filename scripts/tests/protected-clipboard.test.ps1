$ErrorActionPreference='Stop'
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'protected-clipboard.ps1')
# Public fixture only; these functions shadow the real Windows clipboard.
function Set-Clipboard {param([string]$Value,[string]$ErrorAction) $script:copies.Add($Value);if($script:failFirst){$script:failFirst=$false;throw 'fixture clipboard busy'};$script:fakeClipboard=$Value}
function Get-Clipboard {param([switch]$Raw,[string]$ErrorAction) return $script:fakeClipboard}
function Read-Host {param([string]$Prompt) if($script:answers.Count -eq 0){throw 'Unexpected prompt'};$answer=$script:answers.Dequeue();if($answer -eq 'C-CHANGED'){$script:fakeClipboard='PUBLIC TERMINAL OUTPUT';return 'C'};return $answer}
function Write-Host {param([string]$Object) $script:messages.Add($Object)}
function Write-Warning {param([string]$Message) $script:messages.Add($Message)}
function Invoke-Fixture([string[]]$Answers,[int]$ExpectedCopies,[bool]$FailFirst=$false,[bool]$Cancel=$false){
    $script:fakeClipboard='PUBLIC INITIAL';$script:copies=New-Object 'System.Collections.Generic.List[string]';$script:messages=New-Object 'System.Collections.Generic.List[string]';$script:answers=New-Object 'System.Collections.Generic.Queue[string]';$script:failFirst=$FailFirst
    foreach($answer in $Answers){$script:answers.Enqueue($answer)}
    $cancelled=$false
    try{Copy-ProtectedClipboardField -Name 'PUBLIC_FIXTURE_FIELD' -Value 'PUBLIC-FIXTURE-CONTENT'}catch{if(-not $Cancel){throw};$cancelled=$true}
    if($Cancel -ne $cancelled){throw 'Cancellation mismatch'}
    if(($script:copies | Where-Object {$_ -eq 'PUBLIC-FIXTURE-CONTENT'}).Count -ne $ExpectedCopies){throw 'Copy count mismatch'}
    if(($script:messages -join ' ').Contains('PUBLIC-FIXTURE-CONTENT')){throw 'Clipboard value leaked into output'}
    if(-not $Cancel -and $script:fakeClipboard -ne ''){throw 'Clipboard fixture not cleared'}
}
Invoke-Fixture -Answers @('','C') -ExpectedCopies 1
Invoke-Fixture -Answers @('','R','C') -ExpectedCopies 2
Invoke-Fixture -Answers @('','C-CHANGED','C') -ExpectedCopies 2
Invoke-Fixture -Answers @('','C','C') -ExpectedCopies 2 -FailFirst $true
Invoke-Fixture -Answers @('','S') -ExpectedCopies 1 -Cancel $true
[Console]::WriteLine('5 public-fixture checks passed. Real clipboard and DPAPI were not accessed.')

