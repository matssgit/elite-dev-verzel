# Native handoff only. Clipboard contents are compared inside this process and
# are never returned or printed. Tests replace both clipboard cmdlets in memory.
function Copy-ProtectedClipboardField {
    param([Parameter(Mandatory=$true)][string]$Name,[Parameter(Mandatory=$true)][string]$Value)
    Write-Host "Prepare o campo de VALOR de $Name no Render."
    Write-Host 'Nao copie comandos/saida nem selecione texto no terminal depois da copia. Cole somente no painel protegido.'
    $null=Read-Host 'Pressione Enter quando o campo estiver pronto para receber o valor'
    while($true){
        $confirmed=$false
        try {
            Set-Clipboard -Value $Value -ErrorAction Stop
            $localClipboard=Get-Clipboard -Raw -ErrorAction Stop
            $confirmed=[string]::Equals($Value,[string]$localClipboard,[StringComparison]::Ordinal)
        }catch{ $confirmed=$false }
        finally{ $localClipboard=$null }
        if($confirmed){Write-Host 'Copia conferida localmente. Clique no campo de valor e cole agora com Ctrl+V.'}
        else{Write-Warning 'A copia nao foi confirmada. Nao cole nem avance; tente R ou interrompa com S.'}
        $choice=Read-Host '[R] copiar novamente o MESMO valor; [C] colei corretamente; [S] interromper'
        if($choice -ieq 'S'){throw 'Handoff interrompido pelo operador. Nenhum deploy foi iniciado pelo script.'}
        if($choice -ieq 'R'){continue}
        if($choice -ine 'C'){Write-Warning 'Etapa nao confirmada. O mesmo valor sera copiado novamente.';continue}
        if(-not $confirmed){Write-Warning 'Nao e possivel confirmar uma copia que falhou.';continue}
        try {
            $localClipboard=Get-Clipboard -Raw -ErrorAction Stop
            $unchanged=[string]::Equals($Value,[string]$localClipboard,[StringComparison]::Ordinal)
        }catch{ $unchanged=$false }
        finally{ $localClipboard=$null }
        if(-not $unchanged){Write-Warning 'A area de transferencia mudou desde a copia. O mesmo valor sera recopiado; substitua o campo antes de confirmar.';continue}
        try{Set-Clipboard -Value '' -ErrorAction Stop}catch{Write-Warning 'Nao foi possivel limpar a area de transferencia. Limpe-a manualmente antes de continuar.'}
        return
    }
}
