    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
    import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
    import { getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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
    const SAVE_DEBOUNCE_MS = 650;

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
    let pendingReason = "";
    let initialSnapshotHandled = false;
    let logoutPopoverOpen = false;
    let logoutArmed = false;
    let logoutPressTimer = null;

    window.StepSyncBridge = {
      onLocalStateChanged: function(){
        queueCloudSave();
      }
    };

    bindLogoutTrigger();
    renderSyncCard();

    onAuthStateChanged(auth, function(user){
      currentUser = user || null;
      syncError = "";
      pendingRemote = null;
      pendingReason = "";
      pendingRemoteHash = "";
      pendingRemoteRevision = 0;
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
      }catch(error){
        return "device-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      }
    }
    function cloudState(){return stepApp&&stepApp.getCloudState?stepApp.getCloudState():{schema:1,activeId:null,tasks:[]}}
    function cloudHash(value){return JSON.stringify(value || cloudState())}
    function cloudHasData(value){return !!(value && (value.activeId || (Array.isArray(value.tasks) && value.tasks.length)))}
    function getSyncProfile(){
      try{return JSON.parse(localStorage.getItem(SYNC_PROFILE_KEY) || "null") || null}catch(error){return null}
    }
    function markCloudLinked(hash,revision){
      if(!currentUser)return;
      try{
        localStorage.setItem(SYNC_PROFILE_KEY,JSON.stringify({uid:currentUser.uid,hash:String(hash || lastCloudHash || ""),revision:Number(revision || lastAppliedRevision || 0),linkedAt:Date.now()}));
      }catch(error){}
    }
    function isCloudLinkedForCurrentUser(){
      const profile = getSyncProfile();
      return !!(currentUser && profile && profile.uid === currentUser.uid);
    }
    function sanitizeForFirestore(value){
      if(value === undefined)return undefined;
      if(value === null)return null;
      if(Array.isArray(value)){
        return value.map(function(item){
          var cleaned = sanitizeForFirestore(item);
          return cleaned === undefined ? null : cleaned;
        });
      }
      if(typeof value === "object"){
        var output = {};
        Object.keys(value).forEach(function(key){
          var cleaned = sanitizeForFirestore(value[key]);
          if(cleaned !== undefined)output[key] = cleaned;
        });
        return output;
      }
      return value;
    }
    function escapeHtml(value){return String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
    function maskEmail(email){
      email = String(email || "");
      const parts = email.split("@");
      if(parts.length !== 2)return "로그인됨";
      const name = parts[0], domain = parts[1];
      const shown = name.length <= 2 ? name.charAt(0) + "*" : name.slice(0,2) + "***";
      return shown + "@" + domain;
    }
    function readableAuthError(error){
      const code = error && error.code ? String(error.code) : "";
      if(code.indexOf("invalid-credential") >= 0 || code.indexOf("wrong-password") >= 0 || code.indexOf("user-not-found") >= 0)return "이메일 또는 비밀번호가 맞지 않아요.";
      if(code.indexOf("too-many-requests") >= 0)return "시도가 너무 많아요. 잠시 뒤 다시 해주세요.";
      if(code.indexOf("network-request-failed") >= 0)return "네트워크 연결을 확인해 주세요.";
      if(code.indexOf("operation-not-allowed") >= 0)return "Firebase 콘솔에서 이메일/비밀번호 로그인을 켜야 해요.";
      if(code.indexOf("permission-denied") >= 0)return "Firestore 규칙 또는 로그인 사용자를 확인해 주세요.";
      if(code.indexOf("invalid-argument") >= 0)return "저장할 수 없는 값이 있어요.";
      return code || "알 수 없는 오류";
    }
    function renderSyncCard(){
      renderLoginGate();
      renderSyncNotice();
      renderLogoutPopover();
    }
    function renderLoginGate(){
      if(!syncGate)return;
      const status = escapeHtml(syncStatus);
      const errorHtml = syncError ? '<div class="sync-error">' + escapeHtml(syncError) + '</div>' : '';
      if(currentUser){
        document.body.classList.remove("sync-locked");
        syncGate.hidden = true;
        syncGate.innerHTML = "";
        return;
      }
      document.body.classList.add("sync-locked");
      syncGate.hidden = false;
      syncGate.innerHTML = '<div class="sync-gate-card">' +
        '<div class="sync-gate-brand"><img src="./step-icon.svg" alt="" aria-hidden="true" /><span>Step!</span></div>' +
        '<p class="sync-gate-title">로그인</p>' +
        '<p class="sync-gate-subtitle">한 번 로그인하면 계속 유지돼요.</p>' +
        '<div class="sync-gate-grid"><input id="syncEmailInput" type="email" autocomplete="username" placeholder="' + escapeHtml(STEP_SYNC_EMAIL_PLACEHOLDER) + '" />' +
        '<input id="syncPasswordInput" type="password" autocomplete="current-password" placeholder="비밀번호" /></div>' +
        '<button class="sync-gate-login" id="syncLoginBtn">로그인</button>' +
        '<div class="sync-gate-note">로그아웃하기 전까지 다시 묻지 않아요.</div>' + errorHtml + '</div>';
      bindSyncLogin();
    }
    function renderSyncNotice(){
      if(!syncCard)return;
      if(!currentUser || (!pendingRemote && !syncError)){
        syncCard.hidden = true;
        syncCard.innerHTML = "";
        return;
      }
      syncCard.hidden = false;
      const status = escapeHtml(syncStatus);
      const errorHtml = syncError ? '<div class="sync-error">' + escapeHtml(syncError) + '</div>' : '';
      let pendingHtml = "";
      if(pendingRemote){
        const isInitial = pendingReason === "initial-conflict";
        const message = isInitial ? "계정 데이터가 있어요. 처음 한 번만 어느 쪽을 기준으로 할지 정해요." : "다른 기기에서 바뀐 내용이 있어요. 입력 중이라 아직 가져오지 않았어요.";
        const primary = isInitial ? "가져오기" : "가져오기";
        const secondary = isInitial ? "이 기기 내용 올리기" : "이 기기 내용 유지";
        pendingHtml = '<div>' + escapeHtml(message) + '<div class="sync-actions"><button class="sync-primary" id="syncApplyRemoteBtn">' + primary + '</button><button class="sync-secondary" id="syncUploadLocalBtn">' + secondary + '</button></div></div>';
      }
      syncCard.className = "sync-card";
      syncCard.innerHTML = '<div class="sync-title"><strong>동기화 확인</strong><span>' + status + '</span></div>' + pendingHtml + errorHtml;
      const applyBtn = document.getElementById("syncApplyRemoteBtn");
      const uploadBtn = document.getElementById("syncUploadLocalBtn");
      if(applyBtn)applyBtn.onclick = applyPendingRemote;
      if(uploadBtn)uploadBtn.onclick = function(){pendingRemote = null; pendingReason = ""; pushCloudState(true)};
    }
    function bindSyncLogin(){
      const emailInput = document.getElementById("syncEmailInput");
      const passwordInput = document.getElementById("syncPasswordInput");
      const button = document.getElementById("syncLoginBtn");
      if(!emailInput || !passwordInput || !button)return;
      async function run(){
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if(!email || !password){syncError = "이메일과 비밀번호를 입력해 주세요."; renderSyncCard(); return}
        syncStatus = "로그인 중"; syncError = ""; renderSyncCard();
        try{
          await persistenceReady;
          await signInWithEmailAndPassword(auth,email,password);
        }catch(error){
          syncStatus = "로그인 실패";
          syncError = readableAuthError(error);
          renderSyncCard();
        }
      }
      button.onclick = run;
      passwordInput.addEventListener("keydown",function(event){if(event.key === "Enter")run()});
      emailInput.addEventListener("keydown",function(event){if(event.key === "Enter")passwordInput.focus()});
    }
    function bindLogoutTrigger(){
      if(!logoutTarget)return;
      function clearPressTimer(){if(logoutPressTimer){clearTimeout(logoutPressTimer);logoutPressTimer = null}}
      logoutTarget.addEventListener("pointerdown",function(event){
        if(!currentUser)return;
        clearPressTimer();
        logoutPressTimer = setTimeout(function(){
          logoutPressTimer = null;
          showLogoutPopover();
        },700);
      });
      ["pointerup","pointerleave","pointercancel"].forEach(function(type){
        logoutTarget.addEventListener(type,clearPressTimer);
      });
      logoutTarget.addEventListener("contextmenu",function(event){event.preventDefault()});
      document.addEventListener("pointerdown",function(event){
        if(!logoutPopoverOpen)return;
        if(syncPopover && syncPopover.contains(event.target))return;
        if(logoutTarget && logoutTarget.contains(event.target))return;
        hideLogoutPopover();
      });
    }
    function showLogoutPopover(){
      if(!currentUser || !syncPopover)return;
      logoutPopoverOpen = true;
      logoutArmed = false;
      renderLogoutPopover();
    }
    function hideLogoutPopover(){
      logoutPopoverOpen = false;
      logoutArmed = false;
      renderLogoutPopover();
    }
    function renderLogoutPopover(){
      if(!syncPopover)return;
      if(!currentUser || !logoutPopoverOpen){
        syncPopover.hidden = true;
        syncPopover.innerHTML = "";
        return;
      }
      syncPopover.hidden = false;
      syncPopover.innerHTML = '<button id="syncHiddenLogoutBtn" class="' + (logoutArmed ? 'armed' : '') + '">' + (logoutArmed ? '로그아웃 확인' : '로그아웃') + '</button>';
      const button = document.getElementById("syncHiddenLogoutBtn");
      if(button)button.onclick = function(event){
        event.stopPropagation();
        if(!logoutArmed){logoutArmed = true; renderLogoutPopover(); return}
        hideLogoutPopover();
        signOut(auth);
      };
    }
    function subscribeCloudState(){
      if(!syncRef)return;
      unsubscribeSnapshot = onSnapshot(syncRef,function(snapshot){
        const local = cloudState();
        const localHash = cloudHash(local);
        if(!snapshot.exists()){
          initialSnapshotHandled = true;
          if(cloudHasData(local)){
            syncStatus = "첫 업로드 중";
            renderSyncCard();
            pushCloudState(true);
          }else{
            syncStatus = "동기화 준비됨";
            renderSyncCard();
          }
          return;
        }
        const data = snapshot.data() || {};
        const remote = data.state || null;
        const revision = Number(data.revision || 0);
        const updatedBy = String(data.updatedBy || "");
        if(!remote){syncStatus = "클라우드 데이터 없음"; renderSyncCard(); return}
        const remoteHash = cloudHash(remote);
        if(updatedBy === deviceId || remoteHash === localHash){
          lastCloudHash = remoteHash;
          lastAppliedRevision = Math.max(lastAppliedRevision,revision);
          markCloudLinked(remoteHash,revision);
          syncStatus = "동기화됨";
          renderSyncCard();
          return;
        }
        if(!initialSnapshotHandled){
          initialSnapshotHandled = true;
          if(isCloudLinkedForCurrentUser()){
            if(stepApp && stepApp.isLocalInputActive && stepApp.isLocalInputActive()){
              holdRemote(remote,revision,remoteHash,"input-active");
            }else{
              applyRemoteState(remote,revision,remoteHash,{silent:true});
            }
            return;
          }
          if(!cloudHasData(local) && cloudHasData(remote)){
            applyRemoteState(remote,revision,remoteHash,{silent:true});
            return;
          }
          if(cloudHasData(local) && !cloudHasData(remote)){
            pushCloudState(true);
            return;
          }
          if(cloudHasData(local) && cloudHasData(remote)){
            holdRemote(remote,revision,remoteHash,"initial-conflict");
            return;
          }
        }
        if(revision && revision <= lastAppliedRevision && remoteHash === lastCloudHash)return;
        if(stepApp && stepApp.isLocalInputActive && stepApp.isLocalInputActive()){
          holdRemote(remote,revision,remoteHash,"input-active");
        }else{
          applyRemoteState(remote,revision,remoteHash);
        }
      },function(error){
        syncStatus = "동기화 오류";
        syncError = readableAuthError(error);
        renderSyncCard();
      });
    }
    function holdRemote(remote,revision,hash,reason){
      pendingRemote = remote;
      pendingRemoteRevision = revision;
      pendingRemoteHash = hash;
      pendingReason = reason;
      syncStatus = reason === "initial-conflict" ? "처음 연결" : "적용 대기";
      renderSyncCard();
    }
    function applyPendingRemote(){
      if(!pendingRemote)return;
      applyRemoteState(pendingRemote,pendingRemoteRevision,pendingRemoteHash,{silent:false});
    }
    function applyRemoteState(remote,revision,hash,options){
      options = options || {};
      if(stepApp && stepApp.applyCloudState)stepApp.applyCloudState(remote);
      pendingRemote = null;
      pendingReason = "";
      lastCloudHash = hash || cloudHash(remote);
      lastAppliedRevision = Math.max(lastAppliedRevision,Number(revision || 0));
      markCloudLinked(lastCloudHash,lastAppliedRevision);
      syncStatus = "동기화됨";
      syncError = "";
      renderSyncCard();
      if(!options.silent && stepApp && stepApp.toast)stepApp.toast("가져왔어요.");
    }
    function queueCloudSave(){
      if(!currentUser || !syncRef)return;
      const nextHash = cloudHash();
      if(pendingRemote)return;
      if(nextHash === lastCloudHash)return;
      syncStatus = "저장 대기";
      syncError = "";
      renderSyncCard();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function(){pushCloudState(false)},SAVE_DEBOUNCE_MS);
    }
    async function pushCloudState(force){
      if(!currentUser || !syncRef)return;
      const payloadState = sanitizeForFirestore(cloudState());
      const hash = cloudHash(payloadState);
      if(!force && hash === lastCloudHash)return;
      const revision = Date.now();
      syncStatus = "저장 중";
      syncError = "";
      renderSyncCard();
      try{
        await setDoc(syncRef,{schema:1,state:payloadState,revision:revision,updatedAt:serverTimestamp(),updatedBy:deviceId},{merge:false});
        lastCloudHash = hash;
        lastAppliedRevision = Math.max(lastAppliedRevision,revision);
        markCloudLinked(hash,revision);
        syncStatus = "동기화됨";
        syncError = "";
        renderSyncCard();
      }catch(error){
        syncStatus = "저장 실패";
        syncError = readableAuthError(error);
        renderSyncCard();
      }
    }
