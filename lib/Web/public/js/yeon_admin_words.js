(function(){
'use strict';
function el(id){return document.getElementById(id);}
var state={kind:null,theme:null,count:null,words:null};
function status(t){el('yeon-status').textContent=t;}
function words(){return [...new Set(el('yeon-words').value.split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean))];}
async function send(action, expected, confirm){
  var p=new URLSearchParams();
  p.set('action',action);p.set('theme',el('yeon-theme').value.trim().toUpperCase());
  p.set('words',words().join('\n'));p.set('pw',el('db-password').value);
  if(expected!==undefined)p.set('expected',String(expected));
  if(confirm!==undefined)p.set('confirm',confirm);
  var r=await fetch('/gwalli/yeon-words',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:p.toString()});
  var body=await r.json();if(!r.ok)throw new Error(body.error||'HTTP '+r.status);return body;
}
function reset(){state={kind:null,theme:null,count:null,words:null};el('yeon-confirm').value='';}
async function preview(kind){
  reset();
  try {
    var t=el('yeon-theme').value.trim().toUpperCase();
    var a=await send(kind==='words'?'preview-words':'preview');
    state={kind:kind,theme:t,count:a.count,words:words().join('\n')};
    el('yeon-preview-result').textContent='삭제 대상: '+a.count+'개'+(a.overLimit?' (1000개 초과: 삭제 불가)':'')+'\n'+a.words.join(', ');
    status('확인 문구: DELETE '+t+' '+a.count);
  } catch(e){reset();status('오류: '+e.message);}
}
async function deletion(kind){
  var t=el('yeon-theme').value.trim().toUpperCase();
  if(state.kind!==kind || state.theme!==t || state.words!==words().join('\n') || !state.count){return status('먼저 해당 삭제 대상을 미리보기로 확인하세요.');}
  if(el('yeon-confirm').value.trim()!=='DELETE '+t+' '+state.count)return status('확인 문구가 일치하지 않습니다.');
  if(!window.confirm(t+' 주제의 '+state.count+'개 단어를 백업한 뒤 삭제할까요?'))return;
  try {var result=await send(kind==='theme'?'delete-theme':'delete-words',state.count,el('yeon-confirm').value.trim());status('삭제 '+result.deleted+'개 완료. 서버 백업: '+result.backup);el('yeon-preview-result').textContent='완료';reset();}
  catch(e){status('오류: '+e.message);reset();}
}
document.addEventListener('DOMContentLoaded',function(){
 if(!el('yeon-word-manager'))return;
 el('yeon-add').onclick=async function(){try {var a=await send('add');status('추가 '+a.added+'개, 기존 단어 건너뜀 '+a.skipped+'개');reset();}catch(e){status('오류: '+e.message);}};
 el('yeon-preview').onclick=()=>preview('theme');
 el('yeon-check-words').onclick=()=>preview('words');
 el('yeon-delete-theme').onclick=()=>deletion('theme');
 el('yeon-delete-words').onclick=()=>deletion('words');
});
})();
