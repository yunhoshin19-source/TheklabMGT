
document.getElementById('loginForm').addEventListener('submit',async e=>{
e.preventDefault();const b=document.getElementById('submit'),m=document.getElementById('message');b.disabled=true;m.textContent='';
try{const r=await fetch('/api/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value,password:document.getElementById('password').value})});const d=await r.json();if(!r.ok)throw Error(d.error||'로그인 실패');location.replace('/dashboard.html')}catch(e){m.textContent=e.message||'로그인할 수 없습니다.'}finally{b.disabled=false}
});