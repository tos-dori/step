import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, collection, getDocs, deleteDoc, onSnapshot, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCU6Yt9nnTwb9W7O3-FMGMy-BUYCh8pE80",
  authDomain: "step-sync-630a9.firebaseapp.com",
  projectId: "step-sync-630a9",
  storageBucket: "step-sync-630a9.firebasestorage.app",
  messagingSenderId: "717154851460",
  appId: "1:717154851460:web:04ecfa3dde532f7ae5c0d1"
};
const STEP_SYNC_EMAIL_PLACEHOLDER = "xxxxx@xxxxx.com";
const SYNC_DEVICE_KEY = "step_sync_device_id_v1";
const SYNC_PROFILE_KEY = "step_sync_profile_v2";
const SYNC_DOC_ID = "main";
const HISTORY_SLOTS = 50;
const SAVE_DEBOUNCE_MS = 2500;
const EXPLICIT_OPERATIONS = ["task-delete","restore-local","restore-cloud","user-keep-local","initial-upload"];

const syncGate = document.getElementById("syncGate");
const syncCard = document.getElementById("syncCard");
const syncPopover = document.getElementById("syncPopover");
const logoutTarget = document.getElementById("versionTap");
const stepApp = window.StepSyncApp;
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const deviceId = getDeviceId();
const sessionId = randomId().replace(/[^a-zA-Z0-9_-]/g,"").slice(0,18);
const clientId = (deviceId.replace(/[^a-zA-Z0-9_-]/g,"").slice(0,36)+"-"+sessionId).slice(0,64);
const persistenceReady = setPersistence(auth,browserLocalPersistence).catch(function(error){
  syncError="로그인 유지 설정 실패: "+readableAuthError(error);renderSyncCard();
});

let currentUser=null;
let syncRef=null;
let unsubscribeSnapshot=null;
let saveTimer=null;
let syncStatus="로그인 필요";
let syncError="";
let baseRevision=0;
let baseHash="";
let pendingRemote=null;
let pendingReason="";
let pendingOperation="local-change";
let initialSnapshotHandled=false;
let logoutPopoverOpen=false;
let logoutArmed=false;
let logoutPressTimer=null;
let recoveryOpen=false;
let recoveryLoading=false;
let recoveryItems=[];
let retryPending=false;

window.StepSyncBridge={onLocalStateChanged:function(operation){queueCloudSave(operation)}};
window.addEventListener("online",function(){if(retryPending){retryPending=false;queueCloudSave(pendingOperation||"local-change",true)}});

bindLogoutTrigger();
renderSyncCard();

onAuthStateChanged(auth,function(user){
  currentUser=user||null;syncError="";clearPendingRemote();initialSnapshotHandled=false;clearTimeout(saveTimer);saveTimer=null;retryPending=false;
  if(unsubscribeSnapshot){unsubscribeSnapshot();unsubscribeSnapshot=null}
  if(!currentUser){syncRef=null;baseRevision=0;baseHash="";syncStatus="로그인 필요";hideLogoutPopover();renderSyncCard();return}
  syncRef=doc(db,"stepUsers",currentUser.uid,"states",SYNC_DOC_ID);
  const profile=readProfile();
  baseRevision=profile&&profile.uid===currentUser.uid?Number(profile.revision||0):0;
  baseHash=profile&&profile.uid===currentUser.uid?String(profile.hash||""):"";
  syncStatus="연결 중";hideLogoutPopover();renderSyncCard();subscribeCloudState();
});

