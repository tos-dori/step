function baseTimer(){return{mode:TIMER.FOCUS,running:false,startedAt:null,elapsed:0}}
    function baseState(){return{screen:"do",draft:"",startText:"",memoText:"",finishText:"",type:TYPE.STUDY,count:1,prep:false,addSettingsOpen:false,activeId:null,libraryOpen:false,doneShelfOpen:false,selectedLibraryId:null,timer:baseTimer(),tasks:[]}}
    function storageGet(key){try{return localStorage.getItem(key)}catch(e){return null}}
    function storageSet(key,value,reason){
      if(window.StepDataSafety&&typeof window.StepDataSafety.write==="function")return window.StepDataSafety.write(key,value,reason);
      try{localStorage.setItem(key,value);return true}catch(e){return false}
    }
    function loadState(){
      var raw=storageGet(KEY);
      if(window.StepDataSafety&&typeof window.StepDataSafety.load==="function")return window.StepDataSafety.load(KEY,raw,baseState,normalizeState);
      if(!raw)return baseState();
      try{return normalizeState(JSON.parse(raw))}catch(e){return baseState()}
    }
    function serializeStateForLocal(value){return JSON.stringify(value)}
    function saveLocalState(reason){storageSet(KEY,serializeStateForLocal(state),reason||"local-change")}
    function notifyCloudStateChanged(){
      if(window.StepSyncBridge&&typeof window.StepSyncBridge.onLocalStateChanged==="function")window.StepSyncBridge.onLocalStateChanged();
    }
    function saveState(reason){saveLocalState(reason);notifyCloudStateChanged()}
    function currentLocalUiState(){
      return{screen:state.screen,draft:state.draft,startText:state.startText,memoText:state.memoText,finishText:state.finishText,type:state.type,count:state.count,prep:state.prep,addSettingsOpen:state.addSettingsOpen,libraryOpen:state.libraryOpen,doneShelfOpen:state.doneShelfOpen,selectedLibraryId:state.selectedLibraryId,timer:normalizeTimer(state.timer)};
    }
    function pieceForCloud(piece){
      piece=piece||{};
      return{status:validStatus(piece.status),kind:validKind(piece.kind)||KIND.CONTINUE,done:Array.isArray(piece.done)?piece.done.map(Boolean).slice(0,4):[false,false,false]};
    }
    function taskForCloud(task){
      task=task||{};
      var cloudTask={id:str(task.id),title:str(task.title),startText:str(task.startText),memoText:str(task.memoText),finishText:str(task.finishText),type:clamp(task.type,TYPE.STUDY,TYPE.ETC),prep:!!task.prep,count:Array.isArray(task.pieces)?task.pieces.length:clamp(task.count,1,6),doneShelf:!!task.doneShelf,pieces:Array.isArray(task.pieces)?task.pieces.map(pieceForCloud):[]};
      var shelfAt=validTimestamp(task.doneShelfAt);
      if(shelfAt)cloudTask.doneShelfAt=shelfAt;
      return cloudTask;
    }
    function stateForCloud(){
      return{schema:1,activeId:state.activeId,tasks:state.tasks.map(taskForCloud)};
    }
    function applyCloudState(remote){
      var local=currentLocalUiState(),next=baseState();
      remote=remote||{};
      next.screen=local.screen;next.draft=local.draft;next.startText=local.startText;next.memoText=local.memoText;next.finishText=local.finishText;
      next.type=local.type;next.count=local.count;next.prep=local.prep;next.addSettingsOpen=local.addSettingsOpen;next.libraryOpen=local.libraryOpen;next.doneShelfOpen=local.doneShelfOpen;next.selectedLibraryId=local.selectedLibraryId;next.timer=local.timer;
      next.activeId=remote.activeId?String(remote.activeId):null;
      next.tasks=Array.isArray(remote.tasks)?remote.tasks.map(normalizeTask).filter(Boolean):[];
      state=normalizeState(next);
      saveLocalState("remote-apply");
    }
    function isTextEditingNode(node){
      if(!node)return false;
      var tag=str(node.tagName).toUpperCase();
      return tag==="INPUT"||tag==="TEXTAREA"||!!node.isContentEditable;
    }
    function hasOpenTaskEditor(){return state.tasks.some(function(task){return !!task.settingsOpen})}
    function isLocalInputActive(){return isTextEditingNode(document.activeElement)||state.screen==="add"||!!editDraft||hasOpenTaskEditor()}
    function hasTaskId(tasks,id){
      id=String(id||"");
      return Array.isArray(tasks)&&tasks.some(function(task){return task&&String(task.id)===id});
    }
    function normalizeState(saved){
      var next=baseState(); saved=saved||{};
      next.screen=saved.screen==="add"?"add":"do";
      next.draft=str(saved.draft); next.startText=str(saved.startText); next.memoText=str(saved.memoText); next.finishText=str(saved.finishText);
      next.type=clamp(saved.type,TYPE.STUDY,TYPE.ETC); next.count=clamp(saved.count,1,6); next.prep=!!(saved.prep||saved.criteria&&saved.criteria.unclear); next.addSettingsOpen=!!saved.addSettingsOpen;
      next.libraryOpen=!!saved.libraryOpen; next.doneShelfOpen=!!saved.doneShelfOpen; next.tasks=Array.isArray(saved.tasks)?saved.tasks.map(normalizeTask).filter(Boolean):[];
      next.activeId=saved.activeId&&hasTaskId(next.tasks,saved.activeId)?String(saved.activeId):null;
      next.selectedLibraryId=saved.libraryOpen&&saved.selectedLibraryId&&String(saved.selectedLibraryId)!==next.activeId&&hasTaskId(next.tasks,saved.selectedLibraryId)?String(saved.selectedLibraryId):null;
      next.timer=normalizeTimer(saved.timer);
      return next;
    }
    function normalizeTimer(raw){
      raw=raw||{};
      var mode=raw.mode===TIMER.BREAK?TIMER.BREAK:raw.mode===TIMER.OFF?TIMER.OFF:TIMER.FOCUS;
      var elapsed=Number(raw.elapsed||0);
      var startedAt=raw.startedAt?Number(raw.startedAt):null;
      return{mode:mode,running:!!raw.running&&mode!==TIMER.OFF,startedAt:startedAt,elapsed:isFinite(elapsed)&&elapsed>0?elapsed:0};
    }
    function normalizeTask(raw){
      if(!raw)return null;
      var title=clean(raw.title||"할 일")||"할 일";
      var task={id:String(raw.id||uid()),title:title,startText:clean(raw.startText),memoText:cleanMemo(raw.memoText),finishText:clean(raw.finishText),type:clamp(raw.type,TYPE.STUDY,TYPE.ETC),prep:!!(raw.prep||raw.criteria&&raw.criteria.unclear),count:clamp(raw.count||1,1,6),now:0,view:0,settingsOpen:!!raw.settingsOpen,doneShelf:!!raw.doneShelf,doneShelfAt:validTimestamp(raw.doneShelfAt),pieces:[]};
      var oldPieces=Array.isArray(raw.pieces)?raw.pieces:[];
      task.pieces=oldPieces.length?oldPieces.map(function(piece,index){return normalizePiece(piece,task,index,oldPieces)}).filter(Boolean):makePieces(task);
      if(!task.pieces.length)task.pieces=makePieces(task);
      refreshKinds(task);
      recalcTask(task);
      task.view=clamp(typeof raw.view==="number"?raw.view:task.now,0,Math.max(task.pieces.length-1,0));
      return task.pieces.length?task:null;
    }
    function normalizePiece(piece,task,index,pieces){if(!piece)return null;return{status:validStatus(piece.status),kind:validKind(piece.kind)||inferredKind(task,index,pieces),done:doneFlags(piece)}}
    function doneFlags(piece){var flags=[];if(Array.isArray(piece.done)){flags=piece.done.map(Boolean)}else if(Array.isArray(piece.steps)){flags=piece.steps.map(function(step){return!!step.done})}while(flags.length<3)flags.push(false);return flags.slice(0,4)}
    function inferredKind(task,index,pieces){
      var prev=index>0?pieces[index-1]:null, current=pieces[index], prevStatus=prev?validStatus(prev.status):"", currentStatus=current?validStatus(current.status):STATUS.PENDING;
      if(currentStatus===STATUS.PENDING&&prevStatus===STATUS.INCOMPLETE)return KIND.INCOMPLETE;
      if(currentStatus===STATUS.PENDING&&prevStatus===STATUS.BLOCKED)return KIND.BLOCKED;
      return kindForNewPiece(task,index,pieces.length);
    }
    function validStatus(status){return[STATUS.PENDING,STATUS.SUCCESS,STATUS.INCOMPLETE,STATUS.BLOCKED].indexOf(status)>=0?status:STATUS.PENDING}
    function validKind(kind){return[KIND.PREP,KIND.START,KIND.CONTINUE,KIND.WRAP,KIND.SUBMIT,KIND.INCOMPLETE,KIND.BLOCKED].indexOf(kind)>=0?kind:""}
    function validTimestamp(value){value=Number(value);return isFinite(value)&&value>0?value:undefined}
    function clamp(value,min,max){value=Number(value);if(!isFinite(value))value=min;return Math.max(min,Math.min(max,Math.round(value)))}
    function uid(){return"t-"+Date.now()+"-"+Math.random().toString(16).slice(2)}
    function str(value){return String(value||"")}
    function clean(text){return str(text).trim().replace(/\s+/g," ")}
    function cleanMemo(text){return str(text).trim()}
    function safe(text){return str(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
    function attr(text){return safe(text).replace(/"/g,"&quot;")}
    var state=null;
    var armedDeleteId=null;
    var armedDraftClear=false;
    var toastTimer=null;
    var celebrationTimer=null;
    var timerTick=null;
    var timePlanTick=null;
    var timerFlashTimer=null;
    var editDraft=null;
