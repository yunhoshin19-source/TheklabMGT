// Authenticated contract and payment management routes.
// All SQL statements use parameters; writes use explicit PostgreSQL transactions.
const allowedRoles=new Set(['admin','manager','staff']);
const statuses=new Set(['draft','review','active','completed','terminated','cancelled']);
const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const amount=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=1000000000000;
const str=(v,max=200)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
const fail=(code,msg)=>{let e=new Error(msg);e.httpStatus=code;throw e};
const shape=c=>({
 partyId:c.partyId, no:c.no, title:c.title, type:c.type, signed:c.signed,
 start:c.start, end:c.end, status:c.status, contractAmount:c.contractAmount,
 monthlyAmount:c.type==='maintenance'?c.monthlyAmount:null,
 billingDay:c.type==='maintenance'?c.billingDay:null,
 vatTreatment:c.vatTreatment||'taxable', memo:c.memo||'',
 autoRenew:!!c.autoRenew, noticeDays:c.noticeDays??30
});
function validateContract(x){
 if(!uuid(x.partyId)||!str(x.no,80)||!str(x.title,200)||!['maintenance','project'].includes(x.type)
  ||![x.signed,x.start,x.end].every(iso)||x.end<x.start||!statuses.has(x.status)
  ||!amount(x.contractAmount)||!['taxable','exempt','not_applicable'].includes(x.vatTreatment||'taxable')
  ||typeof (x.memo||'')!=='string'||(x.memo||'').length>5000)fail(400,'계약 입력값을 확인하세요.');
 if(x.type==='maintenance'&&(!amount(x.monthlyAmount)||!Number.isInteger(x.billingDay)||x.billingDay<1||x.billingDay>31))fail(400,'유지보수 월 청구금액과 청구일이 필요합니다.');
 if(x.noticeDays!==undefined&&(!Number.isInteger(x.noticeDays)||x.noticeDays<0||x.noticeDays>3650))fail(400,'알림일수 오류');
}
function validateSchedules(s){
 if(!Array.isArray(s)||s.length>60)fail(400,'일정 개수를 확인하세요.');
 const ids=new Set();
 for(const t of s){
  if(t.id&&(!uuid(t.id)||ids.has(t.id)))fail(400,'일정 식별자 오류');
  if(t.id)ids.add(t.id);
  if(!['billing','receipt','milestone'].includes(t.type)||!iso(t.date)||!str(t.title,200)||!amount(t.amount))fail(400,'일정 날짜·구분·금액을 확인하세요.');
 }
}
const mapContract=r=>({id:r.id,partyId:r.counterparty_id,no:r.contract_no,title:r.title,type:r.type,signed:r.signed_on,start:r.starts_on,end:r.ends_on,status:r.status,contractAmount:Number(r.total_amount),monthlyAmount:r.monthly_amount===null?null:Number(r.monthly_amount),billingDay:r.billing_day,vatTreatment:r.vat_treatment,memo:r.notes||'',autoRenew:r.auto_renew,noticeDays:r.renewal_notice_days,revision:r.revision});
const mapSchedule=r=>({id:r.id,contractId:r.contract_id,type:r.schedule_type,title:r.title,date:r.scheduled_on,amount:Number(r.amount),paid:Number(r.paid_amount||0),remaining:Number(r.amount)-Number(r.paid_amount||0),status:Number(r.paid_amount||0)>=Number(r.amount)&&Number(r.amount)>0?'paid':Number(r.paid_amount||0)>0?'partial':r.status});
const contractSql='SELECT id,counterparty_id,contract_no,title,type,signed_on,starts_on,ends_on,status,total_amount,monthly_amount,billing_day,vat_treatment,notes,auto_renew,renewal_notice_days,revision FROM contracts';
const scheduleSql=`SELECT s.id,s.contract_id,s.schedule_type,s.title,s.scheduled_on,s.amount,s.status,COALESCE(SUM(a.amount),0) AS paid_amount
 FROM contract_schedules s LEFT JOIN schedule_receipt_allocations a ON a.schedule_id=s.id`;
