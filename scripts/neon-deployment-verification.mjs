export function deploymentMetadata(rows){
  const fn=rows.find(f=>f.slug==='settlement');if(!fn)throw Error('Settlement function missing');
  const pick=d=>d?{id:d.id,status:d.status,createdAt:d.created_at,runtime:d.runtime}:null;
  return {slug:fn.slug,url:fn.invocation_url,current:pick(fn.current_deployment),active:pick(fn.active_deployment)};
}
export async function waitForActiveDeployment(read,{previousId,url,observe=async()=>{},timeoutMs=180000,pause=()=>new Promise(resolve=>globalThis.setTimeout(resolve,2000))}){
  const until=Date.now()+timeoutMs;let target;
  while(Date.now()<until){
    const m=deploymentMetadata(await read());await observe(m);
    if(m.url!==url)throw Error('Unexpected function URL');
    if(m.current&&m.current.id>previousId){
      if(target!==undefined&&target!==m.current.id)throw Error('Concurrent deployment detected');target=m.current.id;
      if(m.current.status==='failed')throw Error('Function build failed');
      if(m.current.status==='completed'&&m.active?.id===target&&m.active.status==='completed')return m;
    }
    await pause();
  }throw Error('No new completed AND active deployment within bounded observation');
}
