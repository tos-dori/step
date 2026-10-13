import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {getAuth,setPersistence,browserLocalPersistence,signInWithEmailAndPassword,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {getFirestore,doc,onSnapshot,runTransaction,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyCU6Yt9nnTwb9W7O3-FMGMy-BUYCh8pE80",authDomain:"step-sync-630a9.firebaseapp.com",projectId:"step-sync-630a9",storageBucket:"step-sync-630a9.firebasestorage.app",messagingSenderId:"717154851460",appId:"1:717154851460:web:04ecfa3dde532f7ae5c0d1"};
const api=window.StepV7App,auth=getAuth(initializeApp(firebaseConfig)),db=getFirestore();
const STORE="step_v7_live_v1",META="step_v7_syncmeta_v1";
const gate=document.querySelector("#syncGate"),conflictPanel=document.querySelector("#syncConflict"),syncEl=document.querySelector("#syncStatus");
let uid=null,ref=null,unsubscribe=null,ready=false,saving=false,issue="",conflict=null,timer=null,initialized=false;
let meta=load(META,{revision:0,remoteDigest:"",dirty:false}),remoteInfo=null;
function load(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
function recordMeta(){localStorage.setItem(META,JSON.stringify(meta))}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==="object"){let x={};for(const key of Object.keys(v).sort())if(v[key]!==undefined)x[key]=canonical(v[key]);return x}return v}
function digest(v){return JSON.stringify(canonical(v))}
function tinyHash(v){let a=2166136261,b=2246822519;for(const ch of digest(v)){const n=ch.charCodeAt(0);a=Math.imul(a^n,16777619);b=Math.imul(b^n,3266489917)}return (a>>>0).toString(16).padStart(8,"0")+(b>>>0).toString(16).padStart(8,"0")}
function good(v){return v&&Array.isArray(v.tasks)&&Array.isArray(v.groups)&&v.tasks.length<3000}
function hasTasks(x){return good(x)&&x.tasks.length>0}
function uidId(x){return String(x?.id||"").slice(0,120)}
function normalizeFromV6(v){
 const result={tasks:[],groups:[],activeId:null};
 if(!v||!Array.isArray(v.tasks))return result;
 const groupObjects=Array.isArray(v.groups)?v.groups:[];
 result.groups=[...new Set(groupObjects.map(g=>typeof g==="string"?g:String(g?.name||"")).filter(Boolean))];
 const groupById=new Map(groupObjects.map(g=>[String(g?.id||""),String(g?.name||"")]));
 result.tasks=v.tasks.filter(t=>t&&t.id).map(t=>{
  const legacy=Array.isArray(t.pieces);
  const completed=Math.max(0,Number(legacy?(t.pieces||[]).filter(p=>p.status&&p.status!=="pending").length:t.completed||0));
  const total=Math.max(1,Number(legacy?t.pieces.length:t.planned||1));
  const done=!!(t.done||t.doneShelf||t.finalized);
  const rawPhase=String(t.phase||"");
  const phase=done?"done":rawPhase==="await-next"?"choose":rawPhase==="await-final"||completed>=total?"final":rawPhase==="running"?"running":rawPhase==="paused"?"paused":completed>0?"paused":"idle";
  const rawGroup=legacy?t.groupId:t.group;
  const group=groupById.get(String(rawGroup))||String(rawGroup||"미분류");
  const resume=legacy?String(t.startText||""):String(t.resume||t.cue||"");
  return {id:uidId(t),title:String(t.title||"할 일"),group:group||"미분류",review:legacy?(t.groupId==="today"?today():""):String(t.review||t.touch||""),due:String(t.due||""),memo:String(legacy?t.memoText||"":t.memo||t.note||""),cue:resume,nextDraft:"",phase,doneSteps:Math.min(total,completed),total,checks:Array.isArray(t.checks)?t.checks.slice(0,3).map(Boolean):legacy?(t.pieces.find(p=>p.status==="pending")?.done||[false,false,false]).slice(0,3).map(Boolean):[false,false,false],done};
 });
 result.tasks.forEach(t=>{if(t.group!=="미분류"&&!result.groups.includes(t.group))result.groups.push(t.group)});
 result.activeId=result.tasks.some(t=>t.id===v.activeId&&!t.done)?v.activeId:null;
 return result;
}
function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function cloudWorkspace(raw){
 if(raw&&Object.prototype.hasOwnProperty.call(raw,"workspaceV7")){
  if(!good(raw.workspaceV7))throw Error("원격 v7 저장 형식이 유효하지 않습니다.");
  return{workspace:raw.workspaceV7,hasV7:true};
 }
 if(good(raw?.workspaceV6))return{workspace:normalizeFromV6(raw.workspaceV6),hasV7:false};
 return{workspace:normalizeFromV6(raw),hasV7:false};
}
function status(){
 syncEl.textContent=issue?"동기화 오류":!navigator.onLine?"오프라인 · 기기에 저장":conflict?"데이터 선택 필요":meta.dirty?"동기화 대기":ready?"동기화됨":"연결 중";
 syncEl.title=issue||"";
}
function checkpoint(reason,work){
 try{
  const i=(Number(localStorage.getItem("step_v7_checkpoint_index")||0)||0)%12;
  localStorage.setItem("step_v7_checkpoint_"+i,JSON.stringify({at:Date.now(),reason,state:work}));
  localStorage.setItem("step_v7_checkpoint_index",String(i+1));
  return true;
 }catch{return false}
}
function accept(remote,revision){
 if(!good(remote))throw Error("Invalid remote workspace");
 const local=api.getState();
 if(digest(local)!==digest(remote)&&hasTasks(local)&&!checkpoint("before-remote-apply",local)){
  issue="이전 데이터를 백업할 수 없어 클라우드 데이터를 적용하지 않았습니다.";status();return;
 }
 try{
  api.persistRemote(remote);
  meta={revision,remoteDigest:digest(remote),dirty:false};
  recordMeta();conflict=null;conflictPanel.hidden=true;ready=true;issue="";status();
 }catch(e){issue="클라우드 데이터 적용 실패: "+e.message;status()}
}
function chooseConflict(remote,rev,message){
 if(conflict&&conflict.revision===rev&&digest(conflict.remote)===digest(remote))return;
 conflict={remote,revision:rev};
 try{localStorage.setItem("step_v7_cloud_candidate_"+Date.now(),JSON.stringify(remote))}catch{}
 document.querySelector("#syncConflictDescription").textContent=message||"이 기기와 계정의 내용이 달라요. 자동으로 덮어쓰지 않았어요.";
 conflictPanel.hidden=false;issue="";ready=true;status();
}
function queued(){if(!uid||!ready||conflict||!meta.dirty)return;clearTimeout(timer);timer=setTimeout(push,700)}
window.StepV7Sync={
 changed(){meta.dirty=true;try{recordMeta()}catch(e){issue="동기화 메타 저장 실패";}status();queued()}
};
function observe(snap){
 if(!uid||snap.metadata?.hasPendingWrites)return;
 if(snap.metadata?.fromCache&&!ready){status();return}
 let cloud,derived,revision;
 try{
  cloud=snap.exists()?snap.data():null;
  revision=Number(cloud?.revision||0);
  derived=cloudWorkspace(cloud?.state||{tasks:[],groups:[]});
 }catch(e){issue=e.message;ready=false;status();return}
 const remote=derived.workspace,h=digest(remote),local=api.getState(),lh=digest(local);
 remoteInfo={cloud,revision,workspace:remote,hasV7:derived.hasV7};
 if(!initialized){
  initialized=true;ready=true;
  const originalLocal=load(STORE,null);
  const hasLocal=good(originalLocal)&&hasTasks(originalLocal);
  const needsConflict=hasLocal&&lh!==h&&(meta.dirty||!meta.remoteDigest||(!derived.hasV7&&hasTasks(remote)));
  if(needsConflict){chooseConflict(remote,revision);return}
  if(hasLocal&&meta.dirty&&lh!==h){
   meta.revision=revision;meta.remoteDigest=h;recordMeta();queued();status();return;
  }
  if(!derived.hasV7&&hasTasks(remote)&&!hasLocal){
   accept(remote,revision);
   meta.dirty=true;recordMeta();queued();return;
  }
  if(!derived.hasV7&&!hasTasks(remote)&&!hasLocal){
   const oldLocal=load("step_v6_live_v1",null)||load("step_live_v1",null);
   if(oldLocal&&hasTasks(oldLocal)){
    const converted=normalizeFromV6(oldLocal);
    accept(converted,revision);meta.remoteDigest=h;meta.dirty=true;recordMeta();queued();return;
   }
  }
  accept(remote,revision);
  if(!derived.hasV7){meta.remoteDigest=h;meta.dirty=true;recordMeta();queued()}
  return;
 }
 if(conflict){if(conflict.revision!==revision||digest(conflict.remote)!==h)chooseConflict(remote,revision);return}
 if(lh===h){meta={revision,remoteDigest:h,dirty:false};recordMeta();status();return}
 if(!derived.hasV7&&hasTasks(local)){chooseConflict(remote,revision,"다른 클라이언트가 v7 저장 내용을 변경하거나 제거했을 수 있어요. 이 기기 작업을 자동으로 버리지 않았어요.");return}
 if(meta.dirty){chooseConflict(remote,revision);return}
 accept(remote,revision);
}
async function push(){
 if(!uid||!ref||!ready||saving||conflict||!meta.dirty||!navigator.onLine)return;
 saving=true;const local=api.getState(),expected=meta.revision,expectedDigest=meta.remoteDigest,localDigest=digest(local);
 try{
  const result=await runTransaction(db,async tr=>{
   const snap=await tr.get(ref),old=snap.exists()?snap.data():null;
   const state=old?.state||{schema:2,tasks:[],activeId:null};
   const derived=cloudWorkspace(state),oldDigest=digest(derived.workspace),rev=Number(old?.revision||0);
   if(oldDigest!==expectedDigest||rev!==expected)return{conflict:true,remote:derived.workspace,revision:rev};
   if(oldDigest===localDigest&&derived.hasV7)return{revision:rev};
   const next={...state,workspaceV7:local};
   if(JSON.stringify(next).length>740000)throw Error("원격 저장 용량 제한을 넘었습니다.");
   if(old&&rev>0){
    const slot="slot-"+String(rev%50).padStart(2,"0");
    tr.set(doc(ref,"history",slot),{schema:1,state,stateHash:old.stateHash||tinyHash(state),archivedRevision:rev,operation:String(old.operation||"backup"),archivedAt:serverTimestamp(),archivedBy:"step-v7"});
   }
   const revision=rev+1;
   tr.set(ref,{schema:3,state:next,stateHash:tinyHash(next),revision,operation:"v7-sync",updatedAt:serverTimestamp(),updatedBy:"step-v7"});
   return{revision};
  });
  if(result.conflict){chooseConflict(result.remote,result.revision);return}
  if(digest(api.getState())===localDigest){
   meta={revision:result.revision,remoteDigest:localDigest,dirty:false};
  }else{
   meta.revision=result.revision;meta.remoteDigest=localDigest;meta.dirty=true;
  }
  recordMeta();issue="";status();queued();
 }catch(e){issue="저장 실패: "+String(e.message||e);console.error(e);status()}
 finally{saving=false}
}
document.querySelector("#syncUseCloud").addEventListener("click",()=>{
 if(!conflict)return;
 accept(conflict.remote,conflict.revision);
});
document.querySelector("#syncUseLocal").addEventListener("click",()=>{
 if(!conflict)return;
 const local=api.getState();
 if(!checkpoint("before-cloud-replace",conflict.remote)){alert("복구본 저장에 실패해서 덮어쓰지 않았습니다.");return}
 meta.revision=conflict.revision;meta.remoteDigest=digest(conflict.remote);meta.dirty=true;
 recordMeta();conflict=null;conflictPanel.hidden=true;queued();status();
});
document.querySelector("#authForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const status=document.querySelector("#authError");status.textContent="로그인 중…";
 try{
  await setPersistence(auth,browserLocalPersistence);
  await signInWithEmailAndPassword(auth,document.querySelector("#authEmail").value.trim(),document.querySelector("#authPassword").value);
  status.textContent="";
 }catch(error){status.textContent=error.code==="auth/invalid-credential"?"이메일 또는 비밀번호를 확인하세요.":String(error.message||error)}
});
document.querySelector("#accountButton").addEventListener("click",async()=>{
 const choice=prompt("Step 계정 관리\n1: 백업 파일 저장\n2: 로그아웃\n취소: 돌아가기");
 if(choice==="1"){
  const blob=new Blob([api.exportState()],{type:"application/json"}),url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="Step-v7-backup-"+today()+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 }else if(choice==="2"&&confirm("로그아웃할까요? 기기에 저장된 데이터는 삭제되지 않습니다."))await signOut(auth);
});
onAuthStateChanged(auth,person=>{
 if(unsubscribe){unsubscribe();unsubscribe=null}
 clearTimeout(timer);uid=person?.uid||null;ref=null;ready=false;initialized=false;conflict=null;conflictPanel.hidden=true;issue="";
 if(!uid){gate.hidden=false;status();return}
 gate.hidden=true;
 ref=doc(db,"stepUsers",uid,"states","main");
 unsubscribe=onSnapshot(ref,observe,error=>{issue="계정 데이터에 연결하지 못했습니다: "+error.message;status()});
 status();
});
addEventListener("online",()=>{issue="";status();queued()});
addEventListener("offline",status);
status();
