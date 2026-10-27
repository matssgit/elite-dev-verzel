import { readFile } from 'node:fs/promises';
import { createPrivateKey,createPublicKey } from 'node:crypto';
import process from 'node:process';
import { log } from 'node:console';
import { verifyTransition,fingerprint,hash } from './audit-verification.mjs';
const [path,expectedHash]=process.argv.slice(2);
const legacy='dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3';
try {
  const transition=JSON.parse(await readFile(path,'utf8'));
  verifyTransition(transition,legacy,expectedHash);
  if(!process.argv.includes('--public-only')&&process.env.AUDIT_PRIVATE_KEY){
    const pem=process.env.AUDIT_PRIVATE_KEY.replace(/\\n/g,'\n');
    const key=createPrivateKey(pem);
    if(key.asymmetricKeyType!=='ed25519'||fingerprint(createPublicKey(key).export({type:'spki',format:'pem'}).toString())!==transition.activeFingerprint)throw Error('identity');
  }
  log(JSON.stringify({ok:true,activeFingerprint:transition.activeFingerprint,transitionHash:hash(transition)}));
}catch{process.stderr.write('Manifesto, pin ou identidade privada divergente. Nenhum valor privado sera exibido.\n');process.exitCode=1;}
