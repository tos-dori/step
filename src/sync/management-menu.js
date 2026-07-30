const popover=document.getElementById('syncPopover');
const trigger=document.getElementById('versionTap');
const title=document.querySelector('.brand-title');
const app=window.StepSyncApp;

function storageKey(){return app?.key?.()||''}

function statusText(){
  if(app?.isLocalStateSafe?.()===false)return{label:'기기 저장 확인 필요',tone:'danger'};
  if(!navigator.onLine)return{label:'오프라인 · 기기 저장 정상',tone:''};
  if(!document.body.classList.contains('sync-locked'))return{label:'계정 연결됨 · 기기 저장 정상',tone:''};
  return{label:'기기 저장 정상',tone:''};
}

function backupPayload(){
  return{tag:'STEP_BACKUP_V1',app:'step',schema:1,storageKey:storageKey(),appVersion:String(window.APP_VERSION||''),exportedAt:new Date().toISOString(),state:app?.getCloudState?.()};
}

function parseBackup(text){
  try{
    const payload=JSON.parse(String(text||'').trim());
    if(!payload||payload.tag!=='STEP_BACKUP_V1'||payload.app!=='step'||payload.schema!==1)return null;
    if(!storageKey()||payload.storageKey!==storageKey())return null;
    if(!app?.cloudStateSafe?.(payload.state))return null;
    return payload.state;
  }catch{return null}
}

async function copyBackup(text,textarea,section){
  try{
    if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(text);
    app?.toast?.('백업을 복사했어요.');
  }catch{
    textarea.value=text;
    section.hidden=false;
    popover.dataset.menuMode='import';
    textarea.focus();
    textarea.select();
    app?.toast?.('직접 복사해 주세요.');
  }
}

function decorate(){
  if(!popover||popover.hidden||popover.querySelector('.management-menu-head'))return;
  const recovery=popover.querySelector('#syncRecoveryBtn');
  const logout=popover.querySelector('#syncHiddenLogoutBtn');
  if(!recovery||!logout)return;

  const state=statusText();
  const wasLogoutArmed=logout.classList.contains('armed');
  const head=document.createElement('div');
  head.className='management-menu-head';
  head.innerHTML=`<div><strong>Step!</strong><span>v${String(window.APP_VERSION||'')}</span></div><div class="management-menu-status" data-tone="${state.tone}">${state.label}</div>`;

  const actions=document.createElement('div');
  actions.className='management-menu-actions';
  recovery.className='management-menu-action';
  recovery.textContent='복구본';
  const exportButton=document.createElement('button');
  exportButton.type='button';
  exportButton.className='management-menu-action primary';
  exportButton.textContent='내보내기';
  const importToggle=document.createElement('button');
  importToggle.type='button';
  importToggle.className='management-menu-action';
  importToggle.textContent='가져오기';
  logout.className=`management-menu-action danger${wasLogoutArmed?' armed':''}`;
  if(wasLogoutArmed)logout.textContent='한 번 더';
  actions.append(recovery,exportButton,importToggle,logout);

  const body=document.createElement('div');
  body.className='management-menu-body';
  const section=document.createElement('section');
  section.className='management-menu-section';
  section.hidden=true;
  section.innerHTML='<div class="management-menu-section-title">백업 JSON 붙여넣기</div>';
  const textarea=document.createElement('textarea');
  textarea.className='management-menu-input';
  textarea.rows=3;
  textarea.placeholder='Step 백업 JSON';
  textarea.autocapitalize='off';
  textarea.spellcheck=false;
  const confirm=document.createElement('button');
  confirm.type='button';
  confirm.className='management-menu-confirm';
  confirm.textContent='가져오기 실행';
  confirm.disabled=true;
  section.append(textarea,confirm);
  body.append(section);

  popover.innerHTML='';
  popover.classList.add('management-menu');
  popover.dataset.menuMode='root';
  popover.append(head,actions,body);

  exportButton.addEventListener('click',(event)=>{
    event.stopPropagation();
    copyBackup(JSON.stringify(backupPayload()),textarea,section);
  });
  importToggle.addEventListener('click',(event)=>{
    event.stopPropagation();
    const opening=section.hidden;
    section.hidden=!opening;
    popover.dataset.menuMode=opening?'import':'root';
    if(opening)setTimeout(()=>textarea.focus(),0);
  });
  textarea.addEventListener('input',()=>{confirm.disabled=!parseBackup(textarea.value)});
  confirm.addEventListener('click',(event)=>{
    event.stopPropagation();
    const imported=parseBackup(textarea.value);
    if(!imported)return;
    if(app?.checkpointLocal?.('import-backup',true)===false){app?.toast?.('복구본을 남기지 못해 가져오기를 중단했어요.');return}
    if(app?.applyCloudState?.(imported,'import-backup')===false){app?.toast?.('가져오기를 저장하지 못했어요.');return}
    window.StepSyncBridge?.onLocalStateChanged?.('restore-local');
    textarea.value='';
    confirm.disabled=true;
    section.hidden=true;
    popover.dataset.menuMode='root';
    app?.toast?.('백업을 가져왔어요.');
  });
}

if(title){
  title.setAttribute('role','button');
  title.setAttribute('tabindex','0');
  title.setAttribute('aria-label','관리 메뉴 열기');
  title.addEventListener('keydown',(event)=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    event.preventDefault();
    trigger?.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    setTimeout(()=>trigger?.dispatchEvent(new PointerEvent('pointerup',{bubbles:true})),720);
  });
}

const observer=new MutationObserver(()=>queueMicrotask(decorate));
if(popover)observer.observe(popover,{childList:true,attributes:true,attributeFilter:['hidden']});
window.addEventListener('online',decorate);
window.addEventListener('offline',decorate);
decorate();
