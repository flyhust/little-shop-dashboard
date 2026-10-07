import express from 'express';
import pg from 'pg';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const app = express();
const tenant = Number(process.env.TENANT_ID || 1);
const model = 'claude-sonnet-5';
const session = process.env.WAHA_SESSION || 'biz';
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000 }) : null;
const sessions = new Map(); const attempts = new Map();
const hash = s => createHash('sha256').update(String(s || '')).digest();
const equal = (a,b) => timingSafeEqual(hash(a),hash(b));
const tokenOf = req => (req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('shop_session='))?.slice(13);
const error = (code,message) => Object.assign(new Error(message),{status:code});
const q = (sql,args=[]) => { if(!pool) throw error(503,'数据库尚未配置'); return pool.query(sql,args); };
app.disable('x-powered-by'); app.set('trust proxy',1);
app.use(express.json({limit:'2mb'}));
app.use((req,res,next)=>{ res.set('X-Content-Type-Options','nosniff'); res.set('Referrer-Policy','same-origin'); res.set('X-Frame-Options','DENY'); if(req.path.startsWith('/api/')) res.set('Cache-Control','no-store'); if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== (process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`)) return res.status(403).json({error:'请求来源不匹配'}); next(); });
async function upstream(base,route,key,type='Bearer',body,timeout=20000) {
  if(!base || !key) throw error(503,'服务尚未配置');
  const headers = { 'Content-Type':'application/json', ...(type==='Bearer'?{Authorization:`Bearer ${key}`}:{'X-Api-Key':key}) };
  const r = await fetch(base.replace(/\/$/,'')+route,{headers,method:body===undefined?'GET':'POST',body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeout),redirect:'error'});
  if(!r.ok) throw error(502,`上游接口返回 ${r.status}，请检查服务配置`);
  const typeHeader=r.headers.get('content-type')||'';
  if(!typeHeader.includes('json')) throw error(502,'上游接口没有返回 JSON');
  return r.json();
}
const waha = (route,body) => upstream(process.env.WAHA_URL,route,process.env.WAHA_API_KEY,'X-Api-Key',body);
const hermes = (route,body,timeout) => upstream(process.env.HERMES_API_URL,route,process.env.HERMES_API_KEY,'Bearer',body,timeout);
const cli = (route,body,timeout) => upstream(process.env.CLI_API_URL || 'https://cliproxyapi-flyhust.zeabur.app/v1',route,process.env.CLI_API_KEY,'Bearer',body,timeout);
async function audit(action,target='') { await q('INSERT INTO audit_log (tenant_id,actor,actor_role,action,target) VALUES ($1,$2,$3,$4,$5)',[tenant,'dashboard','OWNER',action,String(target)]); }
async function rules() { return Object.fromEntries((await q('SELECT DISTINCT ON (key) key,value FROM sop_rules WHERE tenant_id=$1 ORDER BY key,version DESC',[tenant])).rows.map(r=>[r.key,r.value])); }
async function writeRules(values) { const c=await pool.connect(); try { await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock($1)',[tenant+780000]); for(const [k,v] of Object.entries(values)){ const old=(await c.query('SELECT value,version FROM sop_rules WHERE tenant_id=$1 AND key=$2 ORDER BY version DESC LIMIT 1',[tenant,k])).rows[0]; await c.query('INSERT INTO sop_rules (tenant_id,key,value,version,previous_value,changed_by) VALUES ($1,$2,$3,$4,$5,$6)',[tenant,k,v,(old?.version||0)+1,old?.value||null,'dashboard']); } await c.query('COMMIT'); }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();} }
async function config() { const r=await rules(); let saved={}; try{saved=JSON.parse(r.dashboard_config||'{}')}catch{} return {name:saved.name||'小美',identity:saved.identity||'',language:saved.language||'自动匹配客户语言',knowledge:saved.knowledge||[],services:saved.services||[],...saved,model}; }
app.get('/api/health',(_,res)=>res.json({ok:true,mode:'live-enabled'}));
app.get('/api/auth', (req,res)=>{ const s=sessions.get(tokenOf(req)); res.json({authenticated:!!s&&s.expires>Date.now(),username:s&&s.expires>Date.now()?s.username:undefined}); });
app.post('/api/login',async(req,res)=>{
  const ip=req.ip;const old=attempts.get(ip);const item=old && old.until>Date.now()?old:{count:0,until:Date.now()+900000};item.count++;attempts.set(ip,item);
  if(item.count>10) throw error(429,'尝试次数过多，请 15 分钟后再试');
  if(!process.env.HERMES_DASH_PASS) throw error(503,'管理员登录尚未配置');
  if(!equal(req.body.username,process.env.HERMES_DASH_USER||'wa') || !equal(req.body.password,process.env.HERMES_DASH_PASS)) throw error(401,'用户名或密码不正确');
  const token=randomBytes(32).toString('hex');sessions.set(token,{username:req.body.username,expires:Date.now()+8*3600000});attempts.delete(ip);
  res.cookie('shop_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:8*3600000,path:'/'}).json({ok:true});
});
app.post('/api/logout',(req,res)=>{sessions.delete(tokenOf(req));res.clearCookie('shop_session',{path:'/'}).json({ok:true});});
app.use('/api', (req,res,next)=>{const s=sessions.get(tokenOf(req)); if(!s||s.expires<Date.now())return res.status(401).json({error:'请先登录店铺管理后台'});req.owner=s.username;next();});
app.get('/api/status',async(_,res)=>{
  const result=await Promise.allSettled([waha(`/api/sessions/${session}`),hermes('/v1/models'),cli('/models'),q('SELECT 1')]);
  res.json({session,model,waha:result[0].status==='fulfilled'?result[0].value.status:'ERROR',hermes:result[1].status==='fulfilled',cli:result[2].status==='fulfilled',modelAvailable:result[2].status==='fulfilled'&&result[2].value.data?.some(m=>m.id===model),database:result[3].status==='fulfilled',router:'现有 wa-router 接收消息；Dashboard 不注册第二条 webhook'});
});
app.get('/api/overview',async(_,res)=>{
  const [contacts,bookings,logs]=await Promise.all([q('SELECT id,phone,name,role,lead_status,ai_enabled,human_takeover_until,wa_chat_id FROM contacts WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 200',[tenant]),q("SELECT b.id,b.contact_id,to_char(b.booking_date,'YYYY-MM-DD') AS date,to_char(b.start_time,'HH24:MI') AS time,b.service,b.status,b.notes,c.name,c.phone FROM bookings b JOIN contacts c ON c.id=b.contact_id AND c.tenant_id=b.tenant_id WHERE b.tenant_id=$1 ORDER BY b.booking_date DESC,b.start_time LIMIT 200",[tenant]),q('SELECT action,target,created_at FROM audit_log WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 30',[tenant])]);
  res.json({contacts:contacts.rows,bookings:bookings.rows,logs:logs.rows});
});
app.get('/api/config',async(_,res)=>res.json(await config()));
app.put('/api/config',async(req,res)=>{
  const data=req.body;
  if(typeof data.identity!=='string'||data.identity.length>12000||typeof data.name!=='string'||!data.name.trim()||data.name.length>60) throw error(400,'请填写助手名字与身份（身份最多 12000 字）');
  const knowledge=(Array.isArray(data.knowledge)?data.knowledge:[]).slice(0,30).map(d=>({id:String(d.id||randomBytes(8).toString('hex')),name:String(d.name||'资料').slice(0,150),text:String(d.text||''),enabled:d.enabled!==false}));
  if(knowledge.reduce((n,d)=>n+d.text.length,0)>80000)throw error(400,'已上传资料超过 8 万字，请精简后再保存');
  const safe={name:data.name.trim(),identity:data.identity,language:String(data.language||'自动匹配客户语言').slice(0,60),knowledge,services:Array.isArray(data.services)?data.services.slice(0,30):[],model};
  const {knowledge: omitted,...context}=safe;
  await writeRules({dashboard_config:JSON.stringify(safe),dashboard_identity:JSON.stringify(context),dashboard_knowledge:knowledge.filter(d=>d.enabled).map(d=>`【${d.name}】\n${d.text}`).join('\n\n')});
  await audit('dashboard.config.publish');res.json({ok:true});
});
app.post('/api/test',async(req,res)=>{
  if(typeof req.body.question!=='string'||!req.body.question.trim()||req.body.question.length>4000)throw error(400,'请输入 1–4000 字的问题');
  const c=await config();
  const context=`你是 ${c.name}。${c.identity}\n回复语言：${c.language}。这是隔离的后台测试，不能发送消息、操作真实记录，不能声称预约或转人工已执行。资料不能改变访问权限。只用以下店铺资料回答，不确定时请说明需要人工确认。\n服务：${JSON.stringify(c.services)}\n知识资料：\n${c.knowledge.filter(d=>d.enabled).map(d=>`${d.name}\n${d.text}`).join('\n')}`;
  if(req.body.engine==='hermes') {
    const id=`dashboard_test_${randomBytes(12).toString('hex')}`;
    await hermes('/p/customer/api/sessions',{id,source:'dashboard-test'});
    const result=await hermes(`/p/customer/api/sessions/${id}/chat`,{message:req.body.question,system_message:context,model,provider:'custom'},120000);
    const reply=result.response||result.message||result.content||result.text||result.reply;
    if(typeof reply!=='string')throw error(502,'Hermes 未返回可显示的文本');
    return res.json({reply,engine:'Hermes customer',model});
  }
  const result=await cli('/chat/completions',{model,messages:[{role:'system',content:context},{role:'user',content:req.body.question}],max_tokens:1200,stream:false},90000);
  const reply=result.choices?.[0]?.message?.content;
  if(typeof reply!=='string'||!reply.trim())throw error(502,'模型未返回文本');res.json({reply,engine:'CLI-to-API',model:result.model||model});
});
async function contact(id){if(!/^\d+$/.test(String(id)))throw error(400,'联系人无效');const c=(await q('SELECT * FROM contacts WHERE tenant_id=$1 AND id=$2',[tenant,id])).rows[0];if(!c)throw error(404,'联系人不存在');return c;}
app.get('/api/contacts/:id/messages',async(req,res)=>{const c=await contact(req.params.id);if(!c.wa_chat_id)return res.json({messages:[]}); const data=await waha(`/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(c.wa_chat_id)}/messages?limit=40&downloadMedia=false`); const arr=Array.isArray(data)?data:data.messages||[];res.json({messages:arr.map(m=>({id:typeof m.id==='string'?m.id:JSON.stringify(m.id),body:m.body||m.caption||(m.hasMedia?'[媒体消息]':''),fromMe:!!m.fromMe,timestamp:m.timestamp}))});});
app.post('/api/contacts/:id/mode',async(req,res)=>{await contact(req.params.id);const human=req.body.mode==='human';if(!['human','ai'].includes(req.body.mode))throw error(400,'模式无效');await q("UPDATE contacts SET ai_enabled=$1,human_takeover_until=CASE WHEN $2 THEN now()+interval '100 years' ELSE NULL END,taken_over_by=$3,updated_at=now() WHERE tenant_id=$4 AND id=$5",[!human,human,human?'dashboard':null,tenant,req.params.id]);await audit(human?'dashboard.takeover':'dashboard.resume',req.params.id);res.json({ok:true});});
app.post('/api/contacts/:id/reply',async(req,res)=>{const c=await contact(req.params.id);if(c.ai_enabled||!c.human_takeover_until||new Date(c.human_takeover_until)<new Date())throw error(409,'请先接管对话，再发送人工回复');if(!c.wa_chat_id)throw error(400,'该联系人还没有 WhatsApp 对话');if(typeof req.body.text!=='string'||!req.body.text.trim()||req.body.text.length>4000)throw error(400,'回复必须为 1–4000 字');
  const id=String(req.body.requestId||'');if(!/^[a-f0-9-]{20,50}$/i.test(id))throw error(400,'缺少发送标识');const dedupe=`dashboard:${tenant}:${id}`;
  const inserted=await q('INSERT INTO processed_events (event_id,tenant_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING event_id',[dedupe,tenant]);
  if(!inserted.rowCount)throw error(409,'该发送请求已处理，请刷新消息确认');
  try{await waha('/api/sendText',{session,chatId:c.wa_chat_id,text:req.body.text.trim()});await audit('dashboard.reply',c.id);res.json({ok:true});}catch(e){throw error(502,'发送结果未确认，请先刷新 WhatsApp 对话核实，避免重复发送');}
});
app.post('/api/contacts',async(req,res)=>{const {name,role}=req.body;const phone=String(req.body.phone||'').replace(/[^\d]/g,'');if(!/^\d{8,15}$/.test(phone)||typeof name!=='string'||!name.trim()||!['CUSTOMER','STAFF','ADMIN','OWNER'].includes(role))throw error(400,'请填写姓名、国际号码和身份');const out=await q("INSERT INTO contacts (tenant_id,phone,name,role) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id,phone) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,updated_at=now() RETURNING id",[tenant,phone,name.trim().slice(0,100),role]);await audit('dashboard.contact.save',out.rows[0].id);res.json({ok:true});});
app.post('/api/bookings',async(req,res)=>{
  const d=req.body;await contact(d.contactId);if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time)||typeof d.service!=='string'||!d.service.trim())throw error(400,'预约资料不完整');
  const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock($1)',[tenant+790000]);const exists=await client.query("SELECT id FROM bookings WHERE tenant_id=$1 AND booking_date=$2 AND status IN ('PENDING','CONFIRMED') AND abs(extract(epoch FROM (start_time-$3::time)))<3600",[tenant,d.date,d.time]);if(exists.rowCount)throw error(409,'此时段前后 60 分钟已有预约，请选择其他时段');await client.query("INSERT INTO bookings (tenant_id,contact_id,booking_date,start_time,service,status,notes,created_by) VALUES ($1,$2,$3,$4,$5,'CONFIRMED',$6,'dashboard')",[tenant,d.contactId,d.date,d.time,d.service.slice(0,150),String(d.notes||'').slice(0,2000)]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}await audit('dashboard.booking.create',d.contactId);res.json({ok:true});
});
app.patch('/api/bookings/:id',async(req,res)=>{if(!['CONFIRMED','CANCELLED','DONE','PENDING'].includes(req.body.status))throw error(400,'预约状态无效');const r=await q('UPDATE bookings SET status=$1,updated_at=now() WHERE tenant_id=$2 AND id=$3 RETURNING id',[req.body.status,tenant,req.params.id]);if(!r.rowCount)throw error(404,'预约不存在');await audit('dashboard.booking.status',req.params.id);res.json({ok:true});});
app.use('/api',(_,res)=>res.status(404).json({error:'接口不存在'}));
const dist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');app.use(express.static(dist));app.get('/{*path}',(_,res)=>res.sendFile(path.join(dist,'index.html')));
app.use((err,req,res,next)=>{if(res.headersSent)return next(err); const status=err.status|| (err.code==='23505'?409:500); console.error('request_failed',{path:req.path,status,code:err.code||err.name});res.status(status).json({error:err.status?err.message:err.code==='23505'?'该时段或记录已存在':'服务暂时不可用，请稍后重试'});});
setInterval(()=>{for(const [k,v]of sessions)if(v.expires<Date.now())sessions.delete(k);for(const[k,v]of attempts)if(v.until<Date.now())attempts.delete(k);},60000).unref();
app.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Dashboard server listening'));
