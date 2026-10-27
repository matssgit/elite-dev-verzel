/* global fetch, AbortSignal */
// Run ONLY in the operator's native interactive terminal, never through an
// agent tool. New private material is not returned on stdout or written plain.
import process from 'node:process';
import { generateKeyPairSync,randomUUID,sign } from 'node:crypto';
import { readFile,writeFile,mkdir,access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath,URL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { log } from 'node:console';
import { Buffer } from 'node:buffer';
import { fingerprint,hash,verifyReport,verifyTransition } from './audit-verification.mjs';

if(process.platform!=='win32'||!process.stdin.isTTY)throw Error('Use um PowerShell NATIVO interativo do Windows, sem entrada redirecionada.');
const root=fileURLToPath(new URL('../',import.meta.url));
if(resolve(process.cwd())!==resolve(root))throw Error('Execute a partir da raiz F:\\teste-verzel.');
const secretPath=resolve(root,'var/audit-key-rotation/new-private-key.dpapi');
const manifestPath=resolve(root,'docs/AUDIT_SIGNING_TRANSITION.json');
for(const path of [secretPath,manifestPath]){try{await access(path);}catch{continue;}throw Error('Preparacao anterior encontrada. Nao sobrescrever: informe ao agente, sem enviar a chave.');}
const boundary=JSON.parse(await readFile(resolve(root,'docs/AUDIT_ROTATION_BOUNDARY.json'),'utf8'));
const publicKey=await readFile(resolve(root,'docs/AUDIT_PRODUCTION_PUBLIC_KEY.pem'),'utf8');
if(fingerprint(publicKey)!==boundary.legacyFingerprint)throw Error('Pin historico local divergente.');
// Confirm the real public histories BEFORE generating any private material.
for(const pinned of boundary.auctions){
  const response=await fetch(`https://elite-dev-verzel-api.onrender.com/audit/${pinned.auctionId}`,{signal:AbortSignal.timeout(90000)});
  if(response.status!==200)throw Error('Auditoria publica indisponivel. Nenhuma chave gerada.');
  const report=await response.json();verifyReport(report,boundary.legacyFingerprint);
  if(report.records.length!==pinned.events||report.records.at(-1).hash!==pinned.hash||report.records.at(-1).sequence!==pinned.sequence)throw Error('Estado difere da fronteira revisada. Interrompa e informe o agente.');
}
const pair=generateKeyPairSync('ed25519');
const activePublicKey=pair.publicKey.export({type:'spki',format:'pem'}).toString();
const unsigned={version:1,scope:'elite-audit-key-transition',id:randomUUID(),createdAt:new Date().toISOString(),namespace:'elite-v1/',legacyPublicKey:publicKey,legacyFingerprint:boundary.legacyFingerprint,legacyKeyStatus:'potentially-compromised',activePublicKey,activeFingerprint:fingerprint(activePublicKey),boundaries:boundary.auctions.map(({auctionId,sequence,hash})=>({auctionId,sequence,hash}))};
const manifest={...unsigned,signature:sign(null,Buffer.from(hash(unsigned),'hex'),pair.privateKey).toString('base64')};
verifyTransition(manifest,boundary.legacyFingerprint,hash(manifest));
await mkdir(resolve(root,'var/audit-key-rotation'),{recursive:true});
let pem=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
try {
  const protectedWrite=spawnSync('powershell.exe',['-NoProfile','-Command',`
    $ErrorActionPreference='Stop'
    $secure=ConvertTo-SecureString $env:ELITE_NEW_AUDIT_PEM -AsPlainText -Force
    try {
      $sealed=ConvertFrom-SecureString $secure
      $path=$env:ELITE_AUDIT_DPAPI_PATH
      $acl=New-Object System.Security.AccessControl.FileSecurity
      $acl.SetAccessRuleProtection($true,$false)
      $user=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
      $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($user,'FullControl','Allow')))
      $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule('SYSTEM','FullControl','Allow')))
      [IO.File]::WriteAllText($path,$sealed)
      Set-Acl -LiteralPath $path -AclObject $acl
    }finally{$secure.Dispose();$env:ELITE_NEW_AUDIT_PEM=$null;$sealed=$null}
  `],{env:{...process.env,ELITE_NEW_AUDIT_PEM:pem,ELITE_AUDIT_DPAPI_PATH:secretPath,DEBUG:'',NODE_DEBUG:''},stdio:['ignore','ignore','ignore'],windowsHide:true});
  if(protectedWrite.status!==0)throw Error('Falha no armazenamento DPAPI. Nao aplicar nenhuma configuracao; informe o agente.');
}finally{pem=null;}
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
log('Preparacao concluida. Nenhum consumidor foi alterado. Manutencao e cron permanecem como estavam.');
log('Chave privada protegida por DPAPI/ACL em var/audit-key-rotation (ignorado pelo Git). Nao compartilhe esse arquivo.');
log(`Fingerprint PUBLICA nova: ${manifest.activeFingerprint}`);
log(`Hash PUBLICO do manifesto: ${hash(manifest)}`);
log('Informe ao agente: preparacao da chave concluida. Aguarde revisao do manifesto antes de aplicar.');
