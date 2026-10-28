import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAuctionSchema, type Auction, type AuctionList, type AuctionRoom, type AuctionStatus, type CatalogItem, type Session, type Wallet } from '@elite/shared';
import { api, auctionSocketUrl, money, parseMoney } from './api';

const labels:Record<AuctionStatus,string>={AGENDADO:'Agendado',AO_VIVO:'Ao vivo',ENCERRADO:'Encerrado',CANCELADO:'Cancelado'};
const date=(iso:string)=>new Date(iso).toLocaleString('pt-BR');
function Cover({auction}:{auction:Pick<Auction,'item'>}) {
  return auction.item.image?<img className="book-cover" src={auction.item.image} alt={`Capa de ${auction.item.title}`}/>:<div className="cover-placeholder" aria-label="Livro sem capa disponível">{auction.item.title}</div>;
}
function AuctionCard({auction}:{auction:Auction}) {
  return <article className="auction-card"><NavLink to={`/lotes/${auction.id}`}><Cover auction={auction}/><div className="auction-card-content"><span className={`state state-${auction.status}`}>{labels[auction.status]}</span><h3>{auction.item.title}</h3><p>{auction.item.authors.join(', ')||'Autor não informado'}</p><strong>{money(auction.currentCents??auction.initialCents)}</strong><small>{auction.bidCount?`${auction.bidCount} lance(s)`:'Lance inicial'} · Fim: {date(auction.endsAt)}</small><span className="text-link">Conhecer o lote ↗</span></div></NavLink></article>;
}
export function AuctionShowcase() {
  const query=useQuery({queryKey:['auctions'],queryFn:()=>api<AuctionList>('/auctions'),refetchInterval:15_000});
  return <section className="showcase" id="lotes"><p className="eyebrow">DESCUBRA SUA PRÓXIMA HISTÓRIA</p><h2>Livros em leilão</h2>{query.isPending?<p role="status">Carregando lotes…</p>:query.isError?<p className="error" role="alert">{query.error.message} <button onClick={()=>void query.refetch()}>Tentar novamente</button></p>:<>{(['AO_VIVO','AGENDADO','ENCERRADO'] as const).map(status=><section className="auction-group" key={status}><h3>{labels[status]}</h3>{query.data.auctions.some(a=>a.status===status)?<div className="auction-grid">{query.data.auctions.filter(a=>a.status===status).map(a=><AuctionCard key={a.id} auction={a}/>)}</div>:<p className="empty">Nenhum lote nesta categoria no momento.</p>}</section>)}<small>Exibindo até 100 lotes recentes. Lotes cancelados não aparecem na vitrine.</small></>}</section>;
}
const localDate=(time:number)=>{const d=new Date(time);return new Date(time-d.getTimezoneOffset()*60_000).toISOString().slice(0,16);};
export function SellerPanel({session}:{session:Session}) {
  const [search,setSearch]=useState('');const [query,setQuery]=useState('');const [selected,setSelected]=useState<CatalogItem|null>(null);const [error,setError]=useState('');
  const navigate=useNavigate();const client=useQueryClient();
  const catalog=useQuery({queryKey:['catalog',query],queryFn:()=>api<{items:CatalogItem[];cached:boolean}>(`/catalog?q=${encodeURIComponent(query)}`,{},session.token),enabled:query.length>=2,retry:false});
  const lots=useQuery({queryKey:['my-auctions',session.user.id],queryFn:()=>api<AuctionList>('/me/auctions',{},session.token),refetchInterval:15_000});
  const create=useMutation({mutationFn:async(form:FormData)=>{
    if(!selected)throw new Error('Selecione um livro no catálogo.');
    const input=createAuctionSchema.safeParse({catalogId:selected.id,initialCents:parseMoney(String(form.get('initial'))),incrementCents:parseMoney(String(form.get('increment'))),startsAt:new Date(String(form.get('start'))).toISOString(),endsAt:new Date(String(form.get('end'))).toISOString()});
    if(!input.success)throw new Error('Confira valores e datas. O fim deve ser posterior ao início.');
    return api<{id:string}>('/auctions',{method:'POST',body:JSON.stringify(input.data)},session.token);
  },onSuccess:async lot=>{await client.invalidateQueries({queryKey:['auctions']});navigate(`/lotes/${lot.id}`);},onError:e=>setError(e.message)});
  const cancel=useMutation({mutationFn:(id:string)=>api(`/auctions/${id}/cancel`,{method:'POST'},session.token),onSuccess:async()=>{await Promise.all([client.invalidateQueries({queryKey:['my-auctions']}),client.invalidateQueries({queryKey:['auctions']})]);},onError:e=>setError(e.message)});
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setError('');create.mutate(new FormData(event.currentTarget));}
  return <main><p className="eyebrow">PAINEL DO LEILOEIRO</p><h1>Histórias prontas<br/>para <em>circular.</em></h1>{error&&<p role="alert" className="error">{error}</p>}<div className="seller-grid"><section className="panel"><h2>1. Encontre um livro</h2><p>Dados da Open Library. Selecione um título para guardar uma cópia dos dados e da capa no lote.</p><form onSubmit={e=>{e.preventDefault();setQuery(search.trim());}}><label>Título ou autor<input value={search} onChange={e=>setSearch(e.target.value)} minLength={2} maxLength={100} required/></label><button className="button" disabled={catalog.isFetching}>{catalog.isFetching?'Buscando…':'Pesquisar catálogo'} ↗</button></form>{catalog.isFetching&&<p role="status">Importando livros e capas. Aguarde alguns instantes…</p>}{catalog.isError&&<p role="alert" className="error">{catalog.error.message}</p>}{catalog.data?.cached&&<p role="status">Catálogo externo indisponível. Exibindo itens já importados.</p>}<div className="catalog-results">{catalog.data?.items.map(item=><button type="button" className={`catalog-result ${selected?.id===item.id?'selected':''}`} key={item.id} onClick={()=>setSelected(item)} aria-pressed={selected?.id===item.id}>{item.item.image?<img src={item.item.image} alt=""/>:<span className="mini-cover">▤</span>}<span><strong>{item.item.title}</strong><small>{item.item.authors.join(', ')} · {item.item.firstPublishYear??'Ano não informado'}</small></span></button>)}</div>{catalog.isSuccess&&!catalog.data.items.length&&<p>Nenhum livro encontrado. Tente outro título.</p>}</section><section className="panel"><h2>2. Publique seu lote</h2><p>{selected?`Selecionado: ${selected.item.title}`:'Escolha um livro ao lado para começar.'}</p><form onSubmit={submit}><label>Lance inicial (R$)<input name="initial" inputMode="decimal" defaultValue="50,00" required/></label><label>Incremento mínimo (R$)<input name="increment" inputMode="decimal" defaultValue="5,00" required/></label><label>Início<input name="start" type="datetime-local" defaultValue={localDate(Date.now())} required/></label><label>Encerramento<input name="end" type="datetime-local" defaultValue={localDate(Date.now()+30*60_000)} required/></label><small>Horário local do seu dispositivo. Valores e prazos serão verificados pelo servidor.</small><button className="button" disabled={!selected||create.isPending}>{create.isPending?'Publicando…':'Publicar lote'} ↗</button></form></section></div><section className="showcase"><h2>Meus lotes</h2><NavLink className="button small" to="/resultados">Resultados e total recebido ↗</NavLink><p>Acompanhe o valor dos seus lotes e consulte os resultados e comprovantes após a liquidação automática.</p>{lots.isPending?<p role="status">Carregando…</p>:lots.isError?<p role="alert" className="error">{lots.error.message}</p>:!lots.data.auctions.length?<p>Nenhum lote publicado ainda.</p>:<div className="auction-grid">{lots.data.auctions.map(a=><div key={a.id}><AuctionCard auction={a}/>{a.status!=='CANCELADO'&&a.bidCount===0&&<button className="button outline small cancel-lot" onClick={()=>{setError('');cancel.mutate(a.id);}} disabled={cancel.isPending}>Cancelar lote sem lances</button>}</div>)}</div>}</section></main>;
}

