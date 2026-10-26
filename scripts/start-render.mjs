import process from 'node:process';
import { spawn } from 'node:child_process';
import { access, mkdir, open } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
if(process.env.NODE_ENV!=='production')throw new Error('O entrypoint Render exige NODE_ENV=production.');
const directory=process.env.AUDIT_DIRECTORY;
if(!directory||!isAbsolute(directory)||process.env.AUDIT_REQUIRE_MOUNT!=='true')throw new Error('O entrypoint Render exige diretório absoluto e verificação de volume persistente.');
// Initialize key/pin on the actual runtime disk, before seeding or serving requests.
await import('../apps/api/dist/check-storage.js');
async function run(script) {
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[script],{stdio:'inherit',env:process.env});
    const forward=signal=>child.kill(signal);
    const stop=()=>forward('SIGTERM');process.once('SIGTERM',stop);process.once('SIGINT',stop);
    child.once('error',reject);child.once('exit',code=>{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);if(code===0)resolve();else reject(new Error(`${script} falhou; código ${code}`));});
  });
}
if(process.env.SEED_DEMO_ON_START==='true') {
  await mkdir(directory,{recursive:true});const marker=join(directory,'demo-seeded');
  let seeded=false;try{await access(marker);seeded=true;}catch{/* First successful runtime seed only. */}
  if(!seeded) {
    await run('apps/api/dist/seed.js');
    const file=await open(marker,'wx',0o600);try{await file.writeFile('Seed completed\n');await file.sync();}finally{await file.close();}
  }
}
await import('../apps/api/dist/server.js');
