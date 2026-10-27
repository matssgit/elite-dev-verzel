import { it,expect } from 'vitest';
import { deploymentMetadata,waitForActiveDeployment } from '../../../scripts/neon-deployment-verification.mjs';
const url='https://function.test/';
const row=(id:number,status:string,active=id)=>[{slug:'settlement',invocation_url:url,current_deployment:{id,status},active_deployment:{id:active,status:'completed'}}];
it('waits past an unchanged old deployment and a new unfinished/inactive build',async()=>{
  const samples=[row(10,'completed'),row(11,'building',10),row(11,'completed',10),row(11,'completed')],observed:number[]=[];
  const result=await waitForActiveDeployment(async()=>samples.shift()!,{previousId:10,url,pause:async()=>{},observe:async m=>{observed.push(m.current!.id);}});
  expect(observed).toEqual([10,11,11,11]);expect(result.active?.id).toBe(11);
});
it('rejects failed, concurrent and wrong-target updates instead of accepting CLI success',async()=>{
  await expect(waitForActiveDeployment(async()=>row(11,'failed',10),{previousId:10,url})).rejects.toThrow('build failed');
  const rows=[row(11,'building',10),row(12,'completed')];await expect(waitForActiveDeployment(async()=>rows.shift()!,{previousId:10,url,pause:async()=>{}})).rejects.toThrow('Concurrent');
  await expect(waitForActiveDeployment(async()=>row(11,'completed'),{previousId:10,url:'https://wrong.test/'})).rejects.toThrow('URL');
});
it('does not retain environment names or values in the deployment observation',()=>{
  const input=row(11,'completed');Object.assign(input[0]!.current_deployment,{environment:['SECRET_NAME'],secret:'never-return'});expect(JSON.stringify(deploymentMetadata(input))).not.toContain('SECRET');expect(JSON.stringify(deploymentMetadata(input))).not.toContain('never-return');
});