function respond(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function tx(pool,fn){const c=await pool.connect();try{await c.query('BEGIN');const out=await fn(c);await c.query('COMMIT');return out}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}
async function insertHistory(c,contractId,actor,kind,before,after){await c.query('INSERT INTO contract_change_history(contract_id,changed_by,change_type,old_data,new_data) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)',[contractId,actor,kind,JSON.stringify(before),JSON.stringify(after)])}
async function saveSchedules(c,contractId,submitted){
 const current=await c.query(`SELECT s.id,s.schedule_type,s.title,s.scheduled_on,s.amount,
 COALESCE((SELECT SUM(amount) FROM schedule_receipt_allocations WHERE schedule_id=s.id),0) AS paid
 FROM contract_schedules s WHERE contract_id=$1 ORDER BY scheduled_on,id FOR UPDATE OF s`,[contractId]);
 const known=new Map(current.rows.map(r=>[r.id,r]));
 const incoming=new Set(submitted.filter(t=>t.id).map(t=>t.id));
 for(const row of current.rows){
  if(!incoming.has(row.id)){
   if(Number(row.paid)>0)fail(409,'입금이 연결된 일정은 삭제할 수 없습니다.');
   await c.query('DELETE FROM contract_schedules WHERE id=$1',[row.id]);
  }
 }
 for(const t of submitted){
  if(t.id){
   const old=known.get(t.id);if(!old)fail(400,'다른 계약의 일정을 변경할 수 없습니다.');
   if(Number(old.paid)>t.amount)fail(409,'입금 누적액보다 적게 일정을 변경할 수 없습니다.');
   if(Number(old.paid)>0&&(old.schedule_type!==t.type||old.scheduled_on.toISOString().slice(0,10)!==t.date))
    fail(409,'입금이 연결된 일정의 날짜/유형은 변경할 수 없습니다.');
   await c.query('UPDATE contract_schedules SET schedule_type=$1,title=$2,scheduled_on=$3,amount=$4,updated_at=now() WHERE id=$5',[t.type,t.title,t.date,t.amount,t.id]);
  }else await c.query('INSERT INTO contract_schedules(contract_id,schedule_type,title,scheduled_on,amount) VALUES($1,$2,$3,$4,$5)',[contractId,t.type,t.title,t.date,t.amount]);
 }
}
async function handle({req,res,url,user,pool,readBody}){
 const path=url.pathname,method=req.method;
 if(!path.startsWith('/api/parties')&&!path.startsWith('/api/contracts')&&!path.startsWith('/api/schedules'))return false;
 if(method!=='GET'&&!allowedRoles.has(user.role))return respond(res,403,{error:'읽기 전용 사용자입니다.'}),true;
 if(path==='/api/parties'&&method==='GET'){
  const q=await pool.query('SELECT id,party_type AS type,display_name AS name,registration_number AS registration,contact_email AS email,contact_phone AS phone,notes FROM counterparties ORDER BY display_name');
  return respond(res,200,{parties:q.rows}),true;
 }
 if(path==='/api/parties'&&method==='POST'){
  const b=await readBody(req);
  if(!['business','individual'].includes(b.type)||!str(b.name,200)||b.registration&&(!str(b.registration,30)||b.type!=='business'))fail(400,'거래처 유형과 이름을 확인하세요.');
  const q=await pool.query('INSERT INTO counterparties(party_type,display_name,registration_number,contact_email,contact_phone,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[b.type,b.name.trim(),b.type==='business'?b.registration||null:null,b.email||null,b.phone||null,b.notes||null]);
  return respond(res,201,{id:q.rows[0].id}),true;
 }
 if(path==='/api/contracts'&&method==='GET'){
  const rows=await pool.query(contractSql+' ORDER BY created_at DESC');
  return respond(res,200,{contracts:rows.rows.map(mapContract)}),true;
 }
 if(path==='/api/contracts'&&method==='POST'){
  const b=await readBody(req);validateContract(b);const schedules=b.schedules||[];validateSchedules(schedules);
  if(b.type==='maintenance'&&schedules.length)fail(400,'유지보수 정기 일정은 청구일로 생성합니다.');
  const created=await tx(pool,async c=>{
   const q=await c.query(`INSERT INTO contracts(counterparty_id,contract_no,title,type,signed_on,starts_on,ends_on,status,total_amount,monthly_amount,billing_day,vat_treatment,notes,auto_renew,renewal_notice_days)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
   [b.partyId,b.no,b.title,b.type,b.signed,b.start,b.end,b.status,b.contractAmount,b.type==='maintenance'?b.monthlyAmount:null,b.type==='maintenance'?b.billingDay:null,b.vatTreatment||'taxable',b.memo||'',!!b.autoRenew,b.noticeDays??30]);
   const id=q.rows[0].id;
   if(b.type==='project')await saveSchedules(c,id,schedules);
   await insertHistory(c,id,user.id,'CREATE',null,{contract:shape(b),schedules});
   return id;
  });
  return respond(res,201,{id:created}),true;
 }
 const mt=path.match(/^\/api\/contracts\/([0-9a-f-]{36})(?:\/(history|schedules))?$/i);
 if(mt){
  const id=mt[1],section=mt[2];
  if(!uuid(id))fail(400,'계약 식별자 오류');
  if(section==='history'&&method==='GET'){
   const r=await pool.query('SELECT id,change_type,old_data,new_data,changed_at,changed_by FROM contract_change_history WHERE contract_id=$1 ORDER BY id DESC LIMIT 200',[id]);
   return respond(res,200,{history:r.rows}),true;
  }
  if(section==='schedules'&&method==='GET'){
   const r=await pool.query(scheduleSql+' WHERE s.contract_id=$1 GROUP BY s.id ORDER BY s.scheduled_on,s.id',[id]);
   return respond(res,200,{schedules:r.rows.map(mapSchedule)}),true;
  }
  if(!section&&method==='PUT'){
   const b=await readBody(req);validateContract(b);const schedules=b.schedules||[];validateSchedules(schedules);
   if(b.type==='maintenance'&&schedules.length)fail(400,'유지보수 정기 일정은 청구일로 생성합니다.');
   if(!Number.isInteger(b.revision)||b.revision<1)fail(400,'수정 버전이 필요합니다.');
   const result=await tx(pool,async c=>{
    const found=await c.query(contractSql+' WHERE id=$1 FOR UPDATE',[id]);
    if(!found.rowCount)fail(404,'계약을 찾을 수 없습니다.');
    const old=mapContract(found.rows[0]);
    if(old.revision!==b.revision)fail(409,'다른 사용자가 계약을 수정했습니다. 새로고침 후 다시 시도하세요.');
    if(old.type!==b.type)fail(409,'계약 유형 변경은 별도 계약으로 등록하세요.');
    const beforeSchedules=await c.query(scheduleSql+' WHERE s.contract_id=$1 GROUP BY s.id ORDER BY s.scheduled_on,s.id',[id]);
    await c.query(`UPDATE contracts SET counterparty_id=$1,contract_no=$2,title=$3,signed_on=$4,starts_on=$5,ends_on=$6,status=$7,total_amount=$8,monthly_amount=$9,billing_day=$10,vat_treatment=$11,notes=$12,auto_renew=$13,renewal_notice_days=$14,revision=revision+1 WHERE id=$15`,
     [b.partyId,b.no,b.title,b.signed,b.start,b.end,b.status,b.contractAmount,b.type==='maintenance'?b.monthlyAmount:null,b.type==='maintenance'?b.billingDay:null,b.vatTreatment||'taxable',b.memo||'',!!b.autoRenew,b.noticeDays??30,id]);
    if(old.type==='project')await saveSchedules(c,id,schedules);
    const newSchedules=await c.query(scheduleSql+' WHERE s.contract_id=$1 GROUP BY s.id ORDER BY s.scheduled_on,s.id',[id]);
    await insertHistory(c,id,user.id,'UPDATE',{contract:old,schedules:beforeSchedules.rows.map(mapSchedule)},{contract:{...shape(b),revision:b.revision+1},schedules:newSchedules.rows.map(mapSchedule)});
    return {revision:b.revision+1};
   });
   return respond(res,200,result),true;
  }
 }
 const alloc=path.match(/^\/api\/schedules\/([0-9a-f-]{36})\/receipts$/i);
 if(alloc&&method==='POST'){
  const id=alloc[1],b=await readBody(req);
  if(!uuid(id)||!iso(b.date)||!amount(b.amount)||b.amount===0||!str(b.title,200))fail(400,'입금전표 정보를 확인하세요.');
  const result=await tx(pool,async c=>{
   const schedule=await c.query(`SELECT s.*,k.counterparty_id FROM contract_schedules s JOIN contracts k ON k.id=s.contract_id WHERE s.id=$1 FOR UPDATE OF s`,[id]);
   if(!schedule.rowCount)fail(404,'일정을 찾을 수 없습니다.');
   const sc=schedule.rows[0];
   if(sc.schedule_type!=='receipt')fail(400,'입금 예정 일정만 입금전표 연결이 가능합니다.');
   const paid=await c.query('SELECT COALESCE(SUM(amount),0) AS total FROM schedule_receipt_allocations WHERE schedule_id=$1',[id]);
   if(Number(paid.rows[0].total)+b.amount>Number(sc.amount))fail(409,'입금액이 예정 금액을 초과합니다.');
   const v=await c.query(`INSERT INTO vouchers(contract_id,type,title,document_date,accounting_date,supply_amount,vat_amount,status)
    VALUES($1,'receipt',$2,$3,$3,$4,0,'approved') RETURNING id`,[sc.contract_id,b.title,b.date,b.amount]);
   await c.query('INSERT INTO schedule_receipt_allocations(schedule_id,receipt_voucher_id,amount,created_by) VALUES($1,$2,$3,$4)',[id,v.rows[0].id,b.amount,user.id]);
   const total=Number(paid.rows[0].total)+b.amount;
   await c.query('UPDATE contract_schedules SET status=$1,updated_at=now() WHERE id=$2',[total===Number(sc.amount)?'paid':'partial',id]);
   await insertHistory(c,sc.contract_id,user.id,'RECEIPT_LINK',null,{scheduleId:id,voucherId:v.rows[0].id,amount:b.amount,date:b.date});
   return {voucherId:v.rows[0].id,paid:total,remaining:Number(sc.amount)-total,status:total===Number(sc.amount)?'paid':'partial'};
  });
  return respond(res,201,result),true;
 }
 return respond(res,404,{error:'Unknown contract endpoint'}),true;
}
export {handle as handleContractRoutes};
