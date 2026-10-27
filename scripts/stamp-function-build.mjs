/* global process,console */
import { createHash } from 'node:crypto';
import { readdir,readFile,writeFile } from 'node:fs/promises';
const destination='apps/api/src/settlement/function-build.ts';
async function files(dir){const all=[];for(const e of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+e.name;if(e.isDirectory())all.push(...await files(path));else if(e.isFile()&&path.endsWith('.ts')&&path!==destination)all.push(path);}return all;}
const paths=[...await files('apps/api/src'),...await files('packages/shared/src')].sort();const hash=createHash('sha256');
for(const path of paths){hash.update(path+'\n');hash.update((await readFile(path,'utf8')).replaceAll('\r\n','\n'));hash.update('\n');}
const buildId=hash.digest('hex'),source=`// Generated application-source SHA-256 (normalized LF; excludes this module).\nexport const FUNCTION_BUILD_ID='${buildId}';\n`;
if(process.argv.includes('--write'))await writeFile(destination,source);else if(await readFile(destination,'utf8')!==source)throw Error('Function build stamp is stale; run with --write before deployment');
console.log(JSON.stringify({buildId,sourceFiles:paths.length,mode:process.argv.includes('--write')?'write':'check'}));
