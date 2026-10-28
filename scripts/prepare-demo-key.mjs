// HUMAN NATIVE TERMINAL ONLY. Creates a fresh demo identity, no network/clipboard.
import process from 'node:process';
import { generateKeyPairSync,createHash } from 'node:crypto';
import { mkdir,access,writeFile } from 'node:fs/promises';
import { fileURLToPath,URL } from 'node:url';
import { resolve,join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { log } from 'node:console';

if(process.platform!=='win32'||!process.stdin.isTTY)throw Error('Execute somente em PowerShell nativo interativo, sem transcricao/redirecionamento.');
const root=fileURLToPath(new URL('../',import.meta.url));
if(resolve(process.cwd())!==resolve(root))throw Error('Execute na raiz do repositorio original.');
const directory=join(root,'var','demo-identity');
try {await access(directory);throw Error('Identidade demo ja preparada. Nao sobrescrever nem gerar outra.');}
catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(directory,{recursive:true});
const pair=generateKeyPairSync('ed25519');
const publicKey=pair.publicKey.export({type:'spki',format:'pem'}).toString();
const fingerprint=createHash('sha256').update(publicKey).digest('hex');
let privateKey=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
try {
  const child=spawnSync('powershell.exe',['-NoProfile','-Command',`
    $ErrorActionPreference='Stop'
    $acl=New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true,$false)
    $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $inherit=[System.Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
    $prop=[System.Security.AccessControl.PropagationFlags]::None
    $allow=[System.Security.AccessControl.AccessControlType]::Allow
    $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl',$inherit,$prop,$allow)))
    $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule('SYSTEM','FullControl',$inherit,$prop,$allow)))
    Set-Acl -LiteralPath $env:DEMO_KEY_DIRECTORY -AclObject $acl
    $secure=ConvertTo-SecureString $env:DEMO_KEY_MATERIAL -AsPlainText -Force
    try {
      $sealed=ConvertFrom-SecureString $secure
      [IO.File]::WriteAllText((Join-Path $env:DEMO_KEY_DIRECTORY 'private-key.dpapi'),$sealed)
    }finally{$secure.Dispose();$env:DEMO_KEY_MATERIAL=$null;$sealed=$null}
  `],{env:{...process.env,DEMO_KEY_DIRECTORY:directory,DEMO_KEY_MATERIAL:privateKey,DEBUG:'',NODE_DEBUG:''},stdio:['ignore','ignore','ignore'],windowsHide:true});
  if(child.status!==0)throw Error('Preparacao DPAPI/ACL falhou. Nao aplicar configuracao; nao repetir sem revisar o diretorio.');
}finally{privateKey=null;}
await writeFile(join(directory,'public.json'),JSON.stringify({scope:'elite-verzel-demo',namespace:'elite-verzel-demo-v1/',publicKey,fingerprint},null,2)+'\n',{flag:'wx'});
log('Identidade demo protegida por DPAPI/ACL. Nenhum consumidor ou recurso remoto alterado.');
log(`Fingerprint PUBLICO: ${fingerprint}`);
log('Nao envie private-key.dpapi, tokens ou chave privada. Transferencia futura somente por HTTPS revisado, sem clipboard.');
