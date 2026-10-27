export type ValidationBinding={runId:string;auctionId:string;buyerId:string;sellerId:string;enabled:boolean};
export type ValidationGrant={runId:string;auctionId:string;buyerId:string;sellerId:string;createdAt:Date;endsAt:Date;expiresAt:Date;admitted:number;state:string;amountCents:number};
export type ScheduledPermit=Readonly<{runId:string;auctionId:string;buyerId:string;sellerId:string;endsAt:Date;expiresAt:Date}>;
const issued=new WeakSet<object>();
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function requireValidation(condition:unknown):asserts condition {if(!condition)throw new Error('Scheduled validation containment rejected');}
export function authorizeScheduledPermit(grant:ValidationGrant,binding:ValidationBinding,now:Date,scheduledAt:Date):ScheduledPermit {
  requireValidation(binding.enabled&&grant.state==='armed'&&grant.amountCents===1000&&grant.admitted>=0&&grant.admitted<2);
  for(const key of ['runId','auctionId','buyerId','sellerId'] as const)requireValidation(uuid.test(binding[key])&&grant[key]===binding[key]);
  requireValidation(grant.buyerId!==grant.sellerId&&now>=grant.createdAt&&now<grant.expiresAt&&grant.expiresAt.getTime()-grant.createdAt.getTime()<=600000);
  requireValidation(scheduledAt>=grant.endsAt&&scheduledAt<=now&&now.getTime()-scheduledAt.getTime()<120000);
  const permit=Object.freeze({runId:grant.runId,auctionId:grant.auctionId,buyerId:grant.buyerId,sellerId:grant.sellerId,endsAt:grant.endsAt,expiresAt:grant.expiresAt});issued.add(permit);return permit;
}
export function assertScheduledPermit(permit:ScheduledPermit,id:string,now?:Date){
  requireValidation(process.env.FINANCIAL_MAINTENANCE==='true'&&issued.has(permit)&&permit.auctionId===id);
  if(now)requireValidation(now<permit.expiresAt);
}
export function assertScheduledLot(permit:ScheduledPermit,lot:{id:string;ownerId:string;leaderId:string|null;currentCents:number|null;initialCents:number;incrementCents:number;bidCount:number;endsAt:Date;cancelledAt:Date|null}){
  assertScheduledPermit(permit,lot.id);
  requireValidation(lot.ownerId===permit.sellerId&&lot.leaderId===permit.buyerId&&lot.currentCents===1000&&lot.initialCents===1000&&lot.incrementCents===100&&lot.bidCount===1&&!lot.cancelledAt&&lot.endsAt.getTime()===permit.endsAt.getTime());
}
