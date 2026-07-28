import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, onSnapshot, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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
const SYNC_PROFILE_KEY = "step_sync_profile_v1";
const SYNC_DOC_ID = "main";
const SAVE_DEBOUNCE_MS = 1200;

const syncGate = document.getElementById("syncGate");
const syncCard = document.getElementById("syncCard");
const syncPopover = document.getElementById("syncPopover");
const logoutTarget = document.getElementById("versionTap");
const stepApp = window.StepSyncApp;
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const deviceId = getDeviceId();
const persistenceReady = setPersistence(auth, browserLocalPersistence).catch(function(error){
  syncError = "로그인 유지 설정 실패: " + readableAuthError(error);
  renderSyncCard();
});

let currentUser = null;
let syncRef = null;
let unsubscribeSnapshot = null;
let saveTimer = null;
let syncStatus = "로그인 필요";
let syncError = "";
let lastCloudHash = "";
let lastAppliedRevision = 0;
let pendingRemote = null;
let pendingRemoteHash = "";
let pendingRemoteRevision = 0;
let pendingRemoteOperation = "";
let pendingRemoteRecovery = null;
let pendingReason = "";
let initialSnapshotHandled = false;
let logoutPopoverOpen = false;
let logoutArmed = false;
let logoutPressTimer = null;

window.StepSyncBridge = { onLocalStateChanged: function(){ queueCloudSave(); } };

bindLogoutTrigger();
renderSyncCard();

onAuthStateChanged(auth, function(user){
  currentUser = user || null;
  syncError = "";
  clearPendingRemote();
  initialSnapshotHandled = false;
  lastCloudHash = "";
  lastAppliedRevision = 0;
  clearTimeout(saveTimer);
  saveTimer = null;
  if(unsubscribeSnapshot){unsubscribeSnapshot();unsubscribeSnapshot = null}
  if(!currentUser){
    syncRef = null;
    syncStatus = "로그인 필요";
    hideLogoutPopover();
    renderSyncCard();
    return;
  }
  syncRef = doc(db,"stepUsers",currentUser.uid,"states",SYNC_DOC_ID);
  syncStatus = "연결 중";
  hideLogoutPopover();
  renderSyncCard();
  subscribeCloudState();
});

