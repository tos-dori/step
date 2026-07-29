(function(){
  var PREFIX="step_checkpoint_v2_";
  var CURSOR_KEY="step_checkpoint_cursor_v2";
  var CORRUPT_PREFIX="step_corrupt_v2_";
  var CORRUPT_CURSOR_KEY="step_corrupt_cursor_v2";
  var MAX_CHECKPOINTS=12;
  var MAX_CORRUPT=3;
  var PERIODIC_MS=10*60*1000;
  var MAX_CLOUD_BYTES=750*1024;
  var blocked=false;
  var issue="";

  function safeGet(key){try{return localStorage.getItem(key)}catch(error){return null}}
  function safeSet(key,value){try{localStorage.setItem(key,value);return true}catch(error){return false}}
  function safeRemove(key){try{localStorage.removeItem(key)}catch(error){}}
  function slotKey(index){return PREFIX+String(index).padStart(2,"0")}
  function corruptKey(index){return CORRUPT_PREFIX+String(index).padStart(2,"0")}
  function nextCursor(key,max){var value=Number(safeGet(key)||0);return isFinite(value)?Math.abs(Math.floor(value))%max:0}
  function byteLength(text){try{return new TextEncoder().encode(String(text)).length}catch(error){return unescape(encodeURIComponent(String(text))).length}}
  function hashText(text){var hash=2166136261,value=String(text);for(var i=0;i<value.length;i+=1){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}return("00000000"+(hash>>>0).toString(16)).slice(-8)}
  function isObject(value){return !!value&&typeof value==="object"&&!Array.isArray(value)}
  function validateParsed(parsed){
    if(!isObject(parsed))throw new Error("state-shape");
    if(parsed.tasks!==undefined&&!Array.isArray(parsed.tasks))throw new Error("tasks-shape");
    (parsed.tasks||[]).forEach(function(task){
      if(!isObject(task))throw new Error("task-shape");
      if(task.pieces!==undefined&&!Array.isArray(task.pieces))throw new Error("pieces-shape");
      (task.pieces||[]).forEach(function(piece){if(!isObject(piece))throw new Error("piece-shape")});
    });
    return parsed;
  }
  function parseRaw(raw){if(typeof raw!=="string"||!raw.trim())throw new Error("empty");return validateParsed(JSON.parse(raw))}
  function forceReason(reason){return["before-remote","remote-apply","task-delete","restore-local","restore-cloud","migration","import","reset"].indexOf(String(reason||""))>=0}
  function readCheckpoint(index){
    var wrapper;
    try{wrapper=JSON.parse(safeGet(slotKey(index))||"null")}catch(error){return null}
    if(!isObject(wrapper)||typeof wrapper.raw!=="string")return null;
    try{parseRaw(wrapper.raw)}catch(error){return null}
    return{slot:index,createdAt:Number(wrapper.createdAt||0),reason:String(wrapper.reason||"checkpoint"),hash:String(wrapper.hash||hashText(wrapper.raw)),size:Number(wrapper.size||byteLength(wrapper.raw)),raw:wrapper.raw};
  }
  function listCheckpoints(){
    var items=[];
    for(var i=0;i<MAX_CHECKPOINTS;i+=1){var item=readCheckpoint(i);if(item)items.push(item)}
    return items.sort(function(a,b){return b.createdAt-a.createdAt});
  }
  function checkpointRaw(raw,reason,force){
    var parsed;
    try{parsed=parseRaw(raw)}catch(error){return false}
    var normalized=JSON.stringify(parsed),hash=hashText(normalized),latest=listCheckpoints()[0];
    if(latest&&latest.hash===hash)return false;
    if(!force&&latest&&Date.now()-latest.createdAt<PERIODIC_MS)return false;
    var cursor=nextCursor(CURSOR_KEY,MAX_CHECKPOINTS);
    var wrapper={schema:2,createdAt:Date.now(),reason:String(reason||"periodic"),hash:hash,size:byteLength(normalized),raw:normalized};
    if(!safeSet(slotKey(cursor),JSON.stringify(wrapper)))return false;
    safeSet(CURSOR_KEY,String((cursor+1)%MAX_CHECKPOINTS));
    return true;
  }
  function checkpointCurrent(reason,force){var raw=safeGet(KEY);return raw?checkpointRaw(raw,reason||"manual",force!==false):false}
  function quarantine(raw,error){
    var cursor=nextCursor(CORRUPT_CURSOR_KEY,MAX_CORRUPT);
    safeSet(corruptKey(cursor),JSON.stringify({schema:2,createdAt:Date.now(),error:String(error&&error.message||error||"invalid"),raw:String(raw||"")}));
    safeSet(CORRUPT_CURSOR_KEY,String((cursor+1)%MAX_CORRUPT));
  }
  function load(key,raw,fallbackFactory,normalize){
    if(!raw){blocked=false;issue="";return fallbackFactory()}
    try{var parsed=parseRaw(raw);blocked=false;issue="";return normalize(parsed)}catch(error){
      quarantine(raw,error);
      var recovery=listCheckpoints()[0];
      if(recovery){safeSet(key,recovery.raw);blocked=false;issue="손상된 로컬 저장을 자동 복구본으로 되돌렸어요.";return normalize(parseRaw(recovery.raw))}
      blocked=true;issue="로컬 저장이 손상되어 클라우드 저장을 차단했어요.";return fallbackFactory();
    }
  }
  function write(key,nextRaw,reason){
    var next;
    try{next=parseRaw(nextRaw)}catch(error){blocked=true;issue="저장하려는 데이터 형식이 올바르지 않아 저장을 차단했어요.";return false}
    var normalized=JSON.stringify(next),current=safeGet(key),why=String(reason||"local-change");
    if(current&&current!==normalized)checkpointRaw(current,why,forceReason(why));
    if(!safeSet(key,normalized)){blocked=true;issue="브라우저 저장 공간에 기록하지 못했어요.";return false}
    blocked=false;if(issue.indexOf("자동 복구본")<0)issue="";return true;
  }
  function restoreLocal(slot){
    var item=readCheckpoint(Number(slot));if(!item)throw new Error("checkpoint-not-found");
    checkpointCurrent("before-restore",true);
    if(!safeSet(KEY,item.raw))throw new Error("restore-write-failed");
    blocked=false;issue="선택한 로컬 복구본을 복원했어요.";return parseRaw(item.raw);
  }
  function cloudStateSafe(value){
    try{validateParsed(value);return byteLength(JSON.stringify(value))<=MAX_CLOUD_BYTES}catch(error){return false}
  }
  function cloudSize(value){try{return byteLength(JSON.stringify(value))}catch(error){return Infinity}}
  function nonEmptyToEmpty(previous,next){return !!(previous&&Array.isArray(previous.tasks)&&previous.tasks.length)&&!!(next&&Array.isArray(next.tasks)&&next.tasks.length===0)}
  function clearRecoveryMessage(){if(issue.indexOf("복구")>=0)issue=""}

  window.StepDataSafety={
    load:load,
    write:write,
    checkpointCurrent:checkpointCurrent,
    listCheckpoints:listCheckpoints,
    restoreLocal:restoreLocal,
    isSafe:function(){return !blocked},
    issue:function(){return issue},
    clearRecoveryMessage:clearRecoveryMessage,
    cloudStateSafe:cloudStateSafe,
    cloudSize:cloudSize,
    nonEmptyToEmpty:nonEmptyToEmpty,
    maxCloudBytes:MAX_CLOUD_BYTES
  };
})();
