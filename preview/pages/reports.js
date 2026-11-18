const K=window.KLAB,$=id=>document.getElementById(id);let values={};
function draw(){const month=$('month').value,vs=K.data.vouchers.filter(v=>v.date.startsWith(month)&&v.status==='approved');const sum=t=>vs.filter(v=>v.type===t).reduce((s,v)=>s+Number(v.amount),0);
const bill=sum('billing'),expense=sum('expense'),income=sum('receipt'),payment=sum('payment'),due=K.data.schedules.filter(s=>s.date.startsWith(month)&&s.type==='receipt').reduce((s,x)=>s+K.remaining(x),0);
values={bill,expense,income,payment,due,profit:bill-expense,cash:income-payment};
$('kpis').innerHTML=[['청구 매출',bill],['매입·비용',expense],['관리손익',bill-expense],['실제 입금',income],['실제 지급',payment],['현금흐름',income-payment]].map(x=>'<article class="kpi"><small>'+x[0]+'</small><strong>'+K.money(x[1])+'</strong></article>').join('');
const put=(id,rows)=>{$(id).innerHTML=rows.map(x=>'<tr><th>'+x[0]+'</th><td>'+K.money(x[1])+'</td></tr>').join('')};
put('profitRows',[['확정 청구',bill],['확정 비용',expense],['관리손익',bill-expense]]);
put('cashRows',[['실제 입금',income],['실제 지급',payment],['순 현금흐름',income-payment]]);
put('openRows',[['해당 월 입금 예정 잔액',due]])}
$('month').value='2026-11';$('month').onchange=draw;$('csv').onclick=()=>K.downloadCsv('THEKLAB_손익_'+$('month').value+'.csv',[['항목','금액'],...Object.entries(values)]);draw();
