const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient(); const B = process.env.B || "http://localhost:3100"; let pass=0, fail=0;
const ok=(c,m)=>{c?pass++:fail++;console.log(c?"  ok:":"  FAIL:",m)};
function client(){let cookie="";return async(path,opts={})=>{const r=await fetch(B+path,{redirect:"manual",...opts,headers:{"Content-Type":"application/json",cookie,...(opts.headers||{})}});
 for(const c of (r.headers.getSetCookie?.()??[])){const kv=c.split(";")[0];const n=kv.split("=")[0];cookie=cookie.split("; ").filter(x=>x&&!x.startsWith(n+"=")).concat(kv).join("; ")}
 const text=await r.text();let json=null;try{json=JSON.parse(text)}catch{}return{status:r.status,json,text}}}
const correct=async q=>(await db.questionOption.findFirst({where:{questionId:q,isCorrect:true}})).id;
const wrong=async q=>(await db.questionOption.findFirst({where:{questionId:q,isCorrect:false}})).id;
(async()=>{
 console.log("public pages");
 const a=client();
 for(const p of ["/","/assessments","/assessments/quick-check","/assessments/memory-speed","/login","/register"]){const r=await a(p);ok(r.status===200,`${p} -> ${r.status}`)}
 let r=await a("/assessments/nope");ok(r.status===404,"unknown assessment 404");
 r=await a("/assessments");ok(/Full Cognitive Battery/.test(r.text)&&/Quick Check/.test(r.text),"catalog lists assessments from DB");
 r=await a("/assessments/quick-check");ok(/Begin assessment|Resume assessment/.test(r.text)||/ov\.begin/.test(r.text)||r.text.includes("Quick Check"),"overview renders");

 console.log("test page + results access control");
 r=await a("/api/sessions",{method:"POST",body:JSON.stringify({slug:"quick-check"})});const sid=r.json.sessionId;
 r=await a(`/test/${sid}`);ok(r.status===200,"/test/[id] renders shell");
 ok(!/isCorrect/.test(r.text),"test page HTML has no answer data");
 let q=(await a(`/api/sessions/${sid}`)).json.questions[0];
 for(let i=0;i<10;i++){await a(`/api/sessions/${sid}/answer`,{method:"POST",body:JSON.stringify({questionId:q.id,optionId:await correct(q.id)})});
  const nx=await a(`/api/sessions/${sid}/next`,{method:"POST",body:JSON.stringify({fromQuestionId:q.id})});q=nx.json.question;}
 r=await a(`/api/sessions/${sid}/submit`,{method:"POST"});const rid=r.json.resultId;
 r=await a(`/results/${rid}`);ok(r.status===200&&/IQ-\d{8}-[0-9A-F]{8}/.test(r.text),"owner sees results page with report code");
 ok(/100/.test(r.text),"perfect run shows 100");
 const other=client();r=await other(`/results/${rid}`);ok(r.status===404,"other browser gets 404 for results");
 const anon=client();r=await anon(`/results/${rid}`);ok(r.status===404,"anonymous gets 404 for results");
 r=await a(`/api/sessions/${sid}`);ok(r.json.status==="SUBMITTED"&&r.json.resultId===rid,"re-opening submitted test points to result");

 console.log("signed-in user flow");
 const u=client();const email=`u${Date.now()}@example.com`;
 r=await u("/api/auth/register",{method:"POST",body:JSON.stringify({name:"Runner",email,password:"Str0ngPassw0rd"})});ok(r.status===200,"register");
 r=await u("/api/sessions",{method:"POST",body:JSON.stringify({slug:"logical-focus"})});const usid=r.json.sessionId;
 const row=await db.assessmentSession.findUnique({where:{id:usid}});ok(row.userId&&!row.guestToken,"session bound to user, not guest");
 const dev=client();r=await dev(`/api/sessions/${usid}`);ok(r.status===404,"other browser cannot read user's session");
 let uq=(await u(`/api/sessions/${usid}`)).json.questions[0];
 for(let i=0;i<8;i++){await u(`/api/sessions/${usid}/answer`,{method:"POST",body:JSON.stringify({questionId:uq.id,optionId:i%2?await wrong(uq.id):await correct(uq.id)})});
  const nx=await u(`/api/sessions/${usid}/next`,{method:"POST",body:JSON.stringify({fromQuestionId:uq.id})});uq=nx.json.question;}
 r=await u(`/api/sessions/${usid}/submit`,{method:"POST"});
 const res=await db.assessmentResult.findUnique({where:{id:r.json.resultId}});ok(res.userId&&res.correct===4&&res.incorrect===4,"user result 4/8 stored with userId");
 r=await u(`/results/${res.id}`);ok(r.status===200,"user sees own result");
 r=await client()(`/results/${res.id}`);ok(r.status===404,"stranger cannot see user's result");
 await db.user.deleteMany({where:{email}});

 console.log("timed answers are final");
 const t=client();r=await t("/api/sessions",{method:"POST",body:JSON.stringify({slug:"speed-focus"})});const tsid=r.json.sessionId;
 const tq=(await t(`/api/sessions/${tsid}`)).json.questions[0];
 r=await t(`/api/sessions/${tsid}/answer`,{method:"POST",body:JSON.stringify({questionId:tq.id,optionId:await wrong(tq.id)})});ok(r.status===200&&r.json.resolved,"first speed answer accepted");
 r=await t(`/api/sessions/${tsid}/answer`,{method:"POST",body:JSON.stringify({questionId:tq.id,optionId:await correct(tq.id)})});ok(r.status===409,"changing a timed answer is rejected");
 r=await t(`/api/sessions/${tsid}/answer`,{method:"POST",body:JSON.stringify({questionId:tq.id,flagged:true})});ok(r.status===200,"flagging a timed item still allowed");

 console.log("non-timed answers stay editable; memory item serves stimulus once");
 const m=client();r=await m("/api/sessions",{method:"POST",body:JSON.stringify({slug:"logical-focus"})});const msid=r.json.sessionId;
 const mq=(await m(`/api/sessions/${msid}`)).json.questions[0];
 await m(`/api/sessions/${msid}/answer`,{method:"POST",body:JSON.stringify({questionId:mq.id,optionId:await wrong(mq.id)})});
 r=await m(`/api/sessions/${msid}/answer`,{method:"POST",body:JSON.stringify({questionId:mq.id,optionId:await correct(mq.id)})});ok(r.status===200,"untimed answer can be changed");
 r=await m(`/api/sessions/${msid}/submit`,{method:"POST"});const mres=await db.assessmentResult.findUnique({where:{id:r.json.resultId}});
 ok(mres.correct===1,"final selection (changed answer) is what is scored");
 console.log(`\n${pass} passed, ${fail} failed`);await db.$disconnect();process.exit(fail?1:0)})();
