// Used only by the native operator helper; stdout contains PUBLIC data only.
import { createPrivateKey,createPublicKey,createHash } from 'node:crypto';
import process from 'node:process';
import { log } from 'node:console';
try {
  const key=createPrivateKey(process.env.DEMO_NATIVE_KEY??'');
  if(key.asymmetricKeyType!=='ed25519')throw Error('Unexpected type');
  const publicKey=createPublicKey(key).export({type:'spki',format:'pem'});
  log(createHash('sha256').update(publicKey).digest('hex'));
}catch{process.exitCode=1;}
