import http from 'node:http';
import pg from 'pg';
import { handleContractRoutes } from './contracts.js';
import { createToken, hashPassword, verifyPassword, normalizeEmail, validatePassword, tokenHash, sessionCookie, clearedCookie, parseCookie } from './auth.js';
const {Pool}=pg;
const port=Number(process.env.API_PORT||3000);
const secureCookie=process.env.COOKIE_SECURE!=='false';
const pool=new Pool({connectionString:process.env.DATABASE_URL, max:10});
function json(res,status,payload,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(payload))}
async function readBody(req){let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>16384)throw new Error('too_large');chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new Error('bad_json')}}
function safeUser(u){return {id:u.id,email:u.email,name:u.display_name,role:u.role,isActive:u.is_active}}
async function actor(req){const raw=parseCookie(req.headers.cookie);if(!raw)return null;const r=await pool.query(`SELECT u.id,u.email,u.display_name,u.role,u.is_active,s.id AS session_id
 FROM app_sessions s JOIN app_users u ON s.user_id=u.id
 WHERE s.token_hash=$1 AND s.expires_at>now() AND u.is_active=TRUE LIMIT 1`,[tokenHash(raw)]);return r.rows[0]||null}
function originValid(req){const origin=req.headers.origin;const host=req.headers.host;if(!origin||!host)return false;try{const url=new URL(origin);return url.host===host&&(url.protocol==='https:'||process.env.COOKIE_SECURE==='false'&&url.protocol==='http:')}catch{return false}}
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 const path=url.pathname;
 if(path==='/api/health'&&req.method==='GET')return json(res,200,{ok:true});
 if(req.method==='POST'&&!originValid(req))return json(res,403,{error:'Invalid origin'});
 if(path==='/api/login'&&req.method==='POST'){
  const body=await readBody(req),email=normalizeEmail(body.email),password=body.password;
  if(!email||typeof password!=='string'||password.length>256)return json(res,400,{error:'Invalid request'});
  const result=await pool.query('SELECT * FROM app_users WHERE email=$1',[email]);
  const user=result.rows[0],deny=()=>json(res,401,{error:'이메일 또는 비밀번호를 확인하세요.'});
  if(!user||!user.is_active||user.locked_until&&new Date(user.locked_until)>new Date())return deny();
  const valid=await verifyPassword(password,user.password_hash);
  if(!valid){
   await pool.query(`UPDATE app_users SET failed_attempts=failed_attempts+1,
    locked_until=CASE WHEN failed_attempts+1>=5 THEN now()+interval '15 minutes' ELSE locked_until END
    WHERE id=$1`,[user.id]);
   return deny();
  }
  const token=createToken();
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   await client.query('UPDATE app_users SET failed_attempts=0,locked_until=NULL,last_login_at=now() WHERE id=$1',[user.id]);
   await client.query("INSERT INTO app_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '8 hours')",[user.id,tokenHash(token)]);
   await client.query('INSERT INTO auth_audit(user_id,action) VALUES($1,$2)',[user.id,'LOGIN']);
   await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
  return json(res,200,{user:safeUser(user)},{'Set-Cookie':sessionCookie(token,secureCookie)});
 }
 const user=await actor(req);
 if(path==='/api/me'&&req.method==='GET')return user?json(res,200,{user:safeUser(user)}):json(res,401,{error:'Authentication required'});
 if(path==='/api/logout'&&req.method==='POST'){
  const raw=parseCookie(req.headers.cookie);
  if(raw)await pool.query('DELETE FROM app_sessions WHERE token_hash=$1',[tokenHash(raw)]);
  return json(res,200,{ok:true},{'Set-Cookie':clearedCookie(secureCookie)});
 }
 if(!user)return json(res,401,{error:'Authentication required'});
 if(await handleContractRoutes({req,res,url,user,pool,readBody}))return;
 if(path==='/api/users'&&req.method==='GET'){
  if(user.role!=='admin')return json(res,403,{error:'Forbidden'});
  const result=await pool.query('SELECT id,email,display_name,role,is_active,created_at,last_login_at FROM app_users ORDER BY created_at DESC');
  return json(res,200,{users:result.rows.map(safeUser)});
 }
 if(path==='/api/users'&&req.method==='POST'){
  if(user.role!=='admin')return json(res,403,{error:'Forbidden'});
  const body=await readBody(req),email=normalizeEmail(body.email),name=String(body.name||'').trim(),role=body.role;
  if(!email.includes('@')||name.length<1||name.length>100||!['admin','manager','staff','accountant'].includes(role)||!validatePassword(body.password))return json(res,400,{error:'Invalid user details or password below 12 chars'});
  try{
   const result=await pool.query('INSERT INTO app_users(email,display_name,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,email,display_name,role,is_active',[email,name,await hashPassword(body.password),role]);
   await pool.query('INSERT INTO auth_audit(user_id,action) VALUES($1,$2)',[user.id,'CREATE_USER']);
   return json(res,201,{user:safeUser(result.rows[0])});
  }catch(e){if(e.code==='23505')return json(res,409,{error:'Email already exists'});throw e}
 }
 if(path.startsWith('/api/users/')&&req.method==='PATCH'){
  if(user.role!=='admin')return json(res,403,{error:'Forbidden'});
  const id=path.slice('/api/users/'.length),body=await readBody(req);
  if(!/^[0-9a-f-]{36}$/.test(id)||typeof body.isActive!=='boolean')return json(res,400,{error:'Invalid update'});
  if(id===user.id&&!body.isActive)return json(res,400,{error:'Cannot deactivate yourself'});
  const result=await pool.query('UPDATE app_users SET is_active=$1 WHERE id=$2 RETURNING id,email,display_name,role,is_active',[body.isActive,id]);
  if(!result.rowCount)return json(res,404,{error:'Not found'});
  if(!body.isActive)await pool.query('DELETE FROM app_sessions WHERE user_id=$1',[id]);
  await pool.query('INSERT INTO auth_audit(user_id,action) VALUES($1,$2)',[user.id,body.isActive?'ACTIVATE_USER':'DEACTIVATE_USER']);
  return json(res,200,{user:safeUser(result.rows[0])});
 }
 return json(res,404,{error:'Not found'});
 }catch(e){console.error('API error:',e.message);return json(res,e.message==='too_large'?413:e.message==='bad_json'?400:e.httpStatus||500,{error:e.httpStatus?e.message:'Request could not be processed'})}
});
server.listen(port,'127.0.0.1',()=>console.log('THE KLAB API listening on 127.0.0.1:'+port));
