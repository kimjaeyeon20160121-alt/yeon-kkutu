'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DB = require('../db');
const GLOBAL = require('../../sub/global.json');
const ACCOUNT_FILE = path.join(__dirname, '..', '..', '..', 'sub', 'local_accounts.json');
const limits = new Map();
function esc(v) { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function getAccounts(){
  if (!fs.existsSync(ACCOUNT_FILE)) return {};
  const data = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}
function saveAccounts(data){
  const tmp = ACCOUNT_FILE + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), {encoding:'utf8',mode:0o600,flag:'wx'});
  fs.renameSync(tmp, ACCOUNT_FILE);
}
function hashPassword(p, salt){ return crypto.scryptSync(p, Buffer.from(salt, 'hex'), 64).toString('hex'); }
function page(type, message, csrf){
  const register = type === 'register';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>[연끄투] ${register?'회원가입':'로그인'}</title><style>body{background:#eff5ff;font-family:Arial,sans-serif;margin:0;color:#172945}.panel{max-width:380px;margin:8vh auto;background:white;border-radius:18px;padding:32px;box-shadow:0 6px 28px #b9c8df}h1{text-align:center;color:#2866b2}input,button{box-sizing:border-box;width:100%;padding:13px;margin:9px 0;font-size:16px;border-radius:8px}input{border:1px solid #bcc9d9}button{background:#2866b2;color:#fff;border:0;cursor:pointer}.msg{color:#b92332;white-space:pre-line}a{color:#2866b2}small{color:#667}nav{display:flex;justify-content:space-around}</style></head><body><div class="panel"><h1>연끄투</h1><p style="text-align:center">글자로 놀자! 끄투 온라인</p><nav><a href="/login">로그인</a><a href="/register">회원가입</a></nav><h2>${register?'회원가입':'로그인'}</h2>${message?'<p class="msg">'+esc(message)+'</p>':''}<form action="${register?'/register':'/local-login'}" method="post"><input type="hidden" name="_csrf" value="${esc(csrf)}"><label>아이디<input name="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" autocomplete="username" placeholder="영문·숫자·밑줄 3~20자"></label><label>비밀번호<input name="password" type="password" required minlength="8" maxlength="128" autocomplete="${register?'new-password':'current-password'}" placeholder="8자 이상"></label>${register?'<label>비밀번호 확인<input name="confirm" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label>':''}<button type="submit">${register?'회원가입':'로그인'}</button></form><small>비밀번호는 암호화 해시로 저장됩니다.</small><p><a href="/">메인 화면으로 돌아가기</a></p></div></body></html>`;
}
function csrf(req){if(!req.session.localCsrf)req.session.localCsrf=crypto.randomBytes(24).toString('hex');return req.session.localCsrf;}
function allowed(req){
  const key = req.ip || 'unknown', now = Date.now(), rec = limits.get(key) || {time:now,count:0};
  if(now-rec.time>15*60*1000){rec.time=now;rec.count=0;}
  ++rec.count; limits.set(key,rec); return rec.count<=30;
}
function equalHex(a,b){const x=Buffer.from(a,'hex'),y=Buffer.from(b,'hex');return x.length===y.length && crypto.timingSafeEqual(x,y);}
function response(res,type,msg,req,status){res.status(status||200).set('Content-Type','text/html; charset=utf-8').send(page(type,msg,csrf(req)));}
exports.run = function(Server){
  Server.get('/login', (req,res)=>response(res,'login','',req));
  Server.get('/register', (req,res)=>response(res,'register','',req));
  Server.post('/register', (req,res)=>{
    if(!allowed(req))return response(res,'register','잠시 후 다시 시도하세요.',req,429);
    if(!req.body || req.body._csrf !== req.session.localCsrf)return response(res,'register','다시 페이지를 열고 시도하세요.',req,403);
    const user=String(req.body.username||'').trim().toLowerCase(), pass=String(req.body.password||'');
    if(!/^[a-z0-9_]{3,20}$/.test(user) || pass.length<8 || pass.length>128 || pass!==req.body.confirm)return response(res,'register','아이디 또는 비밀번호를 확인하세요.',req,400);
    try{
      const accounts=getAccounts(); if(Object.prototype.hasOwnProperty.call(accounts,user)) return response(res,'register','이미 사용 중인 아이디입니다.',req,409);
      const salt=crypto.randomBytes(16).toString('hex');accounts[user]={salt: salt,hash: hashPassword(pass,salt),createdAt:Date.now()};
      saveAccounts(accounts);return res.redirect('/login');
    }catch(e){console.error('Registration failed:',e.message);return response(res,'register','계정 저장 실패. 서버 기록을 확인하세요.',req,500);}
  });
  Server.post('/local-login', (req,res)=>{
    if(!allowed(req))return response(res,'login','잠시 후 다시 시도하세요.',req,429);
    if(!req.body || req.body._csrf !== req.session.localCsrf)return response(res,'login','다시 페이지를 열고 시도하세요.',req,403);
    const user=String(req.body.username||'').trim().toLowerCase(),pass=String(req.body.password||'');
    let account;try{account=getAccounts()[user];}catch(e){return response(res,'login','계정 파일 읽기 오류.',req,500);}
    if(!account || !account.salt || !account.hash || !equalHex(hashPassword(pass,account.salt),account.hash))return response(res,'login','아이디 또는 비밀번호가 틀렸습니다.',req,401);
    req.session.regenerate(err=>{
      if(err)return response(res,'login','세션 생성 오류.',req,500);
      const now=Date.now(), id='local_'+user;
      const profile={id:id,title:user,sid:req.session.id,authType:'local',birth:[1,1,2000],_age:{min:20,max:undefined}};
      req.session.profile=profile;req.session.admin=Array.isArray(GLOBAL.ADMIN)&&GLOBAL.ADMIN.includes(id);
      DB.session.upsert(['_id',req.session.id]).set({'profile':profile,'createdAt':now}).on(function(){
        DB.users.upsert(['_id',id]).set(['lastLogin',now]).on(function(){
          req.session.save(()=>res.redirect('/'));
        });
      });
    });
  });
};
