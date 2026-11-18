import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { hashPassword } from '../auth.js';
const base='http://127.0.0.1:3000',pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
let server,cookie='';
async function request(path,options={}){
 const headers={...(options.body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})};
 const res=await fetch(base+path,{...options,headers:{...headers,...options.headers},redirect:'manual'});
 let body=null;const text=await res.text();try{body=JSON.parse(text)}catch{body=text}
 return {status:res.status,body,cookie:res.headers.get('set-cookie'),headers:res.headers};
}
const send=(path,obj,method='POST')=>request(path,{method,headers:{Origin:base},body:JSON.stringify(obj)});
async function ready(){
 for(let i=0;i<60;i++){try{const r=await request('/api/health');if(r.status===200)return}catch{}await sleep(200)}throw Error('API failed health check');
}
try{
 console.log('Starting API with temporary PostgreSQL...');
 server=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,COOKIE_SECURE:'false',API_PORT:'3000',API_HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',d=>process.stdout.write(d));server.stderr.on('data',d=>process.stderr.write(d));
 await ready();console.log('PASS: DB health / API reachable');
 let r=await request('/contracts.html');assert.equal(r.status,302);console.log('PASS: protected contract page redirect');
 r=await request('/api/me');assert.equal(r.status,401);
 const pw='TestStrongPassword_2026#';
 await pool.query('INSERT INTO app_users(email,display_name,password_hash,role) VALUES($1,$2,$3,$4)',['admin@test.invalid','Test Admin',await hashPassword(pw),'admin']);
 r=await send('/api/login',{email:'admin@test.invalid',password:'wrong-password'});assert.equal(r.status,401);
 r=await send('/api/login',{email:'admin@test.invalid',password:pw});assert.equal(r.status,200);assert.ok(r.cookie?.includes('HttpOnly'));cookie=r.cookie.split(';')[0];console.log('PASS: password verification and secure session cookie');
 r=await request('/api/me');assert.equal(r.status,200);assert.equal(r.body.user.role,'admin');
 r=await request('/contracts.html');assert.equal(r.status,200);assert.ok(r.body.includes('계약관리'));console.log('PASS: authenticated HTML and /api/me');
 r=await send('/api/users',{email:'staff@test.invalid',name:'Staff User',role:'staff',password:pw});assert.equal(r.status,201);
 r=await request('/api/users');assert.equal(r.status,200);assert.equal(r.body.users.length,2);console.log('PASS: DB user management');
 r=await send('/api/parties',{type:'business',name:'Test Client',registration:'123-45-67890'});assert.equal(r.status,201);const partyId=r.body.id;
 const p={partyId,no:'KLAB-TEST-001',title:'Maintenance service',type:'maintenance',signed:'2026-11-01',start:'2026-11-01',end:'2027-10-31',status:'active',contractAmount:12000000,monthlyAmount:1000000,billingDay:10,vatTreatment:'taxable',memo:'test',autoRenew:false,noticeDays:30,schedules:[]};
 r=await send('/api/contracts',p);assert.equal(r.status,201);const maintId=r.body.id;
 r=await request('/api/contracts');assert.equal(r.status,200);const m=r.body.contracts.find(c=>c.id===maintId);assert.equal(m.contractAmount,12000000);assert.equal(m.monthlyAmount,1000000);console.log('PASS: maintenance total amount vs monthly amount');
 const q={...p,no:'KLAB-TEST-002',title:'Project A',type:'project',contractAmount:9000000,monthlyAmount:null,billingDay:null,schedules:[{type:'receipt',title:'Deposit',date:'2026-11-15',amount:9000000}]};
 r=await send('/api/contracts',q);assert.equal(r.status,201);const projectId=r.body.id;
 r=await request('/api/contracts/'+projectId+'/schedules');assert.equal(r.status,200);assert.equal(r.body.schedules.length,1);const schedule=r.body.schedules[0];
 r=await send('/api/schedules/'+schedule.id+'/receipts',{date:'2026-11-15',amount:3000000,title:'First receipt'});assert.equal(r.status,201);assert.equal(r.body.remaining,6000000);
 r=await request('/api/contracts/'+projectId+'/schedules');assert.equal(r.body.schedules[0].status,'partial');
 r=await send('/api/schedules/'+schedule.id+'/receipts',{date:'2026-11-20',amount:6000000,title:'Final receipt'});assert.equal(r.status,201);assert.equal(r.body.remaining,0);
 r=await send('/api/schedules/'+schedule.id+'/receipts',{date:'2026-11-21',amount:1,title:'Overpay'});assert.equal(r.status,409);console.log('PASS: partial and full receipt allocation / overpayment protection');
 r=await request('/api/contracts');let project=r.body.contracts.find(c=>c.id===projectId);
 r=await send('/api/contracts/'+projectId,{...q,title:'Project A updated',revision:project.revision,schedules:[{id:schedule.id,type:'receipt',title:'Deposit',date:'2026-11-15',amount:9000000}]},'PUT');assert.equal(r.status,200);assert.equal(r.body.revision,2);
 r=await send('/api/contracts/'+projectId,{...q,revision:1,schedules:[{id:schedule.id,type:'receipt',title:'Deposit',date:'2026-11-15',amount:9000000}]},'PUT');assert.equal(r.status,409);
 r=await request('/api/contracts/'+projectId+'/history');assert.equal(r.status,200);assert.ok(r.body.history.length>=3);console.log('PASS: revision, change history and conflict control');
 r=await send('/api/logout',{});assert.equal(r.status,200);cookie='';r=await request('/api/me');assert.equal(r.status,401);console.log('PASS: logout invalidates DB session');
 console.log('ALL INTEGRATION CHECKS PASSED');
}catch(e){console.error('INTEGRATION FAILED:',e.stack);process.exitCode=1}finally{if(server){server.kill('SIGTERM')}await pool.end()}
