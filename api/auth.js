import { randomBytes, scrypt as rawScrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(rawScrypt);
export function normalizeEmail(email){return String(email||'').trim().toLowerCase()}
export function validatePassword(p){return typeof p==='string'&&p.length>=12&&Buffer.byteLength(p,'utf8')<=256}
export async function hashPassword(password){
 const salt=randomBytes(16).toString('hex');
 const hash=await scrypt(password,salt,64);
 return 'scrypt:'+salt+':'+hash.toString('hex');
}
export async function verifyPassword(password,encoded){
 try{
  const [alg,salt,stored]=encoded.split(':');
  if(alg!=='scrypt')return false;
  const expected=Buffer.from(stored,'hex');
  if(expected.length!==64)return false;
  const actual=await scrypt(password,salt,64);
  return timingSafeEqual(actual,expected);
 }catch{return false}
}
export function tokenHash(token){return createHash('sha256').update(token).digest('hex')}
export function createToken(){return randomBytes(32).toString('base64url')}
export function sessionCookie(token,secure){return 'theklab_session='+encodeURIComponent(token)+'; HttpOnly; Path=/; SameSite=Strict; Max-Age=28800'+(secure?'; Secure':'')}
export function clearedCookie(secure){return 'theklab_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0'+(secure?'; Secure':'')}
export function parseCookie(header){const part=String(header||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('theklab_session='));return part?decodeURIComponent(part.slice('theklab_session='.length)):null}
