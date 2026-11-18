const K=window.KLAB,$=id=>document.getElementById(id);
let editId=null,oldRevision=0,originalSchedules=[],fileLabel='';
const value=id=>$(id).value;
function reset(){
 editId=null;oldRevision=0;originalSchedules=[];fileLabel='';
 $('form').reset();$('formTitle').textContent='계약 등록';$('no').value='KLAB-'+Date.now().toString().slice(-8);
 $('signed').value='2026-11-18';$('start').value='2026-11-18';$('end').value='2027-11-17';
 $('scheduleEntries').replaceChildren();$('historyPanel').hidden=true;$('paymentPanel').hidden=true;$('fileName').textContent='';
 $('type').disabled=false;typeChange();$('message').textContent='';
}
function typeChange(){const isM=value('type')==='maintenance';$('monthlyField').hidden=!isM;$('billDayField').hidden=!isM;$('scheduleArea').hidden=isM}
function partyOptions(){const s=$('partyId');const cur=s.value;s.replaceChildren(new Option('거래처 선택',''));for(const p of K.data.parties)s.add(new Option(p.name+' ('+(p.type==='business'?'사업자':'개인')+')',p.id));s.value=cur||''}
function draw(){partyOptions();$('rows').replaceChildren();for(const c of K.data.contracts){const tr=document.createElement('tr');for(const v of [c.no,K.partyName(c.partyId),c.title,c.type==='maintenance'?'유지보수':'프로젝트',K.money(c.contractAmount),c.type==='maintenance'?K.money(c.monthlyAmount):'—',c.status]){const td=document.createElement('td');td.textContent=v;tr.append(td)}const cell=document.createElement('td'),btn=document.createElement('button');btn.className='btn';btn.textContent='수정·조회';btn.onclick=()=>edit(c.id);cell.append(btn);tr.append(cell);$('rows').append(tr)}}
function scheduleLine(s={}){
 const row=document.createElement('div');row.className='form-grid';row.style.cssText='grid-template-columns:120px 1fr 160px 150px 80px;align-items:end;margin:9px 0;gap:7px';row.dataset.id=s.id||'';
 const select=document.createElement('select');for(const [v,l] of [['receipt','입금 예정'],['billing','청구 예정'],['milestone','마일스톤']])select.add(new Option(l,v));select.value=s.type||'receipt';
 const title=document.createElement('input');title.placeholder='계약금 / 중도금 / 잔금';title.value=s.title||'';
 const date=document.createElement('input');date.type='date';date.value=s.date||'';
 const amount=document.createElement('input');amount.type='number';amount.min='0';amount.value=s.amount??'';amount.placeholder='원';
 const del=document.createElement('button');del.type='button';del.className='btn danger';del.textContent='삭제';
 const linked=s.id&&K.paid(s.id)>0;if(linked){del.disabled=true;del.title='입금이 연결된 일정은 삭제할 수 없습니다.';select.disabled=true;date.disabled=true}
 del.onclick=()=>row.remove();
 for(const element of [select,title,date,amount,del]){const box=document.createElement('div');box.className='field';box.append(element);row.append(box)}
 row.values=()=>({id:row.dataset.id||undefined,type:select.value,title:title.value.trim(),date:date.value,amount:Number(amount.value)});
 row.style.overflowX='auto';row.style.gridTemplateColumns='120px minmax(140px,1fr) 145px 130px 75px';
 $('scheduleEntries').append(row)
}
function history(){
 const rows=K.data.histories.filter(x=>x.contractId===editId).slice().reverse();$('historyPanel').hidden=false;$('history').replaceChildren();
 for(const h of rows){const div=document.createElement('div');div.className='history-row';const lead=document.createElement('div');lead.textContent=new Date(h.at).toLocaleString('ko-KR')+' · '+h.action;div.append(lead);
 const details=document.createElement('details'),sum=document.createElement('summary');sum.textContent='변경 전·후 확인';const pre=document.createElement('pre');pre.textContent=JSON.stringify({before:h.before,after:h.after},null,2);details.append(sum,pre);div.append(details);$('history').append(div)}
}
function payments(){
 const c=K.data.contracts.find(x=>x.id===editId);$('paymentPanel').hidden=!c||c.type!=='project';if(!c||c.type!=='project')return;
 const body=$('payments');body.replaceChildren();
 for(const s of K.data.schedules.filter(x=>x.contractId===editId)){
  const tr=document.createElement('tr');for(const v of [s.title,s.date,K.money(s.amount),K.money(K.paid(s.id)),K.money(K.remaining(s)),K.status(s)]){const td=document.createElement('td');td.textContent=v;tr.append(td)}
  const cell=document.createElement('td');if(s.type==='receipt'&&K.remaining(s)>0){const btn=document.createElement('button');btn.className='btn primary';btn.textContent='입금 등록';btn.onclick=()=>receiptModal(s);cell.append(btn)}else cell.textContent='—';tr.append(cell);body.append(tr)
 }
}
function receiptModal(s){
 const remaining=K.remaining(s);
 K.openModal('실제 입금전표 연결','<p class="help">예정금액 '+K.money(s.amount)+' · 입금 누계 '+K.money(K.paid(s.id))+' · 미입금 '+K.money(remaining)+'</p><form id="receiptForm"><div class="form-grid"><div class="field"><label>입금일</label><input type="date" id="paidDate" value="2026-11-18" required></div><div class="field"><label>실제 입금액</label><input type="number" id="paidAmount" min="1" max="'+remaining+'" value="'+remaining+'" required></div><div class="field"><label>전표명</label><input id="paidTitle" required value="'+K.esc(s.title)+' 입금"></div></div><div class="form-actions"><button class="btn primary">입금전표 등록</button></div></form>');
 document.getElementById('receiptForm').onsubmit=e=>{e.preventDefault();const amount=Number(document.getElementById('paidAmount').value);if(!Number.isSafeInteger(amount)||amount<=0||amount>remaining)return alert('미입금액 이하의 금액을 입력하세요.');
 const c=K.data.contracts.find(x=>x.id===s.contractId),v={id:K.id('v'),date:document.getElementById('paidDate').value,type:'receipt',title:document.getElementById('paidTitle').value,partyId:c?.partyId||null,contractId:c?.id||null,amount,vat:0,invoice:false,receipt:'',status:'approved',memo:'프로젝트 입금 일정에 연결'};
 K.data.vouchers.push(v);K.data.allocations.push({id:K.id('al'),scheduleId:s.id,voucherId:v.id,amount});K.data.histories.push({id:K.id('h'),contractId:s.contractId,at:new Date().toISOString(),action:'RECEIPT_LINK',before:null,after:{scheduleId:s.id,voucherId:v.id,amount}});K.save();K.closeModal();payments();history();K.showMessage('입금전표가 등록되고 해당 일정과 연결되었습니다.')};
}
function edit(id){
 const c=K.data.contracts.find(x=>x.id===id);if(!c)return;editId=id;oldRevision=c.revision||1;fileLabel=c.fileLabel||'';partyOptions();
 for(const [key,v] of Object.entries({partyId:c.partyId,type:c.type,status:c.status,no:c.no,title:c.title,signed:c.signed,start:c.start,end:c.end,contractAmount:c.contractAmount,monthlyAmount:c.monthlyAmount??'',billDay:c.billingDay||10,vat:c.vat||'taxable',renew:String(!!c.autoRenew),notice:c.noticeDays??30,memo:c.memo||''})){if($(key))$(key).value=v}
 $('type').disabled=true;typeChange();$('fileName').textContent=fileLabel?'첨부 파일명: '+fileLabel:'';
 $('scheduleEntries').replaceChildren();originalSchedules=K.data.schedules.filter(x=>x.contractId===id).map(x=>({...x}));for(const s of originalSchedules)scheduleLine(s);
 $('formTitle').textContent='계약 수정 · 버전 '+oldRevision;history();payments();$('editPanel').scrollIntoView({behavior:'smooth'});
}
$('form').onsubmit=e=>{
 e.preventDefault();
 const type=value('type'),contractAmount=Number(value('contractAmount')),monthlyAmount=type==='maintenance'?Number(value('monthlyAmount')):null;
 if(value('end')<value('start'))return K.showMessage('계약 종료일은 시작일 이후여야 합니다.',false);
 if(!Number.isSafeInteger(contractAmount)||contractAmount<0||type==='maintenance'&&(!Number.isSafeInteger(monthlyAmount)||monthlyAmount<0))return K.showMessage('계약금액을 확인하세요.',false);
 const id=editId||K.id('ct');
 const c={id,partyId:value('partyId'),type,status:value('status'),no:value('no').trim(),title:value('title').trim(),signed:value('signed'),start:value('start'),end:value('end'),contractAmount,monthlyAmount,billingDay:type==='maintenance'?Number(value('billDay')):null,vat:value('vat'),autoRenew:value('renew')==='true',noticeDays:Number(value('notice')),memo:value('memo'),fileLabel:document.getElementById('file').files[0]?.name||fileLabel,revision:editId?oldRevision+1:1};
 if(K.data.contracts.some(x=>x.no===c.no&&x.id!==c.id))return K.showMessage('계약번호가 중복되었습니다.',false);
 let newSchedules=[];
 if(type==='project'){newSchedules=[...document.querySelectorAll('#scheduleEntries .form-grid')].map(x=>x.values());
  if(newSchedules.some(x=>!x.title||!x.date||!Number.isSafeInteger(x.amount)||x.amount<0))return K.showMessage('프로젝트 입금 일정 입력을 확인하세요.',false);
  const old=K.data.schedules.filter(x=>x.contractId===id);
  for(const s of old){const next=newSchedules.find(x=>x.id===s.id),p=K.paid(s.id);if(p>0&&(!next||next.amount<p||next.date!==s.date||next.type!==s.type))return K.showMessage('실제 입금이 연결된 일정은 삭제·날짜 변경하거나 입금액보다 작게 조정할 수 없습니다.',false)}
 }
 const old=K.data.contracts.find(x=>x.id===id),ix=K.data.contracts.findIndex(x=>x.id===id);
 if(ix>=0)K.data.contracts[ix]=c;else K.data.contracts.push(c);
 if(type==='project'){const ids=new Set(newSchedules.map(x=>x.id).filter(Boolean));K.data.schedules=K.data.schedules.filter(s=>s.contractId!==id||ids.has(s.id));for(const s of newSchedules){if(s.id){const row=K.data.schedules.find(x=>x.id===s.id);Object.assign(row,s)}else K.data.schedules.push({...s,id:K.id('sch'),contractId:id})}}
 K.data.histories.push({id:K.id('h'),contractId:id,at:new Date().toISOString(),action:old?'UPDATE':'CREATE',before:old?{contract:old,schedules:originalSchedules}:null,after:{contract:c,schedules:K.data.schedules.filter(s=>s.contractId===id)}});
 K.save();draw();edit(id);K.showMessage('계약 저장 및 변경이력 반영 완료');
};
$('clear').onclick=reset;$('type').onchange=typeChange;$('addSchedule').onclick=()=>scheduleLine();reset();draw();
