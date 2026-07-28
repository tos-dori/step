(function(){
  var SNAPSHOT_KEY="step_recovery_v1";
  var CORRUPT_KEY="step_corrupt_backup_v1";
  var MAX_SNAPSHOTS=20;
  var blocked=false;
  var issue="";
  var pendingOperation="";
  var pendingOperationUntil=0;

  function safeGet(key){try{return localStorage.getItem(key)}catch(error){return null}}
  function safeSet(key,value){try{localStorage.setItem(key,value);return true}catch(error){return false}}
  function parseStateRaw(raw){
    if(typeof raw!=="string"||!raw.trim())throw new Error("empty");
    var parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("shape");
    if(parsed.tasks!==undefined&&!Array.isArray(parsed.tasks))throw new Error("tasks");
    return parsed;
  }
  function readSnapshots(){
    try{
      var value=JSON.parse(safeGet(SNAPSHOT_KEY)||"[]");
      return Array.isArray(value)?value:[];
    }catch(error){return[]}
  }
  function writeSnapshots(items){safeSet(SNAPSHOT_KEY,JSON.stringify(items.slice(0,MAX_SNAPSHOTS)))}
  function snapshotRaw(raw,reason){
    var parsed;
    try{parsed=parseStateRaw(raw)}catch(error){return false}
    var normalized=JSON.stringify(parsed);
    var items=readSnapshots();
    if(items[0]&&items[0].raw===normalized)return false;
    items.unshift({createdAt:Date.now(),reason:String(reason||"change"),raw:normalized});
    writeSnapshots(items);
    return true;
  }
  function latestValidSnapshot(){
    var items=readSnapshots();
    for(var i=0;i<items.length;i+=1){
      try{parseStateRaw(items[i].raw);return items[i]}catch(error){}
    }
    return null;
  }
  function preserveCorrupt(raw,error){
    var items=[];
    try{items=JSON.parse(safeGet(CORRUPT_KEY)||"[]");if(!Array.isArray(items))items=[]}catch(parseError){items=[]}
    items.unshift({createdAt:Date.now(),error:String(error&&error.message||error||"invalid"),raw:String(raw||"")});
    safeSet(CORRUPT_KEY,JSON.stringify(items.slice(0,5)));
  }
  function load(key,raw,fallbackFactory,normalize){
    if(!raw){blocked=false;issue="";return fallbackFactory()}
    try{
      var parsed=parseStateRaw(raw);
      blocked=false;issue="";
      return normalize(parsed);
    }catch(error){
      preserveCorrupt(raw,error);
      var recovery=latestValidSnapshot();
      if(recovery){
        safeSet(key,recovery.raw);
        blocked=false;
        issue="손상된 로컬 저장을 이전 자동 복구본으로 되돌렸어요.";
        return normalize(parseStateRaw(recovery.raw));
      }
      blocked=true;
      issue="로컬 저장이 손상되어 동기화를 멈췄어요.";
      return fallbackFactory();
    }
  }
  function write(key,nextRaw,reason){
    var current=safeGet(key);
    if(current&&current!==nextRaw)snapshotRaw(current,reason||"before-write");
    try{parseStateRaw(nextRaw)}catch(error){blocked=true;issue="저장하려는 데이터가 올바르지 않아 동기화를 멈췄어요.";return false}
    var ok=safeSet(key,nextRaw);
    if(ok){blocked=false;if(issue.indexOf("손상")<0)issue=""}
    return ok;
  }
  function snapshotCurrent(reason){var raw=safeGet(KEY);return raw?snapshotRaw(raw,reason||"manual"):false}
  function allowDestructiveOnce(operation){pendingOperation=String(operation||"explicit");pendingOperationUntil=Date.now()+10000}
  function consumeOperation(){
    if(!pendingOperation||Date.now()>pendingOperationUntil){pendingOperation="";pendingOperationUntil=0;return""}
    var value=pendingOperation;pendingOperation="";pendingOperationUntil=0;return value;
  }
  function taskCount(value){return value&&Array.isArray(value.tasks)?value.tasks.length:0}
  function destructiveChange(previous,next){
    var before=taskCount(previous),after=taskCount(next);
    if(before>0&&after===0)return true;
    return before>=4&&after<=Math.floor(before/2);
  }

  window.StepDataSafety={
    load:load,
    write:write,
    snapshotCurrent:snapshotCurrent,
    isSafe:function(){return !blocked},
    issue:function(){return issue},
    allowDestructiveOnce:allowDestructiveOnce,
    consumeOperation:consumeOperation,
    destructiveChange:destructiveChange,
    latestLocalSnapshot:function(){return latestValidSnapshot()}
  };
})();
