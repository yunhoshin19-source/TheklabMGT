/* THE KLAB shared navigation and accessibility, no auth credentials stored here. */
(function(){
'use strict';
const page=document.body.dataset.page;
if(!page)return;
const main=document.querySelector('main');
if(main&&!main.id)main.id='tl-main';
if(main){const skip=document.createElement('a');skip.className='tl-skip';skip.href='#'+main.id;skip.textContent='본문 바로가기';document.body.prepend(skip)}
if(page==='login')return;
const routes=[{key:'dashboard',href:'/dashboard.html',label:'대시보드',icon:'▦'},{key:'contracts',href:'/contracts.html',label:'계약·거래처',icon:'▤'},{key:'users',href:'/users.html',label:'사용자관리',icon:'♙'},{key:'reports',href:'/index.html#report-panel',label:'손익·보고서',icon:'▥'}];
const nav=document.createElement('nav');nav.className='tl-mobile-nav';nav.setAttribute('aria-label','모바일 주요 메뉴');
for(const item of routes){const a=document.createElement('a');a.href=item.href;if(item.key===page)a.setAttribute('aria-current','page');const icon=document.createElement('span');icon.className='tl-icon';icon.setAttribute('aria-hidden','true');icon.textContent=item.icon;const label=document.createElement('span');label.textContent=item.label;a.append(icon,label);nav.append(a)}
document.body.append(nav);
if(page==='contracts'||page==='users'){
 const links=document.createElement('nav');links.className='tl-page-links';links.setAttribute('aria-label','페이지 이동');
 for(const item of routes.filter(i=>i.key!=='reports')){
  const a=document.createElement('a');a.href=item.href;a.textContent=item.label;if(item.key===page)a.setAttribute('aria-current','page');links.append(a)
 }
 const target=page==='contracts'?document.querySelector('.header .toolbar'):document.querySelector('.top > div:last-child');
 if(target)target.prepend(links);
}
// Only admins should see user administration. Authenticated backend still enforces privileges.
const userLinks=Array.from(document.querySelectorAll('a[href="/users.html"]'));
fetch('/api/me',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(!d||d.user?.role!=='admin'){userLinks.forEach(a=>a.remove())}}).catch(()=>userLinks.forEach(a=>a.remove()));
})();