function getDeviceId(){
  try{
    let id = localStorage.getItem(SYNC_DEVICE_KEY);
    if(!id){
      id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : "device-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      localStorage.setItem(SYNC_DEVICE_KEY,id);
    }
    return id;
  }catch(error){return "device-" + Date.now() + "-" + Math.random().toString(16).slice(2)}
}
function cloudState(){return stepApp&&stepApp.getCloudState?stepApp.getCloudState():{schema:1,activeId:null,tasks:[]}}
function cloudHash(value){return JSON.stringify(value || cloudState())}
function cloudHasData(value){return !!(value && (value.activeId || (Array.isArray(value.tasks) && value.tasks.length)))}
function validCloudState(value){return !!(value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.tasks))}
function getSyncProfile(){try{return JSON.parse(localStorage.getItem(SYNC_PROFILE_KEY) || "null") || null}catch(error){return null}}
function markCloudLinked(hash,revision){
  if(!currentUser)return;
  try{localStorage.setItem(SYNC_PROFILE_KEY,JSON.stringify({uid:currentUser.uid,hash:String(hash || lastCloudHash || ""),revision:Number(revision || lastAppliedRevision || 0),linkedAt:Date.now()}))}catch(error){}
}
function isCloudLinkedForCurrentUser(){const profile=getSyncProfile();return !!(currentUser&&profile&&profile.uid===currentUser.uid)}
function sanitizeForFirestore(value){
  if(value === undefined)return undefined;
  if(value === null)return null;
  if(Array.isArray(value))return value.map(function(item){var cleaned=sanitizeForFirestore(item);return cleaned===undefined?null:cleaned});
  if(typeof value === "object"){
    var output={};
    Object.keys(value).forEach(function(key){var cleaned=sanitizeForFirestore(value[key]);if(cleaned!==undefined)output[key]=cleaned});
    return output;
  }
  return value;
}
function escapeHtml(value){return String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function readableAuthError(error){
  const code=error&&error.code?String(error.code):"";
  if(code.indexOf("invalid-credential")>=0||code.indexOf("wrong-password")>=0||code.indexOf("user-not-found")>=0)return "이메일 또는 비밀번호가 맞지 않아요.";
  if(code.indexOf("too-many-requests")>=0)return "시도가 너무 많아요. 잠시 뒤 다시 해주세요.";
  if(code.indexOf("network-request-failed")>=0)return "네트워크 연결을 확인해 주세요.";
  if(code.indexOf("operation-not-allowed")>=0)return "Firebase 콘솔에서 이메일/비밀번호 로그인을 켜야 해요.";
  if(code.indexOf("permission-denied")>=0)return "Firestore 규칙 또는 로그인 사용자를 확인해 주세요.";
  if(code.indexOf("invalid-argument")>=0)return "저장할 수 없는 값이 있어요.";
  return code||"알 수 없는 오류";
}
function renderSyncCard(){renderLoginGate();renderSyncNotice();renderLogoutPopover()}
function renderLoginGate(){
  if(!syncGate)return;
  const errorHtml=syncError?'<div class="sync-error">'+escapeHtml(syncError)+'</div>':'';
  if(currentUser){document.body.classList.remove("sync-locked");syncGate.hidden=true;syncGate.innerHTML="";return}
  document.body.classList.add("sync-locked");
  syncGate.hidden=false;
  syncGate.innerHTML='<div class="sync-gate-card">'+
    '<div class="sync-gate-brand"><img src="./step-icon.svg" alt="" aria-hidden="true" /><span>Step!</span></div>'+
    '<p class="sync-gate-title">로그인</p><p class="sync-gate-subtitle">한 번 로그인하면 계속 유지돼요.</p>'+
    '<div class="sync-gate-grid"><input id="syncEmailInput" type="email" autocomplete="username" placeholder="'+escapeHtml(STEP_SYNC_EMAIL_PLACEHOLDER)+'" />'+
    '<input id="syncPasswordInput" type="password" autocomplete="current-password" placeholder="비밀번호" /></div>'+
    '<button class="sync-gate-login" id="syncLoginBtn">로그인</button><div class="sync-gate-note">로그아웃하기 전까지 다시 묻지 않아요.</div>'+errorHtml+'</div>';
  bindSyncLogin();
}
function renderSyncNotice(){
  if(!syncCard)return;
  const localIssue=stepApp&&stepApp.localSafetyIssue?stepApp.localSafetyIssue():"";
  if(!currentUser||(!pendingRemote&&!syncError&&!localIssue)){syncCard.hidden=true;syncCard.innerHTML="";return}
  syncCard.hidden=false;
  const errorText=syncError||localIssue;
  const errorHtml=errorText?'<div class="sync-error">'+escapeHtml(errorText)+'</div>':'';
  let pendingHtml="";
  if(pendingRemote){
    const isInitial=pendingReason==="initial-conflict"||pendingReason==="empty-cloud-conflict";
    const message=pendingReason==="conflict"?"이 기기와 다른 기기에서 모두 바뀌었어요. 어느 쪽도 자동으로 지우지 않았어요.":pendingReason==="suspicious-remote"?"다른 기기에서 내용이 크게 줄었어요. 자동 적용하지 않았어요.":isInitial?"기기와 계정 데이터가 달라요. 처음 한 번만 기준을 정해요.":"다른 기기에서 바뀐 내용이 있어요. 입력 중이라 아직 가져오지 않았어요.";
    pendingHtml='<div>'+escapeHtml(message)+'<div class="sync-actions"><button class="sync-primary" id="syncApplyRemoteBtn">가져오기</button><button class="sync-secondary" id="syncUploadLocalBtn">이 기기 내용 올리기</button></div></div>';
  }
  syncCard.className="sync-card";
  syncCard.innerHTML='<div class="sync-title"><strong>동기화 확인</strong><span>'+escapeHtml(syncStatus)+'</span></div>'+pendingHtml+errorHtml;
  const applyBtn=document.getElementById("syncApplyRemoteBtn");
  const uploadBtn=document.getElementById("syncUploadLocalBtn");
  if(applyBtn)applyBtn.onclick=applyPendingRemote;
  if(uploadBtn)uploadBtn.onclick=function(){clearPendingRemote();pushCloudState(true,"user-keep-local")};
}
function bindSyncLogin(){
  const emailInput=document.getElementById("syncEmailInput"),passwordInput=document.getElementById("syncPasswordInput"),button=document.getElementById("syncLoginBtn");
  if(!emailInput||!passwordInput||!button)return;
  async function run(){
    const email=emailInput.value.trim(),password=passwordInput.value;
    if(!email||!password){syncError="이메일과 비밀번호를 입력해 주세요.";renderSyncCard();return}
    syncStatus="로그인 중";syncError="";renderSyncCard();
    try{await persistenceReady;await signInWithEmailAndPassword(auth,email,password)}catch(error){syncStatus="로그인 실패";syncError=readableAuthError(error);renderSyncCard()}
  }
  button.onclick=run;
  passwordInput.addEventListener("keydown",function(event){if(event.key==="Enter")run()});
  emailInput.addEventListener("keydown",function(event){if(event.key==="Enter")passwordInput.focus()});
}
function bindLogoutTrigger(){
  if(!logoutTarget)return;
  function clearPressTimer(){if(logoutPressTimer){clearTimeout(logoutPressTimer);logoutPressTimer=null}}
  logoutTarget.addEventListener("pointerdown",function(){if(!currentUser)return;clearPressTimer();logoutPressTimer=setTimeout(function(){logoutPressTimer=null;showLogoutPopover()},700)});
  ["pointerup","pointerleave","pointercancel"].forEach(function(type){logoutTarget.addEventListener(type,clearPressTimer)});
  logoutTarget.addEventListener("contextmenu",function(event){event.preventDefault()});
  document.addEventListener("pointerdown",function(event){if(!logoutPopoverOpen)return;if(syncPopover&&syncPopover.contains(event.target))return;if(logoutTarget&&logoutTarget.contains(event.target))return;hideLogoutPopover()});
}
function showLogoutPopover(){if(!currentUser||!syncPopover)return;logoutPopoverOpen=true;logoutArmed=false;renderLogoutPopover()}
function hideLogoutPopover(){logoutPopoverOpen=false;logoutArmed=false;renderLogoutPopover()}
function renderLogoutPopover(){
  if(!syncPopover)return;
  if(!currentUser||!logoutPopoverOpen){syncPopover.hidden=true;syncPopover.innerHTML="";return}
  syncPopover.hidden=false;
  syncPopover.innerHTML='<button id="syncHiddenLogoutBtn" class="'+(logoutArmed?'armed':'')+'">'+(logoutArmed?'로그아웃 확인':'로그아웃')+'</button>';
  const button=document.getElementById("syncHiddenLogoutBtn");
  if(button)button.onclick=function(event){event.stopPropagation();if(!logoutArmed){logoutArmed=true;renderLogoutPopover();return}hideLogoutPopover();signOut(auth)};
}
function subscribeCloudState(){
  if(!syncRef)return;
  unsubscribeSnapshot=onSnapshot(syncRef,function(snapshot){
    const local=cloudState(),localHash=cloudHash(local);
    if(!snapshot.exists()){
      initialSnapshotHandled=true;
      if(stepApp&&stepApp.isLocalStateSafe&&!stepApp.isLocalStateSafe()){syncStatus="복구 필요";syncError=stepApp.localSafetyIssue?stepApp.localSafetyIssue():"로컬 저장을 확인해 주세요.";renderSyncCard();return}
      if(cloudHasData(local)){syncStatus="첫 업로드 중";renderSyncCard();pushCloudState(true,"initial-upload")}else{syncStatus="동기화 준비됨";renderSyncCard()}
      return;
    }
    const data=snapshot.data()||{},remote=data.state||null,recovery=validCloudState(data.recoveryState)?data.recoveryState:null,revision=Number(data.revision||0),operation=String(data.operation||""),updatedBy=String(data.updatedBy||"");
    if(!validCloudState(remote)){
      if(recovery){holdRemote(recovery,revision,cloudHash(recovery),"suspicious-remote","recovery",null);return}
      syncStatus="클라우드 데이터 오류";syncError="클라우드 상태가 올바르지 않아 자동 적용하지 않았어요.";renderSyncCard();return;
    }
    const remoteHash=cloudHash(remote);
    if(updatedBy===deviceId||remoteHash===localHash){linkCloud(remoteHash,revision);return}
    if(!initialSnapshotHandled){
      initialSnapshotHandled=true;
      const profile=getSyncProfile();
      if(isCloudLinkedForCurrentUser()&&profile){
        const baseHash=String(profile.hash||"");
        if(localHash===baseHash&&remoteHash!==baseHash){applyRemoteState(remote,revision,remoteHash,{silent:true,operation:operation,recovery:recovery});return}
        if(remoteHash===baseHash&&localHash!==baseHash){lastCloudHash=remoteHash;lastAppliedRevision=revision;pushCloudState(false,"local-change");return}
        if(localHash===remoteHash){linkCloud(remoteHash,revision);return}
        holdRemote(remote,revision,remoteHash,"conflict",operation,recovery);return;
      }
      if(!cloudHasData(local)&&cloudHasData(remote)){applyRemoteState(remote,revision,remoteHash,{silent:true,operation:operation,recovery:recovery});return}
      if(cloudHasData(local)&&!cloudHasData(remote)){holdRemote(remote,revision,remoteHash,"empty-cloud-conflict",operation,recovery);return}
      if(cloudHasData(local)&&cloudHasData(remote)){holdRemote(remote,revision,remoteHash,"initial-conflict",operation,recovery);return}
      linkCloud(remoteHash,revision);return;
    }
    if(revision&&revision<=lastAppliedRevision&&remoteHash===lastCloudHash)return;
    if(localHash===lastCloudHash){applyRemoteState(remote,revision,remoteHash,{operation:operation,recovery:recovery});return}
    if(stepApp&&stepApp.isLocalInputActive&&stepApp.isLocalInputActive()){holdRemote(remote,revision,remoteHash,"input-active",operation,recovery);return}
    holdRemote(remote,revision,remoteHash,"conflict",operation,recovery);
  },function(error){syncStatus="동기화 오류";syncError=readableAuthError(error);renderSyncCard()});
}
function linkCloud(hash,revision){lastCloudHash=hash;lastAppliedRevision=Math.max(lastAppliedRevision,revision);markCloudLinked(hash,revision);syncStatus="동기화됨";syncError="";renderSyncCard()}
function clearPendingRemote(){pendingRemote=null;pendingRemoteHash="";pendingRemoteRevision=0;pendingRemoteOperation="";pendingRemoteRecovery=null;pendingReason=""}
function holdRemote(remote,revision,hash,reason,operation,recovery){pendingRemote=remote;pendingRemoteRevision=revision;pendingRemoteHash=hash;pendingRemoteOperation=String(operation||"");pendingRemoteRecovery=recovery||null;pendingReason=reason;syncStatus=reason==="input-active"?"적용 대기":"확인 필요";renderSyncCard()}
function applyPendingRemote(){if(!pendingRemote)return;applyRemoteState(pendingRemote,pendingRemoteRevision,pendingRemoteHash,{silent:false,operation:pendingRemoteOperation,recovery:pendingRemoteRecovery,explicit:true})}
function applyRemoteState(remote,revision,hash,options){
  options=options||{};
  const local=cloudState(),destructive=stepApp&&stepApp.destructiveChange?stepApp.destructiveChange(local,remote):false,allowed=options.explicit||["task-delete","user-keep-local","restore","reset"].indexOf(String(options.operation||""))>=0;
  if(destructive&&!allowed){holdRemote(remote,revision,hash,"suspicious-remote",options.operation,options.recovery);return}
  if(stepApp&&stepApp.snapshotLocal)stepApp.snapshotLocal("before-remote");
  if(stepApp&&stepApp.applyCloudState)stepApp.applyCloudState(remote);
  clearPendingRemote();lastCloudHash=hash||cloudHash(remote);lastAppliedRevision=Math.max(lastAppliedRevision,Number(revision||0));markCloudLinked(lastCloudHash,lastAppliedRevision);syncStatus="동기화됨";syncError="";renderSyncCard();
  if(!options.silent&&stepApp&&stepApp.toast)stepApp.toast("가져왔어요.");
}
function queueCloudSave(){
  if(!currentUser||!syncRef)return;
  if(stepApp&&stepApp.isLocalStateSafe&&!stepApp.isLocalStateSafe()){syncStatus="복구 필요";syncError=stepApp.localSafetyIssue?stepApp.localSafetyIssue():"로컬 저장을 확인해 주세요.";renderSyncCard();return}
  const nextHash=cloudHash();
  if(pendingRemote||nextHash===lastCloudHash)return;
  syncStatus="저장 대기";syncError="";renderSyncCard();clearTimeout(saveTimer);saveTimer=setTimeout(function(){pushCloudState(false,"local-change")},SAVE_DEBOUNCE_MS);
}
function historyRefFor(revision){const suffix=String(revision||Date.now())+"-"+deviceId.replace(/[^a-zA-Z0-9]/g,"").slice(0,10)+"-"+Date.now();return doc(db,"stepUsers",currentUser.uid,"states",SYNC_DOC_ID,"history",suffix)}
async function pushCloudState(force,requestedOperation){
  if(!currentUser||!syncRef)return;
  if(stepApp&&stepApp.isLocalStateSafe&&!stepApp.isLocalStateSafe()){syncStatus="복구 필요";syncError=stepApp.localSafetyIssue?stepApp.localSafetyIssue():"로컬 저장을 확인해 주세요.";renderSyncCard();return}
  const payloadState=sanitizeForFirestore(cloudState()),hash=cloudHash(payloadState);
  if(!force&&hash===lastCloudHash)return;
  const operation=String((stepApp&&stepApp.consumeOperation&&stepApp.consumeOperation())||requestedOperation||"local-change");
  syncStatus="저장 중";syncError="";renderSyncCard();
  try{
    const result=await runTransaction(db,async function(transaction){
      const currentSnapshot=await transaction.get(syncRef),currentData=currentSnapshot.exists()?currentSnapshot.data()||{}:{},currentState=validCloudState(currentData.state)?currentData.state:null,currentHash=currentState?cloudHash(currentState):"",currentRevision=Number(currentData.revision||0);
      if(!force&&currentSnapshot.exists()&&lastAppliedRevision&&currentRevision!==lastAppliedRevision&&currentHash!==lastCloudHash){const conflict=new Error("sync-conflict");conflict.remote=currentState;conflict.revision=currentRevision;conflict.hash=currentHash;conflict.operation=String(currentData.operation||"");conflict.recovery=currentData.recoveryState||null;throw conflict}
      const destructive=currentState&&stepApp&&stepApp.destructiveChange?stepApp.destructiveChange(currentState,payloadState):false,explicit=force||["task-delete","reset","restore","import","user-keep-local","initial-upload"].indexOf(operation)>=0;
      if(destructive&&!explicit){const suspicious=new Error("destructive-change");suspicious.remote=currentState;suspicious.revision=currentRevision;suspicious.hash=currentHash;throw suspicious}
      if(currentState&&(destructive||force))transaction.set(historyRefFor(currentRevision),{schema:1,state:currentState,stateHash:currentHash,revision:currentRevision,operation:String(currentData.operation||""),archivedAt:serverTimestamp(),archivedBy:deviceId});
      const nextRevision=currentRevision+1,recoveryState=cloudHasData(currentState)?currentState:(validCloudState(currentData.recoveryState)?currentData.recoveryState:null);
      transaction.set(syncRef,{schema:2,state:payloadState,stateHash:hash,revision:nextRevision,operation:operation,recoveryState:recoveryState,updatedAt:serverTimestamp(),updatedBy:deviceId},{merge:false});
      return{revision:nextRevision};
    });
    lastCloudHash=hash;lastAppliedRevision=result.revision;markCloudLinked(hash,result.revision);syncStatus="동기화됨";syncError="";renderSyncCard();
  }catch(error){
    if(error&&error.message==="sync-conflict"&&error.remote){holdRemote(error.remote,error.revision,error.hash,"conflict",error.operation,error.recovery);return}
    if(error&&error.message==="destructive-change"){syncStatus="저장 차단";syncError="내용이 비정상적으로 크게 줄어 자동 저장을 막았어요.";renderSyncCard();return}
    syncStatus="저장 실패";syncError=readableAuthError(error);renderSyncCard();
  }
}
