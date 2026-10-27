import { createPublicKey,verify } from 'node:crypto';
import { z } from 'zod';
import type { AuditRecord,AuditTransition } from '@elite/shared';
import { digest,publicFingerprint } from './crypto.js';
const fingerprint=z.string().regex(/^[a-f0-9]{64}$/);
const transitionSchema=z.object({
  version:z.literal(1),scope:z.literal('elite-audit-key-transition'),id:z.uuid(),createdAt:z.iso.datetime(),namespace:z.string().regex(/^[a-zA-Z0-9/_-]+\/$/),
  legacyPublicKey:z.string().max(1000),legacyFingerprint:fingerprint,legacyKeyStatus:z.literal('potentially-compromised'),
  activePublicKey:z.string().max(1000),activeFingerprint:fingerprint,
  boundaries:z.array(z.object({auctionId:z.uuid(),sequence:z.number().int().min(0),hash:fingerprint}).strict()).min(1).max(10000),signature:z.string().max(200),
}).strict();
export function transitionUnsigned(transition:AuditTransition){const {signature,...unsigned}=transition;void signature;return unsigned;}
export function parseTransition(raw:string,expectedHash:string,activeFingerprint:string):AuditTransition {
  const transition=transitionSchema.parse(JSON.parse(raw));
  if(!/^[a-f0-9]{64}$/.test(expectedHash)||digest(transition)!==expectedHash)throw new Error('Untrusted transition hash');
  if(transition.activeFingerprint!==activeFingerprint||transition.legacyFingerprint===activeFingerprint)throw new Error('Transition active identity mismatch');
  if(new Set(transition.boundaries.map(b=>b.auctionId)).size!==transition.boundaries.length)throw new Error('Duplicate transition boundary');
  for(const [pem,fp] of [[transition.legacyPublicKey,transition.legacyFingerprint],[transition.activePublicKey,transition.activeFingerprint]]) {
    if(!pem||publicFingerprint(pem)!==fp||createPublicKey(pem).asymmetricKeyType!=='ed25519')throw new Error('Invalid transition public identity');
  }
  if(!verify(null,Buffer.from(digest(transitionUnsigned(transition)),'hex'),transition.activePublicKey,Buffer.from(transition.signature,'base64')))throw new Error('Invalid transition signature');
  return transition;
}
export function signatureFingerprint(record:Pick<AuditRecord,'auctionId'|'sequence'>,transition:AuditTransition) {
  const boundary=transition.boundaries.find(b=>b.auctionId===record.auctionId);
  return boundary&&record.sequence<=boundary.sequence?transition.legacyFingerprint:transition.activeFingerprint;
}
export function assertBoundary(records:AuditRecord[],auctionId:string,transition:AuditTransition) {
  const boundary=transition.boundaries.find(b=>b.auctionId===auctionId);
  if(boundary&&records[boundary.sequence]?.hash!==boundary.hash)throw new Error('Transition boundary missing or rolled back');
}