function useAuctionEvents(id:string|undefined) {
  const client=useQueryClient();const [connected,setConnected]=useState(false);
  useEffect(()=>{
    if(!id)return;
    let stopped=false;let socket:WebSocket;let retry:ReturnType<typeof setTimeout>;
    function invalidate() {void client.invalidateQueries({queryKey:['auction',id]});void client.invalidateQueries({queryKey:['wallet']});void client.invalidateQueries({queryKey:['auctions']});}
    function connect() {
      socket=new WebSocket(auctionSocketUrl(id!));
      socket.onopen=()=>{setConnected(true);invalidate();};
      socket.onmessage=()=>invalidate();
      socket.onerror=()=>socket.close();
      socket.onclose=()=>{setConnected(false);if(!stopped)retry=setTimeout(connect,2000);};
    }
    connect();
    return ()=>{stopped=true;clearTimeout(retry);socket?.close();};
  },[id,client]);
  return connected;
}
function AuctionClock({auction,serverTime,onBoundary}:{auction:Auction;serverTime:string;onBoundary:()=>void}) {
  const [localNow,setLocalNow]=useState(Date.now);
  const anchor=useMemo(()=>({server:Date.parse(serverTime),local:Date.now()}),[serverTime]);
  useEffect(()=>{const timer=setInterval(()=>setLocalNow(Date.now()),1000);return ()=>clearInterval(timer);},[]);
  const remaining=Math.max(0,Date.parse(auction.status==='AGENDADO'?auction.startsAt:auction.endsAt)-anchor.server-Math.max(0,localNow-anchor.local));
  useEffect(()=>{if(remaining===0&&(auction.status==='AGENDADO'||auction.status==='AO_VIVO'))onBoundary();},[remaining,auction.status,onBoundary]);
  const seconds=Math.ceil(remaining/1000);const hours=Math.floor(seconds/3600);
  return <div className="auction-clock"><span>{auction.status==='AGENDADO'?'Começa em':auction.status==='AO_VIVO'?'Encerra em':labels[auction.status]}</span><strong>{auction.status==='CANCELADO'||auction.status==='ENCERRADO'?'—':`${String(hours).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}</strong><small>Fim: {date(auction.endsAt)}</small></div>;
}
export function AuctionRoomPage({session}:{session:Session|null}) {
  const {id}=useParams();const client=useQueryClient();const connected=useAuctionEvents(id);
  const room=useQuery({queryKey:['auction',id],queryFn:()=>api<AuctionRoom>(`/auctions/${id}`),enabled:!!id,refetchInterval:connected?false:15_000});
  const refresh=useCallback(()=>{void room.refetch();},[room.refetch]);
  const wallet=useQuery({queryKey:['wallet',session?.user.id],queryFn:()=>api<Wallet>('/wallet',{},session!.token),enabled:session?.user.role==='LICITANTE'});
  const [value,setValue]=useState('');const [feedback,setFeedback]=useState('');const [error,setError]=useState('');
  const [operation,setOperation]=useState<{key:string;amountCents:number}|null>(null);
  const bid=useMutation({mutationFn:async()=>{
    const amountCents=parseMoney(value);const next=operation?.amountCents===amountCents?operation:{key:crypto.randomUUID(),amountCents};setOperation(next);
    return api(`/auctions/${id}/bids`,{method:'POST',headers:{'Idempotency-Key':next.key},body:JSON.stringify({amountCents})},session?.token);
  },onSuccess:async()=>{setFeedback('Lance aceito. Acompanhe sua posição na sala.');setOperation(null);setValue('');await Promise.all([client.invalidateQueries({queryKey:['auction',id]}),client.invalidateQueries({queryKey:['wallet']})]);},onError:async e=>{setError(e.message);await client.invalidateQueries({queryKey:['auction',id]});}});
  const receipt=useQueryReceipt(id,room.data?.auction.settledAt);
  if(room.isPending)return <main role="status">Carregando sala…</main>;
  if(room.isError)return <main><p className="error" role="alert">{room.error.message}</p><NavLink to="/">Voltar à vitrine</NavLink></main>;
  const {auction,bids}=room.data;const leading=!!session&&auction.leaderPublicId===session.user.publicId;
  const participated=!!session&&bids.some(b=>b.bidderPublicId===session.user.publicId);
  const minimum=auction.currentCents===null?auction.initialCents:auction.currentCents+auction.incrementCents;
  return <main><NavLink className="text-link" to="/">← Vitrine</NavLink><div className="room-heading"><span className={`state state-${auction.status}`}>{labels[auction.status]}</span><span className="connection" role="status">{connected?'● Conectado em tempo real':'Reconectando · atualização de segurança a cada 15s'}</span></div><div className="room-grid"><section><Cover auction={auction}/><h1 className="book-title">{auction.item.title}</h1><p>{auction.item.authors.join(', ')||'Autor não informado'} · Primeira publicação: {auction.item.firstPublishYear??'não informada'}</p><a className="text-link" href={auction.item.sourceUrl} target="_blank" rel="noreferrer">Dados bibliográficos na Open Library ↗</a><p className="snapshot-note">Dados e capa importados em {date(auction.item.importedAt)}. O lote usa uma cópia persistida no servidor.</p></section><section className="panel bid-panel"><AuctionClock auction={auction} serverTime={room.data.serverTime} onBoundary={refresh}/><p className="eyebrow">{auction.currentCents===null?'LANCE INICIAL':'LANCE ATUAL'}</p><strong className="current-bid" aria-live="polite">{money(auction.currentCents??auction.initialCents)}</strong><p>Incremento mínimo: {money(auction.incrementCents)} · {auction.bidCount} lance(s)</p>{session?.user.role==='LICITANTE'&&<p className={leading?'success':participated?'error':'position'} role="status">{auction.status==='ENCERRADO'?(leading?(auction.settledAt?'Você arrematou este lote. Liquidação confirmada.':'Você liderou o lote. Aguardando liquidação automática.'):'Leilão encerrado.'):leading?'Você está ganhando':participated?'Você foi superado':'Você ainda não deu lances neste lote.'}</p>}{wallet.data&&<p>Saldo disponível: <b>{money(wallet.data.availableCents)}</b> · <NavLink className="text-link" to="/carteira">Carteira</NavLink></p>}{wallet.isError&&<p className="error" role="alert">{wallet.error.message}</p>}{!session?<NavLink className="button" to="/entrar">Entre para participar ↗</NavLink>:session.user.role==='LEILOEIRO'?<p>Leiloeiros acompanham a sala, mas não podem dar lances.</p>:auction.status==='AO_VIVO'?<form onSubmit={e=>{e.preventDefault();setError('');setFeedback('');bid.mutate();}}><label>Seu lance (R$)<input inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)} placeholder={(minimum/100).toFixed(2).replace('.',',')} required disabled={bid.isPending||leading||auction.status!=='AO_VIVO'}/></label><small>Próximo lance mínimo: {money(minimum)}. Nos últimos 2 minutos, um lance aceito soma 2 minutos ao encerramento.</small><button className="button" disabled={bid.isPending||leading||auction.status!=='AO_VIVO'}>{bid.isPending?'Enviando…':leading?'Você está ganhando':'Oferecer lance'} ↗</button></form>:null}{error&&<p className="error" role="alert">{error}</p>}{auction.status==='AO_VIVO'&&feedback&&<p className="success" role="status">{feedback}</p>}{auction.status==='ENCERRADO'&&<p className="snapshot-note">{auction.bidCount?(auction.settledAt?'Liquidação confirmada. O saldo foi transferido e o comprovante emitido.':'Aguardando liquidação automática. Seu saldo reservado será debitado uma única vez.'):'Lote encerrado sem lances e sem vencedor.'}</p>}</section></div><section className="panel bid-history"><p className="eyebrow">TRANSPARÊNCIA EM CADA LANCE</p><h2>Histórico de lances</h2><div className="result-links"><NavLink className="text-link" to={`/auditoria/${id}`}>Auditoria pública ↗</NavLink>{receipt.data?.receiptId&&<NavLink className="button small" to={`/comprovantes/${receipt.data.receiptId}`}>Comprovante de arremate ↗</NavLink>}</div><p>Participantes identificados por código público. Consulte os eventos assinados e checkpoints na auditoria pública.</p>{!bids.length?<p>Nenhum lance recebido.</p>:<div className="table-scroll"><table><thead><tr><th>Posição</th><th>Participante</th><th>Valor</th><th>Horário</th></tr></thead><tbody>{bids.map((b,i)=><tr key={b.id}><td>{i+1}{i===0?' · líder':''}</td><td><span title={b.bidderPublicId}>Licitante {b.bidderPublicId}</span>{b.bidderPublicId===session?.user.publicId?' (você)':''}</td><td>{money(b.amountCents)}</td><td>{date(b.createdAt)}</td></tr>)}</tbody></table></div>}</section></main>;
}

function useQueryReceipt(id:string|undefined,settledAt:string|null|undefined) {return useQuery({queryKey:['auction-receipt',id,settledAt],queryFn:()=>api<{receiptId:string|null}>(`/auctions/${id}/receipt`),enabled:!!settledAt});}
