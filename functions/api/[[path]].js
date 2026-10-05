// ===== 設定(ここに直接書く)。リポジトリは必ず Private にすること =====
const CONFIG = {
  PASSWORD: "6-2",
  TEACHER_PASSWORD: "6-2T",
  // ▼ 先生への通知は BlueTalk のみ(メール機能は廃止)
  BLUETALK_SYNC: "https://bluechat-sync.by-youhei.workers.dev",
  BLUETALK_TEACHER: "",              // ← 先生のBlueTalk ユーザーIDを貼ると通知が届く
  BLUETALK_BOT: "classapp6-2bot",    // 通知を送るボットのID
  BLUETALK_TOKEN: ""                 // syncサーバーで認証を有効化している時だけ
};
// ================================================================
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json'}});
export async function onRequest({request,env}){
  if(!env.STORE)return J({error:'kv'},500);
  const C={PASSWORD:env.APP_PASSWORD||CONFIG.PASSWORD,TEACHER_PASSWORD:env.TEACHER_PASSWORD||CONFIG.TEACHER_PASSWORD,BTS:env.BLUETALK_SYNC||CONFIG.BLUETALK_SYNC,BTT:env.BLUETALK_TEACHER||CONFIG.BLUETALK_TEACHER,BTB:env.BLUETALK_BOT||CONFIG.BLUETALK_BOT,BTTOK:env.BLUETALK_TOKEN||CONFIG.BLUETALK_TOKEN};
  const load=async()=>JSON.parse(await env.STORE.get('state')||'{"items":[]}');
  if(request.method==='GET')return J(await load());
  if(request.method!=='POST')return J({},405);
  const b=await request.json();
  const isTeacher=b.pass===C.TEACHER_PASSWORD;
  if(b.pass!==C.PASSWORD&&!isTeacher)return J({error:'pw'},401);
  const s=await load(),it=s.items.find(x=>x.id===b.id);
  if(b.op==='add')s.items.unshift({id:crypto.randomUUID(),type:b.type,title:String(b.title).slice(0,60),assigned:b.assigned||'',due:b.due||'',checks:{},solutions:{},notified:false});
  if(b.op==='del')s.items=s.items.filter(x=>x.id!==b.id);
  if(b.op==='check'&&it){if(b.v){it.checks[b.no]=1;if(it.solutions)delete it.solutions[b.no];}else delete it.checks[b.no];}
  if(b.op==='solve'&&it){it.solutions=it.solutions||{};const t=String(b.text||'').slice(0,120).trim();if(t)it.solutions[b.no]=t;else delete it.solutions[b.no];}
  if((b.op==='archive'||b.op==='restore'||b.op==='import')&&!isTeacher)return J({error:'teacher'},403);
  if(b.op==='archive'&&it)it.archived=Date.now();
  if(b.op==='restore'&&it)delete it.archived;
  if(b.op==='import'&&Array.isArray(b.data&&b.data.items))s.items=b.data.items.slice(0,500);
  if(b.op==='notify'&&it){
    const text=`【${it.title}】未完了(${b.names.length}人)\n`+b.names.join('\n');
    if(!C.BTS||!C.BTT)return J({error:'bt'},502);
    const convId='classapp-'+C.BTT,h={'content-type':'application/json'};
    if(C.BTTOK)h.Authorization='Bearer '+C.BTTOK;
    try{
      const c=await fetch(C.BTS+'/api/conversations/'+convId,{method:'PUT',headers:h,body:JSON.stringify({id:convId,name:'📚 6年2組 提出チェック',members:[C.BTT,C.BTB],updatedAt:Date.now()})});
      const m=await fetch(C.BTS+'/api/messages/'+convId+'/'+crypto.randomUUID(),{method:'PUT',headers:h,body:JSON.stringify({senderId:C.BTB,type:'text',text,ts:Date.now()})});
      if(!c.ok||!m.ok)return J({error:'bt'},502);
    }catch(e){return J({error:'bt'},502)}
    it.notified=true;it.via='bluetalk';
  }
  if(b.op!=='ping'){
    s.rev=(s.rev||0)+1;
    if(b.op==='check'&&it)s.lastEvent={t:'check',title:it.title,no:b.no,ts:Date.now()};
    if(b.op==='solve'&&it)s.lastEvent={t:'solve',title:it.title,no:b.no,ts:Date.now()};
    if(b.op==='add'&&s.items[0])s.lastEvent={t:'add',title:s.items[0].title,ts:Date.now()};
    if(b.op==='notify'&&it&&it.notified)s.lastEvent={t:'notify',title:it.title,ts:Date.now()};
    await env.STORE.put('state',JSON.stringify(s));
  }
  return J({...s,isTeacher});
}
