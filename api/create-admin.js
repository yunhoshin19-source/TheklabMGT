import pg from 'pg';
import { hashPassword, normalizeEmail, validatePassword } from './auth.js';
const {Pool}=pg;
const email=normalizeEmail(process.env.ADMIN_EMAIL);
const name=String(process.env.ADMIN_NAME||'Administrator').trim();
const password=process.env.ADMIN_PASSWORD;
if(!email||!email.includes('@')||!validatePassword(password)){console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) as environment variables.');process.exit(1)}
const pool=new Pool({connectionString:process.env.DATABASE_URL});
try{
 const existing=await pool.query('SELECT id FROM app_users LIMIT 1');
 if(existing.rowCount){console.error('Bootstrap blocked: at least one user already exists.');process.exitCode=1}
 else{
  await pool.query('INSERT INTO app_users (email,display_name,password_hash,role) VALUES ($1,$2,$3,$4)',[email,name,await hashPassword(password),'admin']);
  console.log('Initial administrator created:',email);
 }
}catch(e){console.error('Bootstrap failed:',e.message);process.exitCode=1}
finally{await pool.end()}
