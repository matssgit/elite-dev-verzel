import process from 'node:process';
import console from 'node:console';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';

// Credentials arrive through a pipe, never through argv, files or shell history.
// This helper does not persist the supplied environment or echo its values.
const command=process.argv.slice(2);if(!command.length)throw new Error('A command is required');
if(process.stdin.isTTY)process.stdin.setRawMode(true);
console.log('Ready for protected environment input');
const input=createInterface({input:process.stdin,terminal:false});
const line=await new Promise(resolve=>input.once('line',resolve));input.close();
if(process.stdin.isTTY)process.stdin.setRawMode(false);
const values=JSON.parse(String(line));
if(!values || Object.entries(values).some(([key,value])=>!/^\w+$/.test(key)||typeof value!=='string'))throw new Error('Invalid environment');
const child=spawn(command[0],command.slice(1),{env:{...process.env,...values},shell:false,stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
child.on('error',()=>{console.error('Unable to start protected command');process.exitCode=1;});
child.on('close',code=>{
  for(const [key,value] of Object.entries(values))if(value && /TOKEN|PRIVATE_KEY|DATABASE_URL/.test(key)) {
    for(const secret of [value,JSON.stringify(value).slice(1,-1)])output=output.split(secret).join('[REDACTED]');
  }
  process.stdout.write(output);process.exitCode=code??1;
});
