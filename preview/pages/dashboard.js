const K=window.KLAB;let offset=0;const pad=x=>String(x).padStart(2,'0');
function render(){
 const d=K.data,base=new Date(2026,10+offset,1),prefix=base.getFullYear()+'-'+pad(base.getMonth()+1),end=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();
 document.getElementById('monthTitle').textContent=base.getFullYear()+'년 '+(base.getMonth()+1)+'월';document.getElementById('today').textContent=base.getFullYear()+'.'+pad(base.getMonth()+1);
 const vouchers=d.vouchers.filter(v=>v.date.startsWith(prefix)&&v.status==='approved');
 const sum=type=>vouchers.filter(v=>v.type===type).reduce((s,v)=>s+Number(v.amount),0);
 const active=d.contracts.filter(c=>c.start<=prefix+'-'+pad(end)&&c.end>=prefix+'-01');
 const regular=active.filter(c=>c.type==='maintenance');const projects=active.filter(c=>c.type==='project');
 const monthly=regular.reduce((s,c)=>s+Number(c.monthlyAmount),0);
 const due=d.schedules.filter(s=>s.date.startsWith(prefix)&&s.type==='receipt').reduce((s,x)=>s+K.remaining(x),0);
 const metrics=[['유지보수 계약',regular.length+'건','월 청구 '+K.money(monthly)],['프로젝트 계약',projects.length+'건','계약 '+K.money(projects.reduce((s,c)=>s+c.contractAmount,0))],['정기 청구 예정',K.money(monthly),'월 청구일 기준'],['입금 예정 잔액',K.money(due),'미입금 예정액'],['매입·비용',K.money(sum('expense')),'확정 비용'],['관리손익',K.money(sum('billing')-sum('expense')),'청구 − 비용']];
 document.getElementById('kpis').innerHTML=metrics.map(m=>'<article class="kpi"><small>'+K.esc(m[0])+'</small><strong>'+K.esc(m[1])+'</strong><span class="hint">'+K.esc(m[2])+'</span></article>').join('');
 const events=[];
 for(const c of d.contracts){
  if(c.start.startsWith(prefix))events.push({date:c.start,color:'green',text:c.title+' 시작'});
  if(c.end.startsWith(prefix))events.push({date:c.end,color:'red',text:c.title+' 종료'});
  if(c.type==='maintenance'){const day=prefix+'-'+pad(Math.min(end,Number(c.billingDay||10)));if(c.start<=day&&c.end>=day)events.push({date:day,color:'blue',text:c.title+' 청구 '+K.money(c.monthlyAmount)})}
 }
 for(const s of d.schedules)if(s.date.startsWith(prefix))events.push({date:s.date,color:'purple',text:s.title+' 예정 '+K.money(s.amount)});
 for(const v of d.vouchers)if(v.date.startsWith(prefix))events.push({date:v.date,color:'yellow',text:v.title+' '+K.money(v.amount)});
 const first=base.getDay(),cells=Math.ceil((end+first)/7)*7,cal=document.getElementById('calendar');cal.replaceChildren();
 for(const w of ['일','월','화','수','목','금','토']){const h=document.createElement('div');h.className='weekday';h.textContent=w;cal.append(h)}
 for(let i=0;i<cells;i++){const n=i-first+1,cell=document.createElement('div');cell.className='day';if(n<1||n>end){cell.classList.add('empty');cell.textContent='·'}else{const date=prefix+'-'+pad(n),list=events.filter(e=>e.date===date);const num=document.createElement('div');num.className='number';num.textContent=n;cell.append(num);for(const e of list.slice(0,3)){const line=document.createElement('div');line.className='event '+e.color;line.textContent=e.text;cell.append(line)}if(list.length>3){const more=document.createElement('div');more.className='help';more.textContent='+'+(list.length-3)+'건';cell.append(more)}cell.tabIndex=0;cell.setAttribute('role','button');cell.setAttribute('aria-label',date+' 업무');cell.onclick=()=>dayModal(date,list);cell.onkeydown=e=>{if(e.key==='Enter'){dayModal(date,list)}}}cal.append(cell)}
 document.getElementById('scheduleTable').innerHTML=d.schedules.filter(s=>s.type==='receipt').sort((a,b)=>a.date.localeCompare(b.date)).slice(0,12).map(s=>'<tr><td>'+K.esc(d.contracts.find(c=>c.id===s.contractId)?.title||'—')+'</td><td>'+K.esc(s.title)+'</td><td>'+K.esc(s.date)+'</td><td>'+K.money(s.amount)+'</td><td>'+K.money(K.paid(s.id))+'</td><td>'+K.money(K.remaining(s))+'</td></tr>').join('');
 const exp=vouchers.filter(v=>v.type==='expense');document.getElementById('evidence').innerHTML='<p>비용전표 <b>'+exp.length+'건</b></p><p>첨부 표시 <b>'+exp.filter(v=>v.receipt).length+'건</b></p><p>미첨부 <b>'+exp.filter(v=>!v.receipt).length+'건</b></p>';
 document.getElementById('profitTable').innerHTML='<p>확정 청구 <b>'+K.money(sum('billing'))+'</b></p><p>확정 비용 <b>'+K.money(sum('expense'))+'</b></p><hr><p>관리손익 <b>'+K.money(sum('billing')-sum('expense'))+'</b></p>'
}
function dayModal(date,items){let content='<p class="muted">'+K.esc(date)+' · '+items.length+'건</p><div class="timeline">'+(items.length?items.map(x=>'<div class="history-row">'+K.esc(x.text)+'</div>').join(''):'<p class="help">일정이 없습니다.</p>')+'</div><div class="form-actions"><button class="btn primary" id="toVoucher">이 날짜에 전표 등록</button></div>';
 K.openModal('일정 및 전표',content);document.getElementById('toVoucher').onclick=()=>location.href='./vouchers.html?date='+encodeURIComponent(date);
}
document.getElementById('prev').onclick=()=>{offset--;render()};document.getElementById('next').onclick=()=>{offset++;render()};document.getElementById('today').onclick=()=>{offset=0;render()};document.addEventListener('demo-data-change',render);render();
