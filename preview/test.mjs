import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const here=new URL('.',import.meta.url);
const pages=['index','dashboard','parties','contracts','vouchers','tax','reports','users'];
for(const page of pages){
 const file=new URL('./'+page+'.html',here),html=readFileSync(file,'utf8');
 assert.match(html,/<html lang="ko">/);
 assert.match(html,/\.\/demo\.css/);
 assert.match(html,/\.\/demo\.js/);
 assert.match(html,new RegExp('\\.\\/pages/'+(page==='index'?'login':page)+'\\.js'));
 assert.ok(existsSync(new URL('./pages/'+(page==='index'?'login':page)+'.js',here)),page+' missing script');
 if(page==='index'){assert.match(html,/데모 로그인/);assert.doesNotMatch(html,/\/api\/login/)}
 console.log('PASS preview page:',page);
}
console.log('PASS all independent preview HTML and dependencies');
