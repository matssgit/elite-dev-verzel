const base = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/,'');
export function auctionSocketUrl(id:string) {
  const url=new URL(`${base}/auctions/${id}/events`,window.location.origin);
  url.protocol=url.protocol==='https:'?'wss:':'ws:';return url.toString();
}
export async function api<T>(path:string, options:RequestInit={},token?:string):Promise<T> {
  const headers=new Headers(options.headers);
  if(options.body) headers.set('Content-Type','application/json');
  if(token) headers.set('Authorization',`Bearer ${token}`);
  const response=await fetch(`${base}${path}`,{...options,headers});
  if(!response.ok) {
    const error=await response.json().catch(()=>({message:'O serviço está indisponível. Tente novamente.'})) as {message?:string};
    throw new Error(error.message ?? 'Não foi possível concluir a operação.');
  }
  if(response.status===204) return undefined as T;
  return response.json() as Promise<T>;
}
export const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export function parseMoney(value:string):number {
  if(!/^\d{1,7}(,\d{1,2})?$/.test(value)) throw new Error('Informe um valor como 100,00, sem separador de milhares.');
  const [whole,fraction='']=value.split(',');
  return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
