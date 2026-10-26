import { StrictMode, createContext, useContext, useState, useEffect, type ReactNode, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loginSchema, registerSchema, depositSchema, type Session, type PublicUser, type Wallet, type WalletEntry } from '@elite/shared';
import { api, money, parseMoney } from './api';
import './style.css';
import { AuctionShowcase, SellerPanel, AuctionRoomPage } from './auction-pages';
import { ResultsPage, ReceiptPage, AuditPage } from './result-pages';
const queryClient=new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:true}}});
const Auth=createContext<{session:Session|null;ready:boolean;save:(s:Session|null)=>void}>({session:null,ready:false,save:()=>{}});
function AuthProvider({children}:{children:ReactNode}) {
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    const token=sessionStorage.getItem('elite-token');
    if(!token) {setReady(true); return;}
    let active=true;
    api<{user:PublicUser}>('/auth/me',{},token).then(({user})=>{if(active)setSession({token,user});}).catch(()=>{sessionStorage.removeItem('elite-token');}).finally(()=>{if(active)setReady(true);});
    return ()=>{active=false;};
  },[]);
  function save(next:Session|null) {
    queryClient.clear(); setSession(next);
    if(next)sessionStorage.setItem('elite-token',next.token); else sessionStorage.removeItem('elite-token');
  }
  return <Auth.Provider value={{session,ready,save}}>{children}</Auth.Provider>;
}
function Layout() {
  const {session,save,ready}=useContext(Auth);
  const [logoutError,setLogoutError]=useState('');
  async function logout() {
    try {await api('/auth/logout',{method:'POST'},session?.token);save(null);} catch(error) {setLogoutError((error as Error).message);}
  }
  return <><header><NavLink className="brand" to="/"><span className="brand-mark">E<span>↗</span></span><span>elite<span className="brand-sub">LEILÕES</span></span></NavLink><nav aria-label="Menu principal"><NavLink to="/">Vitrine</NavLink>{session?.user.role==='LEILOEIRO'&&<NavLink to="/conta">Meus lotes</NavLink>}{session?.user.role==='LICITANTE'&&<NavLink to="/carteira">Minha carteira</NavLink>}{session&&<NavLink to="/resultados">{session.user.role==='LEILOEIRO'?'Resultados':'Meus arremates'}</NavLink>}</nav><div className="account">{session?<><span>{session.user.name}</span><button className="button outline small" onClick={()=>void logout()}>Sair</button></>:<NavLink className="button small" to="/entrar">Entrar na plataforma ↗</NavLink>}</div></header>{logoutError&&<p className="error" role="alert">{logoutError}</p>}{ready?<Routes><Route path="/" element={<Home/>}/><Route path="/entrar" element={session?<Navigate to="/conta" replace/>:<AuthForm/>}/><Route path="/conta" element={<Account/>}/><Route path="/carteira" element={<WalletPage/>}/><Route path="/lotes/:id" element={<AuctionRoomPage session={session}/>}/><Route path="/resultados" element={<ResultsPage session={session}/>}/><Route path="/comprovantes/:id" element={<ReceiptPage/>}/><Route path="/auditoria/:id" element={<AuditPage/>}/><Route path="*" element={<main><h1>Página não encontrada</h1><NavLink to="/">Voltar ao início</NavLink></main>}/></Routes>:<main role="status">Verificando sua sessão…</main>}<footer><span>ELITE LEILÕES</span><span>Transparência em cada lance.</span><span>Ambiente de demonstração · valores simulados</span></footer></>;
}
function Home() {
  const {session}=useContext(Auth);
  return <main><section className="hero"><div><p className="eyebrow"><span className="dot"/> UMA NOVA FORMA DE DESCOBRIR</p><h1>Boas histórias.<br/>Novas <em>conquistas.</em></h1><p className="lead">Um espaço para encontrar o extraordinário.<br/>Encontre livros, acompanhe os lotes e participe ao vivo.</p><NavLink className="button" to={session?'/conta':'/entrar'}>{session?'Acessar minha conta':'Criar minha conta'} <span>↗</span></NavLink><div className="hero-details"><span>01 / Descubra</span><span>02 / Participe</span><span>03 / Arremate</span></div></div><aside className="hero-art" aria-label="Ilustração de peças colecionáveis"><div className="art-orbit"/><div className="art-disc"/><div className="art-block"/><div className="art-label"><span>OBJETOS COM HISTÓRIA</span><strong>O próximo capítulo<br/>pode ser seu.</strong><span>LIVROS COM NOVAS HISTÓRIAS</span></div></aside></section><AuctionShowcase/><section className="features"><article><span>01</span><h3>Uma conta, seu perfil</h3><p>Cadastre-se como licitante ou leiloeiro para começar.</p></article><article><span>02</span><h3>Carteira simulada</h3><p>Adicione saldo de demonstração, sem pagamentos reais.</p></article><article><span>03</span><h3>Clareza em cada etapa</h3><p>Acompanhe o saldo disponível e o histórico dos seus depósitos.</p></article></section></main>;
}
function AuthForm() {
  const [registering,setRegistering]=useState(false);
  const [error,setError]=useState('');
  const {save}=useContext(Auth);const navigate=useNavigate();
  const mutation=useMutation({mutationFn:async(data:FormData)=>{
    const values=Object.fromEntries(data);
    const parsed=(registering?registerSchema:loginSchema).safeParse(values);
    if(!parsed.success)throw new Error('Informe um nome válido, e-mail e senha de 10 a 128 caracteres.');
    if(registering)await api('/auth/register',{method:'POST',body:JSON.stringify(parsed.data)});
    return api<Session>('/auth/login',{method:'POST',body:JSON.stringify(parsed.data)});
  },onSuccess:s=>{save(s);navigate('/conta');},onError:e=>setError(e.message)});
  function submit(event:FormEvent<HTMLFormElement>) {event.preventDefault();setError('');mutation.mutate(new FormData(event.currentTarget));}
  return <main className="auth-layout"><section><p className="eyebrow">BEM-VINDO À ELITE</p><h1>Seu próximo<br/><em>capítulo.</em></h1><p className="lead">Comece com uma conta.<br/>Descubra novas possibilidades.</p></section><section className="panel"><p className="eyebrow">SUA CONTA</p><h2>{registering?'Faça parte da Elite':'Bom ter você de volta'}</h2><form onSubmit={submit}>{registering&&<label>Nome<input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label>}<label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Senha<input name="password" type="password" autoComplete={registering?'new-password':'current-password'} required minLength={10} maxLength={128}/><small>Entre 10 e 128 caracteres.</small></label>{registering&&<label>Como deseja participar?<select name="role"><option value="LICITANTE">Licitante — participar dos leilões</option><option value="LEILOEIRO">Leiloeiro — vender meus lotes</option></select></label>}{error&&<p role="alert" className="error">{error}</p>}<button className="button" disabled={mutation.isPending}>{mutation.isPending?'Aguarde…':registering?'Criar conta':'Entrar'} ↗</button></form><button className="text-link switch" disabled={mutation.isPending} onClick={()=>{setRegistering(!registering);setError('');}}>{registering?'Já tenho uma conta':'Ainda não tenho conta'}</button></section></main>;
}
function Account() {
  const {session}=useContext(Auth);
  if(!session)return <Navigate to="/entrar" replace/>;
  if(session.user.role==='LICITANTE')return <Navigate to="/carteira" replace/>;
  return <SellerPanel session={session}/>;
}
function WalletPage() {
  const {session}=useContext(Auth);
  if(!session)return <Navigate to="/entrar" replace/>;
  if(session.user.role!=='LICITANTE')return <Navigate to="/conta" replace/>;
  return <WalletContent session={session}/>;
}
function WalletContent({session}:{session:Session}) {
  const client=useQueryClient();const [value,setValue]=useState('100,00');const [error,setError]=useState('');const [success,setSuccess]=useState('');
  // Retain the key after a network failure, allowing a safe retry of the same operation.
  const [operation,setOperation]=useState<{key:string;amountCents:number}|null>(null);
  const wallet=useQuery({queryKey:['wallet',session.user.id],queryFn:()=>api<Wallet>('/wallet',{},session.token)});
  const entries=useQuery({queryKey:['wallet-entries',session.user.id],queryFn:()=>api<{entries:WalletEntry[]}>('/wallet/entries',{},session.token)});
  const mutation=useMutation({mutationFn:async()=>{
    const amountCents=parseMoney(value);depositSchema.parse({amountCents});
    const next=operation?.amountCents===amountCents?operation:{key:crypto.randomUUID(),amountCents};setOperation(next);
    return api<Wallet>('/wallet/deposits',{method:'POST',headers:{'Idempotency-Key':next.key},body:JSON.stringify({amountCents})},session.token);
  },onSuccess:async data=>{client.setQueryData(['wallet',session.user.id],data);setSuccess('Depósito simulado concluído.');setOperation(null);await client.invalidateQueries({queryKey:['wallet-entries',session.user.id]});},onError:e=>setError(e.message.includes('[')?'Informe um valor entre R$ 1,00 e R$ 1.000.000,00.':e.message)});
  return <main><div className="page-heading"><div><p className="eyebrow">MINHA CARTEIRA</p><h1>Pronto para o<br/><em>próximo lance.</em></h1></div><span className="badge">● SALDO SIMULADO</span></div>{wallet.isPending?<p role="status">Carregando sua carteira…</p>:wallet.isError?<p className="error" role="alert">{wallet.error.message} <button onClick={()=>void wallet.refetch()}>Tentar novamente</button></p>:<section className="balances">{[['Saldo disponível',wallet.data.availableCents],['Saldo comprometido',wallet.data.committedCents],['Saldo total',wallet.data.totalCents]].map(([label,amount],i)=><article key={label} className={i===0?'primary':''}><span>{label}</span><strong>{money(Number(amount))}</strong><small>{i===0?'Para participar de novos leilões':i===1?'Reservado nos lances que você lidera':'Disponível + comprometido'}</small></article>)}</section>}<div className="wallet-grid"><section className="panel"><p className="eyebrow">ADICIONAR SALDO</p><h2>Prepare sua próxima conquista.</h2><p>Este depósito é uma simulação. Nenhum valor real será cobrado.</p><form onSubmit={e=>{e.preventDefault();setError('');setSuccess('');mutation.mutate();}}><label>Valor do depósito (R$)<input inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)} required aria-describedby="deposit-help" disabled={mutation.isPending}/><small id="deposit-help">De R$ 1,00 até R$ 1.000.000,00. Exemplo: 100,00.</small></label>{error&&<p role="alert" className="error">{error}</p>}{success&&<p role="status" className="success">{success}</p>}<button className="button" disabled={mutation.isPending}>{mutation.isPending?'Processando…':'Simular depósito'} ↗</button></form></section><section className="panel"><p className="eyebrow">MOVIMENTAÇÕES</p><h2>Seu histórico</h2>{entries.isPending?<p role="status">Carregando depósitos…</p>:entries.isError?<p className="error" role="alert">{entries.error.message}</p>:entries.data.entries.length===0?<p>Seu primeiro depósito começa uma nova história.</p>:<ul className="entries">{entries.data.entries.map(e=><li key={e.id}><div><strong>{e.kind==='PURCHASE'?'Arremate liquidado':e.kind==='SALE'?'Recebimento de leilão':'Depósito simulado'}</strong><small>{new Date(e.createdAt).toLocaleString('pt-BR')}</small></div><b>{e.amountCents>0?'+ ':''}{money(e.amountCents)}</b></li>)}</ul>}<small>Exibindo as 50 movimentações mais recentes.</small></section></div></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><Layout/></AuthProvider></BrowserRouter></QueryClientProvider></StrictMode>);
