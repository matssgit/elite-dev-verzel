import { pgTable, pgEnum, uuid, text, timestamp, bigint, check, index, unique, jsonb, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { ItemSnapshot } from '@elite/shared';
export const role = pgEnum('user_role', ['LEILOEIRO','LICITANTE']);
export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  publicId: uuid('public_id').notNull().unique().defaultRandom(),
  name: text().notNull(), email: text().notNull().unique(),
  passwordHash: text('password_hash').notNull(), role: role().notNull(),
  createdAt: timestamp('created_at', {withTimezone:true}).notNull().defaultNow(),
}, t=>[check('users_email_check',sql`${t.email} = lower(${t.email})`)]);
export const wallets = pgTable('wallets', {
  userId: uuid('user_id').primaryKey().references(()=>users.id),
  totalCents: bigint('total_cents',{mode:'number'}).notNull().default(0),
  committedCents: bigint('committed_cents',{mode:'number'}).notNull().default(0),
}, t=>[check('wallet_valid',sql`${t.committedCents} >= 0 AND ${t.totalCents} >= ${t.committedCents} AND ${t.totalCents} <= 9007199254740991`)]);
export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(), userId: uuid('user_id').notNull().references(()=>users.id),
  expiresAt: timestamp('expires_at',{withTimezone:true}).notNull(),
},t=>[index('sessions_user_idx').on(t.userId),index('sessions_expiry_idx').on(t.expiresAt)]);
export const walletEntries = pgTable('wallet_entries', {
  id: uuid().primaryKey().defaultRandom(), userId: uuid('user_id').notNull().references(()=>users.id),
  amountCents: bigint('amount_cents',{mode:'number'}).notNull(), kind: text().notNull(),
  idempotencyKey: uuid('idempotency_key').notNull(),
  auctionId:uuid('auction_id').references(()=>auctions.id),
  createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[
  index('wallet_entries_user_idx').on(t.userId,t.createdAt),
  unique().on(t.userId,t.idempotencyKey),
  unique().on(t.auctionId,t.kind),
  check('wallet_entries_amount_cents_check',sql`(${t.kind} = 'PURCHASE' AND ${t.amountCents} < 0) OR (${t.kind} IN ('DEPOSIT','SALE') AND ${t.amountCents} > 0)`),
  check('wallet_entries_kind_check',sql`(${t.kind} = 'DEPOSIT' AND ${t.auctionId} IS NULL) OR (${t.kind} IN ('PURCHASE','SALE') AND ${t.auctionId} IS NOT NULL)`),
]);

export const catalogItems = pgTable('catalog_items', {
  id:text().primaryKey(), item:jsonb().$type<ItemSnapshot>().notNull(),
  importedAt:timestamp('imported_at',{withTimezone:true}).notNull().defaultNow(),
});
export const auctions = pgTable('auctions', {
  id:uuid().primaryKey().defaultRandom(), ownerId:uuid('owner_id').notNull().references(()=>users.id),
  item:jsonb().$type<ItemSnapshot>().notNull(),
  initialCents:bigint('initial_cents',{mode:'number'}).notNull(),
  incrementCents:bigint('increment_cents',{mode:'number'}).notNull(),
  currentCents:bigint('current_cents',{mode:'number'}),
  leaderId:uuid('leader_id').references(()=>users.id),
  bidCount:integer('bid_count').notNull().default(0),
  startsAt:timestamp('starts_at',{withTimezone:true}).notNull(),
  endsAt:timestamp('ends_at',{withTimezone:true}).notNull(),
  cancelledAt:timestamp('cancelled_at',{withTimezone:true}),
  settledAt:timestamp('settled_at',{withTimezone:true}),
  auditVersion:integer('audit_version').notNull().default(1),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[
  index('auctions_owner_idx').on(t.ownerId),index('auctions_ends_idx').on(t.endsAt),
  check('auction_dates',sql`${t.endsAt} > ${t.startsAt}`),
  check('auction_money',sql`${t.initialCents} BETWEEN 1 AND 100000000 AND ${t.incrementCents} BETWEEN 1 AND 100000000 AND (${t.currentCents} IS NULL OR ${t.currentCents} BETWEEN ${t.initialCents} AND 100000000)`),
  check('auction_leader',sql`(${t.leaderId} IS NULL AND ${t.currentCents} IS NULL AND ${t.bidCount} = 0) OR (${t.leaderId} IS NOT NULL AND ${t.currentCents} IS NOT NULL AND ${t.bidCount} > 0)`),
  check('auction_cancel',sql`${t.cancelledAt} IS NULL OR ${t.bidCount} = 0`),
]);
export const auditRecords=pgTable('audit_records',{
  auctionId:uuid('auction_id').notNull().references(()=>auctions.id,{onDelete:'cascade'}),
  sequence:integer().notNull(),previousHash:text('previous_hash').notNull(),
  payload:jsonb().$type<Record<string,unknown>>().notNull(),hash:text().notNull(),signature:text().notNull(),
  publishedAt:timestamp('published_at',{withTimezone:true}),
},t=>[unique().on(t.auctionId,t.sequence),check('audit_sequence',sql`${t.sequence} >= 0`)]);
export const receipts=pgTable('receipts',{
  id:uuid().primaryKey(),auctionId:uuid('auction_id').notNull().unique().references(()=>auctions.id,{onDelete:'cascade'}),
  winnerId:uuid('winner_id').notNull().references(()=>users.id),winnerPublicId:uuid('winner_public_id').notNull(),
  item:jsonb().$type<ItemSnapshot>().notNull(),amountCents:bigint('amount_cents',{mode:'number'}).notNull(),
  endedAt:timestamp('ended_at',{withTimezone:true}).notNull(),settledAt:timestamp('settled_at',{withTimezone:true}).notNull(),
},t=>[check('receipt_amount',sql`${t.amountCents} BETWEEN 1 AND 100000000`)]);
export const bids = pgTable('bids', {
  id:uuid().primaryKey().defaultRandom(), auctionId:uuid('auction_id').notNull().references(()=>auctions.id),
  bidderId:uuid('bidder_id').notNull().references(()=>users.id),
  amountCents:bigint('amount_cents',{mode:'number'}).notNull(), sequence:integer().notNull(),
  idempotencyKey:uuid('idempotency_key').notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull(),
},t=>[
  unique().on(t.auctionId,t.sequence),unique().on(t.bidderId,t.idempotencyKey),
  index('bids_bidder_idx').on(t.bidderId,t.auctionId),
  check('bid_money',sql`${t.amountCents} BETWEEN 1 AND 100000000 AND ${t.sequence} > 0`),
]);
