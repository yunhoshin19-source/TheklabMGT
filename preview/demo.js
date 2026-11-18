/* THE KLAB MGT preview shared runtime. Samples only; never real auth or financial storage. */
(function(){'use strict';
const KEY='theklab_preview_demo_v3',AUTH='theklab_preview_session';
const seed={
 parties:[{id:'party-a',type:'business',name:'예시테크 주식회사',registration:'000-00-00000',contact:'김담당',email:'demo-a@example.com',phone:'010-0000-0000',note:'샘플 거래처'},
 {id:'party-b',type:'business',name:'샘플디자인',registration:'111-11-11111',contact:'이담당',email:'demo-b@example.com',phone:'010-1111-1111',note:''},
 {id:'party-c',type:'individual',name:'홍예시',registration:'',contact:'홍예시',email:'demo-c@example.com',phone:'',note:'가상 개인 프리랜서'}],
 contracts:[
 {id:'ct-a',partyId:'party-a',no:'KLAB-M-001',title:'웹사이트 운영 유지보수',type:'maintenance',signed:'2026-10-28',start:'2026-11-01',end:'2027-10-31',status:'active',contractAmount:12000000,monthlyAmount:1000000,billingDay:10,vat:'taxable',autoRenew:false,noticeDays:30,memo:'매월 정기 점검 포함',revision:1},
 {id:'ct-b',partyId:'party-b',no:'KLAB-P-002',title:'브랜드 사이트 리뉴얼',type:'project',signed:'2026-11-02',start:'2026-11-05',end:'2027-01-31',status:'active',contractAmount:36000000,monthlyAmount:null,billingDay:null,vat:'taxable',autoRenew:false,noticeDays:30,memo:'프로젝트 계약금/중도금/잔금',revision:1},
 {id:'ct-c',partyId:'party-c',no:'KLAB-P-003',title:'UI 디자인 용역',type:'project',signed:'2026-11-03',start:'2026-11-06',end:'2026-12-20',status:'review',contractAmount:8000000,monthlyAmount:null,billingDay:null,vat:'not_applicable',autoRenew:false,noticeDays:14,memo:'샘플 개인 계약',revision:1}],
 schedules:[{id:'sch-a',contractId:'ct-b',type:'receipt',title:'계약금',date:'2026-11-15',amount:9000000},{id:'sch-b',contractId:'ct-b',type:'receipt',title:'중도금',date:'2026-11-28',amount:12000000},{id:'sch-c',contractId:'ct-b',type:'receipt',title:'잔금',date:'2026-12-18',amount:15000000},{id:'sch-d',contractId:'ct-c',type:'receipt',title:'용역 중도금',date:'2026-11-25',amount:4000000},{id:'sch-e',contractId:'ct-c',type:'receipt',title:'용역 잔금',date:'2026-12-20',amount:4000000}],
 vouchers:[{id:'v-a',date:'2026-11-05',type:'expense',title:'클라우드 이용료',partyId:null,contractId:null,amount:800000,vat:80000,invoice:false,receipt:'sample-server.pdf',status:'approved',memo:''},{id:'v-b',date:'2026-11-10',type:'billing',title:'11월 유지보수 청구',partyId:'party-a',contractId:'ct-a',amount:1000000,vat:100000,invoice:true,receipt:'',status:'approved',memo:''},{id:'v-c',date:'2026-11-12',type:'expense',title:'디자인 구독료',partyId:null,contractId:null,amount:350000,vat:35000,invoice:false,receipt:'',status:'approved',memo:''},{id:'v-d',date:'2026-11-16',type:'receipt',title:'리뉴얼 계약금 일부 입금',partyId:'party-b',contractId:'ct-b',amount:3000000,vat:0,invoice:false,receipt:'',status:'approved',memo:''}],
 allocations:[{id:'al-a',scheduleId:'sch-a',voucherId:'v-d',amount:3000000}],
 histories:[{id:'h-a',contractId:'ct-a',at:'2026-10-28T10:00:00Z',action:'CREATE',before:null,after:{title:'웹사이트 운영 유지보수',contractAmount:12000000,monthlyAmount:1000000}}],
 users:[{id:'user-a',name:'관리자 (샘플)',email:'admin@theklab.demo',role:'admin',active:true},{id:'user-b',name:'회계 담당자 (샘플)',email:'staff@theklab.demo',role:'staff',active:true},{id:'user-c',name:'세무사 (샘플)',email:'accountant@theklab.demo',role:'accountant',active:true}]
};
function clone(x){return JSON.parse(JSON.stringify(x))}
function load(){try{let d=JSON.parse(localStorage.getItem(KEY));return d&&Array.isArray(d.contracts)&&Array.isArray(d.vouchers)&&Array.isArray(d.parties)?d:clone(seed)}catch{return clone(seed)}}
let state=load();
function save(){localStorage.setItem(KEY,JSON.stringify(state));document.dispatchEvent(new Event('demo-data-change'))}
function reset(){state=clone(seed);save()}
function id(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function money(v){return Number(v||0).toLocaleString('ko-KR')+'원'}
function compact(v){return Number(v||0).toLocaleString('ko-KR',{maximumFractionDigits:0})+'원'}
function partyName(id){return state.parties.find(x=>x.id===id)?.name||'—'}
function paid(scheduleId){return state.allocations.filter(x=>x.scheduleId===scheduleId).reduce((sum,x)=>sum+Number(x.amount),0)}
function remaining(s){return Math.max(0,Number(s.amount)-paid(s.id))}
function status(s){let n=paid(s.id);return n===0?'입금 예정':n>=s.amount?'완납':'부분입금'}
function month(d){return String(d).slice(0,7)}
function auth(){return sessionStorage.getItem(AUTH)==='demo'}
function nav(){
 const page=document.body.dataset.page||'dashboard';
 if(page==='login')return;
 if(!auth()){location.replace('./index.html');return}
 const sidebar=document.getElementById('siteNav');
 if(!sidebar)return;
 const groups=[
  {title:'워크스페이스',items:[['dashboard','▦','대시보드']]},
  {title:'계약 관리',items:[['parties','♙','거래처 관리'],['contracts','▤','계약 관리']]},
  {title:'회계 · 전표',items:[['vouchers','▧','회계전표'],['tax','▱','세무증빙']]},
  {title:'분석 · 설정',items:[['reports','▥','월별 손익'],['users','♙','사용자 관리']]}
 ];
 sidebar.innerHTML='<a class="brand sidebar-brand" href="./dashboard.html">THE KLAB <small>MANAGEMENT SYSTEM</small></a>'
  +'<nav class="navlinks" aria-label="주요 메뉴">'+groups.map(group=>
  '<section class="sidebar-group"><h2 class="sidebar-group-label">'+group.title+'</h2>'
  +group.items.map(([key,icon,label])=>
   '<a '+(page===key?'aria-current="page" ':'')+'href="./'+key+'.html"><span class="nav-icon" aria-hidden="true">'+icon+'</span><span>'+label+'</span></a>'
  ).join('')+'</section>').join('')+'</nav>'
  +'<div class="navtools"><span class="demo-tag">DEMO · UI PREVIEW</span><p class="sidebar-help">데모 데이터만 사용해주세요.<br>실제 로그인·DB 연결 없음</p><button type="button" class="btn" id="demoLogout">로그아웃</button></div>';
 sidebar.querySelector('#demoLogout').onclick=()=>{sessionStorage.removeItem(AUTH);location.replace('./index.html')};
 const toggle=document.createElement('button');
 toggle.type='button';toggle.id='sidebarToggle';toggle.className='sidebar-toggle';
 toggle.setAttribute('aria-controls','siteNav');toggle.setAttribute('aria-expanded','false');
 toggle.setAttribute('aria-label','메뉴 열기');toggle.textContent='☰';
 const backdrop=document.createElement('div');backdrop.className='sidebar-backdrop';backdrop.hidden=true;
 const setOpen=open=>{
  sidebar.classList.toggle('is-open',open);
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');
  backdrop.hidden=!open;
  document.body.classList.toggle('sidebar-open',open);
 };
 toggle.onclick=()=>setOpen(!sidebar.classList.contains('is-open'));
 backdrop.onclick=()=>setOpen(false);
 sidebar.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
 document.body.prepend(backdrop);
 document.body.prepend(toggle);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false)});
 const title=document.querySelector('.page-head h1');
 if(title){const top=document.createElement('div');top.className='mobile-page-title';top.textContent='THE KLAB';title.parentNode.insertBefore(top,title)}
}
function mark(){const x=document.querySelector('[data-demo-notice]');if(x)x.textContent='공개 UI 데모 · 실제 인증/DB 저장 없음 · 입력 데이터는 현재 브라우저에만 저장'}
function showMessage(msg,good=true){const el=document.getElementById('message');if(el){el.textContent=msg;el.className=good?'message good':'message bad'}else alert(msg)}
function downloadCsv(filename,rows){const out='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([out],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function openModal(title,content){const overlay=document.getElementById('modal');if(!overlay)return;document.getElementById('modalTitle').textContent=title;document.getElementById('modalContent').innerHTML=content;overlay.hidden=false;overlay.querySelector('[data-close]').onclick=closeModal;overlay.onclick=e=>{if(e.target===overlay)closeModal()};const focus=overlay.querySelector('input,select,button');focus?.focus()}
function closeModal(){const x=document.getElementById('modal');if(x)x.hidden=true}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
const root=document.body.dataset.page;if(root&&root!=='login')nav();mark();
window.KLAB={get data(){return state},save,reset,seed:()=>clone(seed),id,esc,money,compact,partyName,paid,remaining,status,month,auth,nav,showMessage,downloadCsv,openModal,closeModal,login:()=>{sessionStorage.setItem(AUTH,'demo')},logout:()=>sessionStorage.removeItem(AUTH),get users(){return state.users}};
})();
