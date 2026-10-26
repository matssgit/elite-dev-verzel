import process from 'node:process';
import { URL } from 'node:url';
const value=process.env.VITE_API_URL;
if(!value)throw new Error('Defina VITE_API_URL com a origem HTTPS pública da API antes de publicar.');
const url=new URL(value);
if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.pathname!=='/')throw new Error('VITE_API_URL deve ser somente a origem HTTPS da API, sem credenciais, caminho ou query.');
