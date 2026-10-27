import { createHash } from 'node:crypto';
export function canonical(value:unknown):string {
  if(value===null || typeof value==='boolean' || typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number' && Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(typeof value==='object' && value)return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical((value as Record<string,unknown>)[k])}`).join(',')}}`;
  throw new Error('Invalid canonical JSON');
}
export const digest=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
export const publicFingerprint=(pem:string)=>createHash('sha256').update(pem).digest('hex');
