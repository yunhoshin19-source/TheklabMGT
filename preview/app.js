'use strict';
const events=[
{date:'2026-11-03',type:'maintenance',text:'유지보수 정기청구 · 100만원'},
{date:'2026-11-05',type:'expense',text:'서버비 비용전표 · 80만원'},
{date:'2026-11-07',type:'contract',text:'A사 계약 시작'},
{date:'2026-11-09',type:'maintenance',text:'C사 유지보수 청구'},
{date:'2026-11-12',type:'expense',text:'광고비 · 200만원'},
{date:'2026-11-15',type:'project',text:'웹 리뉴얼 계약금 · 900만원'},
{date:'2026-11-18',type:'end',text:'B사 계약 종료'},
{date:'2026-11-20',type:'project',text:'앱 고도화 중도금 · 1,500만원'},
{date:'2026-11-24',type:'expense',text:'비용 지급 예정 · 35만원'},
{date:'2026-11-27',type:'maintenance',text:'정기 유지보수 청구'},
{date:'2026-11-28',type:'project',text:'웹 리뉴얼 중도금 · 1,200만원'},
{date:'2026-11-30',type:'expense',text:'월말 회계 마감'},
{date:'2026-12-18',type:'project',text:'웹 리뉴얼 잔금 · 1,500만원'}];
let offset=0,selectedDate='2026-11-15';
const pad=n=>String(n).padStart(2,'0');
function cal(){const base=new Date(2026,10+offset,1),ym=base.getFullYear()+'-'+pad(base.getMonth()+1),last=new Date(base.getFullYear(),base.getMonth()+1,0).getDate(),start=base.getDay();document.getElementById('monthTitle').textContent=base.getFullYear()+'년 '+(base.getMonth()+1)+'월';document.getElementById('thisMonth').textContent=base.getFullYear()+'.'+pad(base.getMonth()+1);const grid=document.getElementById('calendar');grid.replaceChildren();['일','월','화','수','목','금','토'].forEach(w=>{const div=document.createElement('div');div.className='weekday';div.textContent=w;grid.append(div)});const count=Math.ceil((start+last)/7)*7;for(let i=0;i<count;i++){const n=i-start+1,cell=document.createElement('div');cell.className='day';if(n<1||n>last){cell.classList.add('off');const d=new Date(base.getFullYear(),base.getMonth(),n);cell.textContent=(d.getMonth()+1)+'/'+d.getDate()}else{const date=ym+'-'+pad(n);const num=document.createElement('div');num.className='date';num.textContent=n;cell.append(num);const list=events.filter(e=>e.date===date);list.slice(0,3).forEach(e=>{const x=document.createElement('span');x.className='event '+e.type;x.textContent=e.text;cell.append(x)});cell.tabIndex=0;cell.setAttribute('role','button');cell.setAttribute('aria-label',date+' 일정 확인 및 전표 등록');cell.onclick=()=>dayModal(date);cell.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();dayModal(date)}}}grid.append(cell)}}
function showView(id){document.querySelectorAll('.view').forEach(e=>e.classList.toggle('active',e.id===id));document.querySelectorAll('nav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));const titles={dashboard:'계약·회계 대시보드',contracts:'계약관리',parties:'거래처 마스터',vouchers:'회계전표 관리',tax:'세무 증빙관리',users:'사용자관리'};document.getElementById('viewTitle').textContent=titles[id]||titles.dashboard;window.scrollTo({top:0,behavior:'smooth'})}
function openModal(title,html){document.getElementById('modalTitle').textContent=title;document.getElementById('modalContent').innerHTML=html;document.getElementById('shade').classList.add('open')}
function close(){document.getElementById('shade').classList.remove('open')}
function fields(rows){return '<div class="fields">'+rows.map(([label,field,wide])=>'<div'+(wide?' class="wide"':'')+'><label>'+label+'</label>'+field+'</div>').join('')+'</div><div class="modal-footer"><button class="primary" id="previewSave">확인 (저장하지 않음)</button></div>'}
const input=(placeholder,type='text')=>'<input type="'+type+'" placeholder="'+placeholder+'">';
function modal(type){const templates={
contract:fields([['계약 유형','<select><option>유지보수</option><option>프로젝트</option></select>'],['거래처',input('거래처 선택')],['계약명',input('계약명'),true],['총 계약금액',input('원','number')],['월 청구금액',input('유지보수 전용','number')],['계약 시작일',input('','date')],['계약 종료일',input('','date')]]),
party:fields([['구분','<select><option>사업자</option><option>개인</option></select>'],['거래처명',input('거래처명')],['담당자명',input('담당자명')],['담당자 이메일',input('email@example.com','email')]]),
voucher:fields([['전표 유형','<select><option>매출 청구</option><option>입금</option><option>매입·비용</option><option>지급</option></select>'],['전표일자',input(selectedDate,'date')],['내용',input('거래내역'),true],['공급가액',input('원','number')],['증빙 파일','<input type="file" disabled title="파일 저장은 비활성화">']]),
user:fields([['이름',input('사용자명')],['이메일',input('email@example.com','email')],['권한','<select><option>담당자</option><option>관리자</option><option>세무사</option></select>']])
};openModal(type==='contract'?'계약 등록 시안':type==='party'?'거래처 등록 시안':type==='voucher'?'전표 등록 시안':'사용자 등록 시안',templates[type]);document.getElementById('previewSave').onclick=()=>{alert('UI 프리뷰입니다. 데이터가 저장되지 않습니다.');close()}}
function dayModal(date){selectedDate=date;const list=events.filter(e=>e.date===date);const ul=document.createElement('ul');ul.className='event-list';list.forEach(e=>{const li=document.createElement('li');li.textContent=e.text;ul.append(li)});const text=list.length?ul.outerHTML:'<p class="help">등록된 일정이 없습니다.</p>';openModal(date+' 일정',text+'<div class="modal-footer"><button class="primary" id="fromDay">＋ 이 날짜에 전표 등록</button></div>');document.getElementById('fromDay').onclick=()=>modal('voucher')}
function download(){const rows=[['일자','유형','내용','증빙 상태'],['2026-11-05','비용','서버비','샘플 첨부'],['2026-11-12','비용','광고비','미첨부']];const csv='\uFEFF'+rows.map(r=>r.join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='THEKLAB_preview_sample.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));document.querySelectorAll('[data-modal]').forEach(b=>b.onclick=()=>modal(b.dataset.modal));
document.getElementById('prevMonth').onclick=()=>{offset--;cal()};document.getElementById('nextMonth').onclick=()=>{offset++;cal()};document.getElementById('thisMonth').onclick=()=>{offset=0;cal()};document.getElementById('closeModal').onclick=close;document.getElementById('shade').onclick=e=>{if(e.target.id==='shade')close()};document.onkeydown=e=>{if(e.key==='Escape')close()};document.getElementById('downloadDemo').onclick=download;document.getElementById('taxExport').onclick=download;
cal();