function randomId(){return crypto&&crypto.randomUUID?crypto.randomUUID():"id-"+Date.now()+"-"+Math.random().toString(16).slice(2)}
function getDeviceId(){
  try{let id=localStorage.getItem(SYNC_DEVICE_KEY);if(!id){id=randomId();localStorage.setItem(SYNC_DEVICE_KEY,id)}return id}catch(error){return randomId()}
}
function cloudState(){return stepApp&&stepApp.getCloudState?stepApp.getCloudState():{schema:2,activeId:null,tasks:[]}}
function cloudHash(value){return JSON.stringify(value===undefined?cloudState():value)}
function cloudHasData(value){return !!(value&&(value.activeId||(Array.isArray(value.tasks)&&value.tasks.length)))}
function validCloudState(value){return !!(stepApp&&stepApp.cloudStateSafe&&stepApp.cloudStateSafe(value))}
function sanitizeForFirestore(value){
  if(value===undefined)return undefined;if(value===null)return null;
  if(Array.isArray(value))return value.map(function(item){const cleaned=sanitizeForFirestore(item);return cleaned===undefined?null:cleaned});
  if(typeof value==="object"){const output={};Object.keys(value).forEach(function(key){const cleaned=sanitizeForFirestore(value[key]);if(cleaned!==undefined)output[key]=cleaned});return output}
  return value;
}
function readProfile(){try{return JSON.parse(localStorage.getItem(SYNC_PROFILE_KEY)||"null")||null}catch(error){return null}}
function writeProfile(hash,revision){
  if(!currentUser)return;baseHash=String(hash||"");baseRevision=Number(revision||0);
  try{localStorage.setItem(SYNC_PROFILE_KEY,JSON.stringify({uid:currentUser.uid,hash:baseHash,revision:baseRevision,linkedAt:Date.now()}))}catch(error){}
}
function escapeHtml(value){return String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function readableAuthError(error){
  const code=String(error&&error.code||error&&error.message||"");
  if(code.includes("invalid-credential")||code.includes("wrong-password")||code.includes("user-not-found"))return "이메일 또는 비밀번호가 맞지 않아요.";
  if(code.includes("too-many-requests"))return "시도가 너무 많아요. 잠시 뒤 다시 해주세요.";
  if(code.includes("network-request-failed")||code.includes("unavailable")||!navigator.onLine)return "오프라인 상태예요. 이 기기에는 저장했고 연결되면 다시 동기화해요.";
  if(code.includes("permission-denied"))return "Firestore 규칙 또는 로그인 사용자를 확인해 주세요.";
  if(code.includes("resource-exhausted"))return "저장 데이터 크기나 Firebase 사용량을 확인해 주세요.";
  return code||"알 수 없는 오류";
}
function operationPriority(value){return EXPLICIT_OPERATIONS.indexOf(value)>=0?2:value&&value!=="local-change"&&value!=="boot"?1:0}
function rememberOperation(value){value=String(value||"local-change");if(operationPriority(value)>=operationPriority(pendingOperation))pendingOperation=value}
function isExplicitOperation(value){return EXPLICIT_OPERATIONS.indexOf(String(value||""))>=0}
function historyRef(revision){const slot=Math.abs(Number(revision)||0)%HISTORY_SLOTS;return doc(syncRef,"history","slot-"+String(slot).padStart(2,"0"))}
function conflictRef(){return doc(syncRef,"conflicts",clientId)}
function mainPayload(stateValue,hash,revision,operation){return{schema:3,state:stateValue,stateHash:hash,revision:revision,operation:String(operation||"local-change"),updatedAt:serverTimestamp(),updatedBy:clientId}}
function historyPayload(data,stateValue,hash,revision){return{schema:1,state:stateValue,stateHash:hash,archivedRevision:Number(revision||0),operation:String(data&&data.operation||"legacy"),archivedAt:serverTimestamp(),archivedBy:clientId}}
function conflictPayload(localState,localHash,remoteRevision,remoteHash,operation){return{schema:1,state:localState,stateHash:localHash,baseRevision:Number(baseRevision||0),baseHash:String(baseHash||""),observedRevision:Number(remoteRevision||0),observedHash:String(remoteHash||""),operation:String(operation||"local-change"),createdAt:serverTimestamp(),updatedBy:clientId}}

function renderSyncCard(){renderLoginGate();renderSyncNotice();renderLogoutPopover()}
function renderLoginGate(){
  if(!syncGate)return;const errorHtml=syncError?'<div class="sync-error">'+escapeHtml(syncError)+'</div>':'';
  if(currentUser){document.body.classList.remove("sync-locked");syncGate.hidden=true;syncGate.innerHTML="";return}
  document.body.classList.add("sync-locked");syncGate.hidden=false;
  syncGate.innerHTML='<div class="sync-gate-card"><div class="sync-gate-brand"><img src="./step-icon.svg" alt="" aria-hidden="true" /><span>Step!</span></div><p class="sync-gate-title">로그인</p><p class="sync-gate-subtitle">한 번 로그인하면 계속 유지돼요.</p><div class="sync-gate-grid"><input id="syncEmailInput" type="email" autocomplete="username" placeholder="'+escapeHtml(STEP_SYNC_EMAIL_PLACEHOLDER)+'" /><input id="syncPasswordInput" type="password" autocomplete="current-password" placeholder="비밀번호" /></div><button class="sync-gate-login" id="syncLoginBtn">로그인</button><div class="sync-gate-note">로그아웃하기 전까지 다시 묻지 않아요.</div>'+errorHtml+'</div>';
  bindSyncLogin();
}
function renderSyncNotice(){
  if(!syncCard)return;const localIssue=stepApp&&stepApp.localSafetyIssue?stepApp.localSafetyIssue():"";
  if(!currentUser||(!pendingRemote&&!syncError&&!localIssue&&!recoveryOpen)){syncCard.hidden=true;syncCard.innerHTML="";return}
  syncCard.hidden=false;let body="";
  if(pendingRemote){
    const message=pendingReason==="initial-conflict"?"이 기기와 계정 데이터가 달라요. 어느 쪽도 자동으로 지우지 않았어요.":"다른 기기와 이 기기에서 모두 바뀌었어요. 이 기기 상태도 충돌 복사본으로 보존했어요.";
    body+='<div>'+escapeHtml(message)+'<div class="sync-actions"><button class="sync-primary" id="syncApplyRemoteBtn">계정 데이터 사용</button><button class="sync-secondary" id="syncUploadLocalBtn">이 기기 데이터 사용</button></div></div>';
  }
  if(recoveryOpen)body+=renderRecoveryList();
  const errorText=syncError||localIssue;
  if(errorText)body+='<div class="sync-error">'+escapeHtml(errorText)+'</div>';
  syncCard.className="sync-card";syncCard.innerHTML='<div class="sync-title"><strong>'+(recoveryOpen?'복구본':'동기화 확인')+'</strong><span>'+escapeHtml(syncStatus)+'</span></div>'+body;
  const applyBtn=document.getElementById("syncApplyRemoteBtn"),uploadBtn=document.getElementById("syncUploadLocalBtn");
  if(applyBtn)applyBtn.onclick=useRemoteConflict;if(uploadBtn)uploadBtn.onclick=useLocalConflict;
  document.querySelectorAll("[data-step-recovery]").forEach(function(button){button.onclick=function(){restoreRecovery(button.dataset.source,button.dataset.slot)}});
}
function renderRecoveryList(){
  if(recoveryLoading)return'<div>복구본 불러오는 중…</div>';
  if(!recoveryItems.length)return'<div>사용 가능한 복구본이 없어요.</div>';
  return'<div>'+recoveryItems.slice(0,15).map(function(item){return'<div class="sync-actions"><button class="sync-secondary" data-step-recovery="1" data-source="'+escapeHtml(item.source)+'" data-slot="'+escapeHtml(item.slot)+'">'+escapeHtml(item.label)+'</button></div>'}).join("")+'</div>';
}
function bindSyncLogin(){
  const email=document.getElementById("syncEmailInput"),password=document.getElementById("syncPasswordInput"),button=document.getElementById("syncLoginBtn");if(!email||!password||!button)return;
  async function run(){if(!email.value.trim()||!password.value){syncError="이메일과 비밀번호를 입력해 주세요.";renderSyncCard();return}syncStatus="로그인 중";syncError="";renderSyncCard();try{await persistenceReady;await signInWithEmailAndPassword(auth,email.value.trim(),password.value)}catch(error){syncStatus="로그인 실패";syncError=readableAuthError(error);renderSyncCard()}}
  button.onclick=run;password.addEventListener("keydown",function(event){if(event.key==="Enter")run()});email.addEventListener("keydown",function(event){if(event.key==="Enter")password.focus()});
}
function bindLogoutTrigger(){
  if(!logoutTarget)return;function clearPress(){if(logoutPressTimer){clearTimeout(logoutPressTimer);logoutPressTimer=null}}
  logoutTarget.addEventListener("pointerdown",function(){if(!currentUser)return;clearPress();logoutPressTimer=setTimeout(function(){logoutPressTimer=null;showLogoutPopover()},700)});
  ["pointerup","pointerleave","pointercancel"].forEach(function(type){logoutTarget.addEventListener(type,clearPress)});logoutTarget.addEventListener("contextmenu",function(event){event.preventDefault()});
  document.addEventListener("pointerdown",function(event){if(!logoutPopoverOpen)return;if(syncPopover&&syncPopover.contains(event.target))return;if(logoutTarget&&logoutTarget.contains(event.target))return;hideLogoutPopover()});
}
function showLogoutPopover(){if(!currentUser||!syncPopover)return;logoutPopoverOpen=true;logoutArmed=false;renderLogoutPopover()}
function hideLogoutPopover(){logoutPopoverOpen=false;logoutArmed=false;renderLogoutPopover()}
function renderLogoutPopover(){
  if(!syncPopover)return;if(!currentUser||!logoutPopoverOpen){syncPopover.hidden=true;syncPopover.innerHTML="";return}
  syncPopover.hidden=false;syncPopover.innerHTML='<button id="syncRecoveryBtn">복구본</button><button id="syncHiddenLogoutBtn" class="'+(logoutArmed?'armed':'')+'">'+(logoutArmed?'로그아웃 확인':'로그아웃')+'</button>';
  const recovery=document.getElementById("syncRecoveryBtn"),logout=document.getElementById("syncHiddenLogoutBtn");
  if(recovery)recovery.onclick=function(event){event.stopPropagation();hideLogoutPopover();openRecoveryPanel()};
  if(logout)logout.onclick=function(event){event.stopPropagation();if(!logoutArmed){logoutArmed=true;renderLogoutPopover();return}hideLogoutPopover();signOut(auth)};
}

function subscribeCloudState(){
  if(!syncRef)return;unsubscribeSnapshot=onSnapshot(syncRef,function(snapshot){
    const local=cloudState(),localHash=cloudHash(local);
    if(!snapshot.exists()){initialSnapshotHandled=true;if(!safeLocal()){return}if(cloudHasData(local)){pushCloudState(true,"initial-upload")}else{syncStatus="동기화 준비됨";renderSyncCard()}return}
    const data=snapshot.data()||{},remote=data.state,remoteHash=String(data.stateHash||cloudHash(remote)),revision=Number(data.revision||0);
    if(!validCloudState(remote)){syncStatus="클라우드 데이터 오류";syncError="클라우드 상태 형식이 올바르지 않아 자동 적용하지 않았어요.";renderSyncCard();return}
    if(remoteHash===localHash){linkBase(remoteHash,revision);return}
    if(!initialSnapshotHandled){
      initialSnapshotHandled=true;const profile=readProfile(),linked=profile&&profile.uid===currentUser.uid;
      if(!linked){if(!cloudHasData(local)&&cloudHasData(remote)){applyRemote(remote,remoteHash,revision,true);return}holdRemote(remote,remoteHash,revision,"initial-conflict");return}
      if(localHash===baseHash&&remoteHash!==baseHash){applyRemote(remote,remoteHash,revision,true);return}
      if(remoteHash===baseHash&&localHash!==baseHash){queueCloudSave("local-change",true);return}
      holdRemote(remote,remoteHash,revision,"conflict");return;
    }
    if(localHash===baseHash){applyRemote(remote,remoteHash,revision,false);return}
    if(remoteHash===baseHash){queueCloudSave("local-change",true);return}
    holdRemote(remote,remoteHash,revision,"conflict");
  },function(error){syncStatus="동기화 오류";syncError=readableAuthError(error);renderSyncCard()});
}
function safeLocal(){
  if(stepApp&&stepApp.isLocalStateSafe&&!stepApp.isLocalStateSafe()){syncStatus="복구 필요";syncError=stepApp.localSafetyIssue();renderSyncCard();return false}
  const value=cloudState();if(!validCloudState(value)){syncStatus="저장 차단";syncError="데이터 형식 또는 크기가 안전 범위를 벗어나 클라우드 저장을 막았어요.";renderSyncCard();return false}return true;
}
function linkBase(hash,revision){writeProfile(hash,revision);syncStatus="동기화됨";syncError="";renderSyncCard()}
function holdRemote(stateValue,hash,revision,reason){pendingRemote={state:stateValue,hash:hash,revision:revision};pendingReason=reason;syncStatus="확인 필요";renderSyncCard();preserveConflictCandidate(stateValue,hash,revision,pendingOperation)}
function clearPendingRemote(){pendingRemote=null;pendingReason=""}
function applyRemote(remote,hash,revision,silent){
  if(stepApp&&stepApp.checkpointLocal)stepApp.checkpointLocal("before-remote",true);
  if(stepApp&&stepApp.applyCloudState)stepApp.applyCloudState(remote,"remote-apply");
  clearPendingRemote();linkBase(hash,revision);deleteConflictCandidate();if(!silent&&stepApp&&stepApp.toast)stepApp.toast("계정 데이터를 가져왔어요.");
}
async function useRemoteConflict(){if(!pendingRemote)return;applyRemote(pendingRemote.state,pendingRemote.hash,pendingRemote.revision,false)}
async function useLocalConflict(){if(!pendingRemote)return;clearPendingRemote();await pushCloudState(true,"user-keep-local");await deleteConflictCandidate()}
async function preserveConflictCandidate(remote,remoteHash,remoteRevision,operation){
  if(!currentUser||!syncRef||!safeLocal())return;const local=sanitizeForFirestore(cloudState()),localHash=cloudHash(local);
  try{await runTransaction(db,async function(transaction){transaction.set(conflictRef(),conflictPayload(local,localHash,remoteRevision,remoteHash,operation),{merge:false})})}catch(error){if(navigator.onLine)console.warn("Step conflict preservation failed",error)}
}
async function deleteConflictCandidate(){if(!currentUser||!syncRef)return;try{await deleteDoc(conflictRef())}catch(error){}}

function queueCloudSave(operation,immediate){
  rememberOperation(operation);if(!currentUser||!syncRef||!safeLocal())return;clearTimeout(saveTimer);syncStatus=navigator.onLine?"저장 대기":"오프라인 저장됨";syncError="";renderSyncCard();
  saveTimer=setTimeout(function(){pushCloudState(false,pendingOperation)},immediate?0:SAVE_DEBOUNCE_MS);
}
async function pushCloudState(force,requestedOperation){
  if(!currentUser||!syncRef||!safeLocal())return false;
  const local=sanitizeForFirestore(cloudState()),localHash=cloudHash(local),operation=String(requestedOperation||pendingOperation||"local-change");
  if(!force&&localHash===baseHash){pendingOperation="local-change";return true}
  if(stepApp&&stepApp.nonEmptyToEmpty&&stepApp.nonEmptyToEmpty({tasks:baseHash?[]:[]},local)&&!isExplicitOperation(operation)){syncStatus="저장 차단";syncError="전체 할 일이 비워지는 변경은 명시적 삭제일 때만 저장해요.";renderSyncCard();return false}
  syncStatus="저장 중";syncError="";renderSyncCard();
  try{
    const result=await runTransaction(db,async function(transaction){
      const snap=await transaction.get(syncRef),exists=snap.exists(),data=exists?snap.data()||{}:{},remote=exists?data.state:null;
      if(exists&&!validCloudState(remote))throw new Error("cloud-state-invalid");
      const remoteHash=exists?String(data.stateHash||cloudHash(remote)):"",remoteRevision=exists?Number(data.revision||0):0;
      if(exists&&remoteHash===localHash)return{kind:"same",revision:remoteRevision,hash:remoteHash};
      if(!force&&exists&&(remoteRevision!==baseRevision||remoteHash!==baseHash)){
        transaction.set(conflictRef(),conflictPayload(local,localHash,remoteRevision,remoteHash,operation),{merge:false});
        return{kind:"conflict",revision:remoteRevision,hash:remoteHash,state:remote};
      }
      if(exists){transaction.set(historyRef(remoteRevision),historyPayload(data,remote,remoteHash,remoteRevision),{merge:false})}
      const nextRevision=remoteRevision+1;transaction.set(syncRef,mainPayload(local,localHash,nextRevision,operation),{merge:false});
      return{kind:"written",revision:nextRevision,hash:localHash};
    });
    if(result.kind==="conflict"){holdRemote(result.state,result.hash,result.revision,"conflict");return false}
    linkBase(result.hash,result.revision);pendingOperation="local-change";retryPending=false;return true;
  }catch(error){
    const code=String(error&&error.code||error&&error.message||"");
    if(code.includes("unavailable")||code.includes("network")||!navigator.onLine){retryPending=true;syncStatus="오프라인 저장됨";syncError="이 기기에는 저장했고 연결되면 다시 동기화해요.";renderSyncCard();return false}
    syncStatus="저장 실패";syncError=code==="cloud-state-invalid"?"기존 클라우드 데이터 형식이 올바르지 않아 덮어쓰지 않았어요.":readableAuthError(error);renderSyncCard();return false;
  }
}

async function openRecoveryPanel(){recoveryOpen=true;recoveryLoading=true;recoveryItems=[];syncStatus="복구본";renderSyncCard();
  const local=(stepApp&&stepApp.listLocalCheckpoints?stepApp.listLocalCheckpoints():[]).map(function(item){let count=0;try{count=(JSON.parse(item.raw).tasks||[]).length}catch(error){}return{source:"local",slot:String(item.slot),sort:item.createdAt,label:"기기 · "+formatTime(item.createdAt)+" · 할 일 "+count+"개 · "+item.reason}});
  let cloud=[];
  try{if(syncRef){const snaps=await getDocs(collection(syncRef,"history"));snaps.forEach(function(snap){const data=snap.data()||{};if(validCloudState(data.state))cloud.push({source:"cloud",slot:snap.id,sort:Number(data.archivedRevision||0),state:data.state,revision:Number(data.archivedRevision||0),label:"계정 · r"+Number(data.archivedRevision||0)+" · 할 일 "+(data.state.tasks||[]).length+"개 · "+String(data.operation||"저장")})})}}catch(error){syncError="계정 복구본을 불러오지 못했어요."}
  recoveryItems=local.concat(cloud).sort(function(a,b){return b.sort-a.sort});recoveryLoading=false;renderSyncCard();
}
function formatTime(value){const date=new Date(Number(value||0));return isNaN(date.getTime())?"시간 미상":date.toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}
async function restoreRecovery(source,slot){
  if(source==="local"){
    try{stepApp.restoreLocalCheckpoint(Number(slot));pendingOperation="restore-local";location.reload()}catch(error){syncError="로컬 복구본을 복원하지 못했어요.";renderSyncCard()}return;
  }
  const item=recoveryItems.find(function(value){return value.source==="cloud"&&value.slot===slot});if(!item)return;
  if(stepApp&&stepApp.checkpointLocal)stepApp.checkpointLocal("before-restore",true);
  if(stepApp&&stepApp.applyCloudState)stepApp.applyCloudState(item.state,"restore-cloud");
  recoveryOpen=false;await pushCloudState(true,"restore-cloud");if(stepApp&&stepApp.toast)stepApp.toast("계정 복구본을 복원했어요.");
}
