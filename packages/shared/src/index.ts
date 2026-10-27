import { z } from 'zod';
export const roles = ['LEILOEIRO', 'LICITANTE'] as const;
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(10).max(128),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100),
  role: z.enum(roles),
});
export const depositSchema = z.object({amountCents: z.number().int().min(100).max(100_000_000)});
export type Role = typeof roles[number];
export type PublicUser = {id: string; name: string; role: Role; publicId: string};
export type Session = {token: string; user: PublicUser};
export type Wallet = {totalCents: number; committedCents: number; availableCents: number};
export type WalletEntry = {id: string; amountCents: number; kind: string; createdAt: string};

export const centsSchema = z.number().int().min(1).max(100_000_000);
export const createAuctionSchema = z.object({
  catalogId: z.string().regex(/^OL\d+W$/),
  initialCents: centsSchema,
  incrementCents: centsSchema,
  startsAt: z.iso.datetime({offset:true}),
  endsAt: z.iso.datetime({offset:true}),
}).refine(v=>Date.parse(v.endsAt)>Date.parse(v.startsAt),{message:'O fim deve ser posterior ao início.',path:['endsAt']});
export const bidSchema = z.object({amountCents:centsSchema});
export type ItemSnapshot = {
  catalogId:string; title:string; authors:string[]; firstPublishYear:number|null;
  image:string|null; sourceUrl:string; importedAt:string;
};
export type CatalogItem = {id:string; item:ItemSnapshot};
export type AuctionStatus = 'AGENDADO'|'AO_VIVO'|'ENCERRADO'|'CANCELADO';
export type Auction = {
  id:string; item:ItemSnapshot; initialCents:number; incrementCents:number;
  currentCents:number|null; leaderPublicId:string|null; bidCount:number;
  startsAt:string; endsAt:string; cancelledAt:string|null; status:AuctionStatus;
  settledAt:string|null;
};
export type PublicBid = {id:string; bidderPublicId:string; amountCents:number; sequence:number; createdAt:string};
export type AuctionRoom = {auction:Auction; bids:PublicBid[]; serverTime:string};
export type AuctionList = {auctions:Auction[]; serverTime:string};
export type AuditRecord = {auctionId:string;sequence:number;previousHash:string;payload:Record<string,unknown>;hash:string;signature:string};
export type AuditTransition = {
  version:1;scope:'elite-audit-key-transition';id:string;createdAt:string;namespace:string;
  legacyPublicKey:string;legacyFingerprint:string;legacyKeyStatus:'potentially-compromised';
  activePublicKey:string;activeFingerprint:string;
  boundaries:{auctionId:string;sequence:number;hash:string}[];signature:string;
};
export type AuditReport = {
  auctionId:string;status:'INTEGRO'|'ADULTERADO'|'PENDENTE';issues:string[];
  records:AuditRecord[];checkpoints:AuditRecord[];publicKey:string;fingerprint:string;legacyBaseline:boolean;
  activeFingerprint?:string;keyring?:{fingerprint:string;publicKey:string;status:'active'|'historical-potentially-compromised'}[];
  transition?:AuditTransition;transitionHash?:string;signatureKeys?:{sequence:number;fingerprint:string}[];
};
export type Receipt = {id:string;auctionId:string;item:ItemSnapshot;amountCents:number;winnerPublicId:string;endedAt:string;settledAt:string;record:AuditRecord;verification:'INTEGRO'|'ADULTERADO'|'PENDENTE';signingFingerprint?:string;transitionHash?:string};
export type Result = {auction:Auction;receiptId:string|null;won:boolean;amountCents:number|null};
