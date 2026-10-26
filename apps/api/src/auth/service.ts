import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, gt } from 'drizzle-orm';
import type { z } from 'zod';
import type { registerSchema, PublicUser } from '@elite/shared';
import type { Database } from '../db/client.js';
import { users, wallets, sessions } from '../db/schema.js';
import { AppError } from '../errors.js';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password,salt,64) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}
async function verifyPassword(password: string, stored: string) {
  const [salt,hash] = stored.split(':');
  if(!salt || !hash) return false;
  const actual = await scrypt(password,salt,64) as Buffer;
  const expected = Buffer.from(hash,'hex');
  return actual.length === expected.length && timingSafeEqual(actual,expected);
}
export const tokenHash = (token: string)=>createHash('sha256').update(token).digest('hex');
export const publicUser = (u: typeof users.$inferSelect): PublicUser => ({id:u.id,name:u.name,role:u.role,publicId:u.publicId});
export async function register(db: Database, input: z.infer<typeof registerSchema>) {
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async tx=>{
    const [user] = await tx.insert(users).values({name:input.name,email:input.email,passwordHash,role:input.role}).onConflictDoNothing({target:users.email}).returning();
    if(!user) throw new AppError(409,'EMAIL_IN_USE','Este e-mail já está cadastrado.');
    await tx.insert(wallets).values({userId:user.id});
    return publicUser(user);
  });
}
export async function login(db: Database, email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email,email));
  // Compute scrypt even when the email is absent to reduce account enumeration through timing.
  const valid = await verifyPassword(password,user?.passwordHash ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`);
  if(!user || !valid) throw new AppError(401,'INVALID_CREDENTIALS','E-mail ou senha incorretos.');
  const token = randomBytes(32).toString('hex');
  await db.insert(sessions).values({tokenHash:tokenHash(token),userId:user.id,expiresAt:new Date(Date.now()+24*60*60*1000)});
  return {token,user:publicUser(user)};
}
export async function authenticate(db: Database, authorization?: string) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(authorization ?? '');
  if(!match?.[1]) throw new AppError(401,'UNAUTHORIZED','Entre na sua conta para continuar.');
  const [result] = await db.select({user:users}).from(sessions).innerJoin(users,eq(users.id,sessions.userId)).where(and(eq(sessions.tokenHash,tokenHash(match[1])),gt(sessions.expiresAt,new Date())));
  if(!result) throw new AppError(401,'UNAUTHORIZED','Sua sessão expirou. Entre novamente.');
  return publicUser(result.user);
}
