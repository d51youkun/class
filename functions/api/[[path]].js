// ===== 設定(ここに直接書く)。リポジトリは必ず Private にすること =====
const CONFIG = {
  PASSWORD: "6-2",
  TEACHER_EMAIL: "ここに先生のメールアドレス",
  FROM_EMAIL: "onboarding@resend.dev",
  RESEND_API_KEY: "ここにResendのAPIキー"   // メールを使わないなら空のままでOK
};
// ================================================================
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json'}});
export async function onRequest({request,env}){
  if(!env.STORE)return J({error:'kv'},500);
  const C={PASSWORD:env.APP_PASSWORD||CONFIG.PASSWORD,TEACHER:env.TEACHER_EMAIL||CONFIG.TEACHER_EMAIL,FROM:env.FROM_EMAIL||CONFIG.FROM_EMAIL,KEY:env.RESEND_API_KEY||CONFIG.RESEND_API_KEY};
  const load=async()=>JSON.parse(await env.STORE.get('state')||'{"items":[]}');
  if(request.method==='GET')return J(await load());
  if(request.method!=='POST')return J({},405);
  const b=await request.json();
  if(b.pass!==C.PASSWORD)return J({error:'pw'},401);
  const s=await load(),it=s.items.find(x=>x.id===b.id);
  if(b.op==='add')s.items.unshift({id:crypto.randomUUID(),type:b.type,title:String(b.title).slice(0,60),assigned:b.assigned||'',due:b.due||'',checks:{},notified:false});
  if(b.op==='del')s.items=s.items.filter(x=>x.id!==b.id);
  if(b.op==='check'&&it){if(b.v)it.checks[b.no]=1;else delete it.checks[b.no];}
  if(b.op==='notify'&&it){
    const text=`【${it.title}】未完了(${b.names.length}人)\n`+b.names.join('\n');
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+C.KEY,'content-type':'application/json'},
      body:JSON.stringify({from:C.FROM,to:[C.TEACHER],subject:`[6年2組] ${it.title} 未完了者`,text})});
    if(!r.ok)return J({error:'mail'},502);
    it.notified=true;
  }
  await env.STORE.put('state',JSON.stringify(s));
  return J(s);
}
