/**
 * Rule the words! KKuTu Online
 * Copyright (C) 2017 JJoriping(op@jjo.kr)
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

var File	 = require("fs");
var MainDB	 = require("../db");
var GLOBAL	 = require("../../sub/global.json");
var JLog	 = require("../../sub/jjlog");
var Lizard	 = require("../../sub/lizard.js");

exports.run = function(Server, page){

Server.get("/gwalli", function(req, res){
	if(!checkAdmin(req, res)) return;
	
	req.session.admin = true;
	page(req, res, "gwalli");
});
Server.get("/gwalli/injeong", function(req, res){
	if(!checkAdmin(req, res)) return;
	
	MainDB.kkutu_injeong.find([ 'theme', { $not: "~" } ]).limit(100).on(function($list){
		res.send({ list: $list });
	});
});
Server.get("/gwalli/gamsi", function(req, res){
	if(!checkAdmin(req, res)) return;
	
	MainDB.users.findOne([ '_id', req.query.id ]).limit([ 'server', true ]).on(function($u){
		if(!$u) return res.sendStatus(404);
		var data = { _id: $u._id, server: $u.server };
		
		MainDB.session.findOne([ 'profile.id', $u._id ]).limit([ 'profile', true ]).on(function($s){
			if($s) data.title = $s.profile.title || $s.profile.name;
			res.send(data);
		});
	});
});
Server.get("/gwalli/users", function(req, res){
	if(!checkAdmin(req, res)) return;
	
	if(req.query.name){
		MainDB.session.find([ 'profile.title', req.query.name ]).on(function($u){
			if($u) return onSession($u);
			MainDB.session.find([ 'profile.name', req.query.name ]).on(function($u){
				if($u) return onSession($u);
				res.sendStatus(404);
			});
		});
	}else{
		MainDB.users.findOne([ '_id', req.query.id ]).on(function($u){
			if($u) return res.send({ list: [ $u ] });
			res.sendStatus(404);
		});
	}
	function onSession(list){
		var board = {};
		
		Lizard.all(list.map(function(v){
			if(board[v.profile.id]) return null;
			else{
				board[v.profile.id] = true;
				return getProfile(v.profile.id);
			}
		})).then(function(data){
			res.send({ list: data });
		});
	}
	function getProfile(id){
		var R = new Lizard.Tail();
		
		if(id) MainDB.users.findOne([ '_id', id ]).on(function($u){
			R.go($u);
		}); else R.go(null);
		return R;
	}
});
Server.get("/gwalli/kkutudb/:word", function(req, res){
	if(!checkAdmin(req, res)) return;
	
	var TABLE = MainDB.kkutu[req.query.lang];
	
	if(!TABLE) return res.sendStatus(400);
	if(!TABLE.findOne) return res.sendStatus(400);
	TABLE.findOne([ '_id', req.params.word ]).on(function($doc){
		res.send($doc);
	});
});
Server.get("/gwalli/kkututheme", function(req, res){
	if(!checkAdmin(req, res)) return;
	
	var TABLE = MainDB.kkutu[req.query.lang];
	
	if(!TABLE) return res.sendStatus(400);
	if(!TABLE.find) return res.sendStatus(400);
	TABLE.find([ 'theme', new RegExp(req.query.theme) ]).limit([ '_id', true ]).on(function($docs){
		res.send({ list: $docs.map(v => v._id) });
	});
});
Server.get("/gwalli/kkutuhot", function(req, res){
	if(!checkAdmin(req, res)) return;
	
	File.readFile(GLOBAL.KKUTUHOT_PATH, function(err, file){
		var data = JSON.parse(file.toString());
		
		parseKKuTuHot().then(function($kh){
			res.send({ prev: data, data: $kh });
		});
	});
});
Server.get("/gwalli/shop/:key", function(req, res){
	if(!checkAdmin(req, res)) return;
	
	var q = (req.params.key == "~ALL") ? undefined : [ '_id', req.params.key ];
	
	MainDB.kkutu_shop.find(q).on(function($docs){
		MainDB.kkutu_shop_desc.find(q).on(function($desc){
			res.send({ goods: $docs, desc: $desc });
		});
	});
});
Server.post("/gwalli/injeong", function(req, res){
	if(!checkAdmin(req, res)) return;
	if(req.body.pw != GLOBAL.PASS) return res.sendStatus(400);
	
	var list = JSON.parse(req.body.list).list;
	var themes;
	
	list.forEach(function(v){
		if(v.ok){
			req.body.nof = true;
			req.body.lang = "ko";
			v.theme.split(',').forEach(function(w, i){
				setTimeout(function(lid, x){
					req.body.list = lid;
					req.body.theme = x;
					onKKuTuDB(req, res);
				}, i * 1000, v._id.replace(/[^가-힣0-9]/g, ""), w);
			});
		}else{
			MainDB.kkutu_injeong.update([ '_id', v._origin ]).set([ 'theme', "~" ]).on();
		}
		// MainDB.kkutu_injeong.remove([ '_id', v._origin ]).on();
	});
	res.sendStatus(200);
});
Server.post("/gwalli/kkutudb", onKKuTuDB);
function onKKuTuDB(req, res){
	if(!checkAdmin(req, res)) return;
	if(req.body.pw != GLOBAL.PASS) return res.sendStatus(400);
	
	var theme = req.body.theme;
	var list = req.body.list;
	var TABLE = MainDB.kkutu[req.body.lang];
	
	if(list) list = list.split(/[,\r\n]+/);
	else return res.sendStatus(400);
	if(!TABLE) return res.sendStatus(400);
	if(!TABLE.insert) return res.sendStatus(400);
	
	noticeAdmin(req, theme, list.length);
	list.forEach(function(item){
		if(!item) return;
		item = item.trim();
		if(!item.length) return;
		TABLE.findOne([ '_id', item ]).on(function($doc){
			if(!$doc) return TABLE.insert([ '_id', item ], [ 'type', "INJEONG" ], [ 'theme', theme ], [ 'mean', "＂1＂" ], [ 'flag', 2 ]).on();
			var means = $doc.mean.split(/＂[0-9]+＂/g).slice(1);
			var len = means.length;
			
			if($doc.theme.indexOf(theme) == -1){
				$doc.type += ",INJEONG";
				$doc.theme += "," + theme;
				$doc.mean += `＂${len+1}＂`;
				TABLE.update([ '_id', item ]).set([ 'type', $doc.type ], [ 'theme', $doc.theme ], [ 'mean', $doc.mean ]).on();
			}else{
				JLog.warn(`Word '${item}' already has the theme '${theme}'!`);
			}
		});
	});
	if(!req.body.nof) res.sendStatus(200);
}
Server.post("/gwalli/kkutudb/:word", function(req, res){
	if(!checkAdmin(req, res)) return;
	if(req.body.pw != GLOBAL.PASS) return res.sendStatus(400);
	var TABLE = MainDB.kkutu[req.body.lang];
	var data = JSON.parse(req.body.data);
	
	if(!TABLE) return res.sendStatus(400);
	if(!TABLE.upsert) return res.sendStatus(400);
	
	noticeAdmin(req, data._id);
	if(data.mean == ""){
		TABLE.remove([ '_id', data._id ]).on(function($res){
			res.send($res.toString());
		});
	}else{
		TABLE.upsert([ '_id', data._id ]).set([ 'flag', data.flag ], [ 'type', data.type ], [ 'theme', data.theme ], [ 'mean', data.mean ]).on(function($res){
			res.send($res.toString());
		});
	}
});
Server.post("/gwalli/kkutuhot", function(req, res){
	if(!checkAdmin(req, res)) return;
	if(req.body.pw != GLOBAL.PASS) return res.sendStatus(400);
	
	noticeAdmin(req);
	parseKKuTuHot().then(function($kh){
		var i, j, obj = {};
		
		for(i in $kh){
			for(j in $kh[i]){
				obj[$kh[i][j]._id] = $kh[i][j].hit;
			}
		}
		File.writeFile(GLOBAL.KKUTUHOT_PATH, JSON.stringify(obj), function(err){
			res.send(err);
		});
	});
});
Server.post("/gwalli/users", function(req, res){
	if(!checkAdmin(req, res)) return;
	if(req.body.pw != GLOBAL.PASS) return res.sendStatus(400);
	
	var list = JSON.parse(req.body.list).list;
	
	list.forEach(function(item){
		MainDB.users.upsert([ '_id', item._id ]).set(item).on();
	});
	res.sendStatus(200);
});
Server.post("/gwalli/shop", function(req, res){
	if(!checkAdmin(req, res)) return;
	if(req.body.pw != GLOBAL.PASS) return res.sendStatus(400);
	
	var list = JSON.parse(req.body.list).list;
	
	list.forEach(function(item){
		item.core.options = JSON.parse(item.core.options);
		MainDB.kkutu_shop.upsert([ '_id', item._id ]).set(item.core).on();
		MainDB.kkutu_shop_desc.upsert([ '_id', item._id ]).set(item.text).on();
	});
	res.sendStatus(200);
});


// YEON_WORD_MANAGER_V2_START
const YeonPG = require('pg').Pool;
const YeonPath = require('path');
const YeonWordPool = new YeonPG({host:GLOBAL.PG_HOST,port:GLOBAL.PG_PORT,user:GLOBAL.PG_USER,password:GLOBAL.PG_PASSWORD,database:GLOBAL.PG_DATABASE,max:3});
const yeonClean = value => String(value || '').trim();
const yeonWords = value => [...new Set(String(value||'').split(/[\r\n,]+/).map(v=>v.trim()).filter(Boolean))];
const yeonBackupDir = YeonPath.resolve(__dirname,'../../../word_delete_backups');
Server.post('/gwalli/yeon-words', async function(req,res){
  // Require the actual signed-in administrator even on a private server.
  if(!req.session || !req.session.profile || !GLOBAL.ADMIN.includes(req.session.profile.id)) return res.status(403).json({error:'ADMIN_LOGIN_REQUIRED'});
  // Administrator session authentication is required above.
  if(req.headers.origin){
    try { if(new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({error:'ORIGIN_MISMATCH'}); }
    catch(e){return res.status(403).json({error:'INVALID_ORIGIN'});}
  }
  const action=yeonClean(req.body.action), theme=yeonClean(req.body.theme).toUpperCase(), words=yeonWords(req.body.words);
  if(!/^[A-Z0-9]{2,8}$/.test(theme)) return res.status(400).json({error:'INVALID_THEME_CODE'});
  if(words.length>100 || words.some(w=>w.length>100 || /[\u0000-\u001f]/.test(w))) return res.status(400).json({error:'INVALID_WORD_LIST'});
  if(!['preview','preview-words','add','delete-theme','delete-words'].includes(action)) return res.status(400).json({error:'INVALID_ACTION'});
  if((action==='add'||action==='delete-words'||action==='preview-words') && !words.length) return res.status(400).json({error:'WORDS_REQUIRED'});
  const criteria="theme = $1 AND (flag & 2) <> 0";
  let client;
  try {
    client=await YeonWordPool.connect();
    if(action==='preview'||action==='preview-words'){
      const q=action==='preview' ? await client.query(`SELECT _id FROM public.kkutu_ko WHERE ${criteria} ORDER BY _id LIMIT 1001`,[theme]) : await client.query(`SELECT _id FROM public.kkutu_ko WHERE ${criteria} AND _id = ANY($2::text[]) ORDER BY _id`,[theme,words]);
      return res.json({count:q.rowCount,overLimit:q.rowCount>1000,words:q.rows.slice(0,100).map(r=>r._id)});
    }
    if(action==='add'){
      await client.query('BEGIN');
      const added=[], skipped=[];
      for(const word of words){
        const r=await client.query("INSERT INTO public.kkutu_ko (_id,type,theme,mean,flag,hit) VALUES ($1,'INJEONG',$2,'＂1＂',2,0) ON CONFLICT (_id) DO NOTHING RETURNING _id",[word,theme]);
        (r.rowCount?added:skipped).push(word);
      }
      await client.query('COMMIT');
      return res.json({added:added.length,skipped:skipped.length,skippedWords:skipped.slice(0,20)});
    }
    const deletingTheme=action==='delete-theme';
    if(deletingTheme && words.length) return res.status(400).json({error:'WORDS_NOT_ALLOWED_FOR_THEME_DELETE'});
    await client.query('BEGIN');
    // Serialize deletes for this tool, and verify the exact count under transaction.
    await client.query('SELECT pg_advisory_xact_lock(21024, 2002)');
    const q=deletingTheme
      ? await client.query(`SELECT * FROM public.kkutu_ko WHERE ${criteria} ORDER BY _id FOR UPDATE`,[theme])
      : await client.query(`SELECT * FROM public.kkutu_ko WHERE ${criteria} AND _id = ANY($2::text[]) ORDER BY _id FOR UPDATE`,[theme,words]);
    const count=q.rows.length, expected=Number(req.body.expected);
    if(count===0 || count>1000 || !Number.isInteger(expected) || expected!==count){await client.query('ROLLBACK');return res.status(409).json({error:'COUNT_MISMATCH_OR_LIMIT',actual:count});}
    if(yeonClean(req.body.confirm)!==`DELETE ${theme} ${count}`){await client.query('ROLLBACK');return res.status(400).json({error:'CONFIRM_REQUIRED'});}
    File.mkdirSync(yeonBackupDir,{recursive:true});
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const suffix=require('crypto').randomBytes(4).toString('hex');
    const filename=`yeon_${theme}_${count}_${stamp}_${suffix}.json`;
    const fullpath=YeonPath.join(yeonBackupDir,filename);
    File.writeFileSync(fullpath,JSON.stringify({theme,count,createdAt:new Date().toISOString(),rows:q.rows},null,2),{encoding:'utf8',flag:'wx',mode:0o600});
    const ids=q.rows.map(r=>r._id);
    const del=await client.query('DELETE FROM public.kkutu_ko WHERE _id = ANY($1::text[]) AND theme = $2 AND (flag & 2) <> 0 RETURNING _id',[ids,theme]);
    if(del.rowCount!==count){await client.query('ROLLBACK');return res.status(409).json({error:'CHANGED_DURING_DELETE'});}
    await client.query('COMMIT');
    return res.json({deleted:count,backup:filename});
  }catch(err){
    if(client)try{await client.query('ROLLBACK');}catch(e){}
    JLog.error('[YEON_WORD_MANAGER] '+err.message);
    return res.status(500).json({error:'SERVER_ERROR_CHECK_CONSOLE'});
  }finally{if(client)client.release();}
});
// YEON_WORD_MANAGER_V2_END

};
function noticeAdmin(req, ...args){
	JLog.info(`[ADMIN] ${req.originalUrl} ${req.ip} | ${args.join(' | ')}`);
}
function checkAdmin(req, res){
	if(global.isPublic){
		if(req.session.profile){
			if(GLOBAL.ADMIN.indexOf(req.session.profile.id) == -1){
				req.session.admin = false;
				return res.send({ error: 400 }), false;
			}
		}else{
			req.session.admin = false;
			return res.send({ error: 400 }), false;
		}
	}
	return true;
}
function parseKKuTuHot(){
	var R = new Lizard.Tail();
		
	Lizard.all([
		query(`SELECT * FROM kkutu_ko WHERE hit > 0 ORDER BY hit DESC LIMIT 50`),
		query(`SELECT * FROM kkutu_ko WHERE _id ~ '^...$' AND hit > 0 ORDER BY hit DESC LIMIT 50`),
		query(`SELECT * FROM kkutu_ko WHERE type = 'INJEONG' AND hit > 0 ORDER BY hit DESC LIMIT 50`),
		query(`SELECT * FROM kkutu_en WHERE hit > 0 ORDER BY hit DESC LIMIT 50`)
	]).then(function($docs){
		R.go($docs);
	});
	function query(q){
		var R = new Lizard.Tail();
		
		MainDB.kkutu['ko'].direct(q, function(err, $docs){
			if(err) return JLog.error(err.toString());
			R.go($docs.rows);
		});
		return R;
	}
	return R;
}